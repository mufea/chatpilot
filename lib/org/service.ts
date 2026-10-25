import {
  InvitationStatus,
  OrganizationRole,
  Prisma,
  type PrismaClient,
} from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { generateToken, hashToken, slugify } from "@/lib/crypto";
import { invitationEmail, sendEmail } from "@/lib/email/send";
import { appConfig } from "@/lib/config";
import { canAssignRole, canManageMembers, hasOrgRole } from "@/lib/org/access";
import { assertCanCreateResource } from "@/lib/billing/entitlements";
import { DEFAULT_PLANS } from "@/lib/plans";

export class OrgError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export async function createOrganization(
  db: PrismaClient,
  input: { name: string; ownerUserId: string },
) {
  const base = slugify(input.name);
  let slug = base;
  let suffix = 1;
  while (await db.organization.findUnique({ where: { slug } })) {
    suffix += 1;
    slug = `${base}-${suffix}`;
  }

  const freePlan = await db.plan.findUnique({ where: { code: "FREE" } });
  const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  const organization = await db.$transaction(async (tx) => {
    const created = await tx.organization.create({
      data: {
        name: input.name,
        slug,
        ownerId: input.ownerUserId,
        members: {
          create: {
            userId: input.ownerUserId,
            role: OrganizationRole.OWNER,
          },
        },
        creditAccount: {
          create: {
            balance: 200,
            lifetimeGranted: 200,
            ledger: {
              create: {
                type: "GRANT",
                amount: 200,
                balanceAfter: 200,
                reason: "Welcome credits",
                idempotencyKey: `welcome:${crypto.randomUUID()}`,
              },
            },
          },
        },
      },
    });

    if (freePlan) {
      await tx.subscription.create({
        data: {
          organizationId: created.id,
          planId: freePlan.id,
          status: "TRIALING",
          trialEndsAt,
        },
      });
    }

    return created;
  });

  await writeAuditLog(db, {
    actorUserId: input.ownerUserId,
    organizationId: organization.id,
    action: "organization.created",
    targetType: "organization",
    targetId: organization.id,
  });

  return organization;
}

export async function requireMembership(
  db: PrismaClient,
  userId: string,
  organizationId: string,
  minimumRole: OrganizationRole = OrganizationRole.AGENT,
) {
  const member = await db.organizationMember.findUnique({
    where: {
      organizationId_userId: { organizationId, userId },
    },
    include: {
      organization: true,
    },
  });

  if (!member || member.organization.deletedAt) {
    throw new OrgError("You do not have access to this organization.", 403);
  }

  if (!hasOrgRole(member, minimumRole)) {
    throw new OrgError("You do not have permission to perform this action.", 403);
  }

  return member;
}

export async function listUserOrganizations(db: PrismaClient, userId: string) {
  return db.organizationMember.findMany({
    where: {
      userId,
      organization: { deletedAt: null },
    },
    include: { organization: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function inviteMember(
  db: PrismaClient,
  input: {
    organizationId: string;
    actorUserId: string;
    email: string;
    role: OrganizationRole;
    appUrl?: string;
  },
) {
  const membership = await requireMembership(
    db,
    input.actorUserId,
    input.organizationId,
    OrganizationRole.ADMIN,
  );

  if (!canManageMembers(membership.role) || !canAssignRole(membership.role, input.role)) {
    throw new OrgError("You cannot assign that role.", 403);
  }

  const existingUser = await db.user.findUnique({
    where: { email: input.email },
    include: {
      memberships: {
        where: { organizationId: input.organizationId },
      },
    },
  });

  if (existingUser?.memberships.length) {
    throw new OrgError("That person is already a member of this organization.");
  }

  const memberCount = await db.organizationMember.count({
    where: { organizationId: input.organizationId },
  });
  await assertCanCreateResource(db, input.organizationId, "teamMembers", memberCount);

  await db.invitation.updateMany({
    where: {
      organizationId: input.organizationId,
      email: input.email,
      status: InvitationStatus.PENDING,
    },
    data: { status: InvitationStatus.REVOKED },
  });

  const token = generateToken();
  const invitation = await db.invitation.create({
    data: {
      organizationId: input.organizationId,
      email: input.email,
      role: input.role,
      tokenHash: hashToken(token),
      invitedById: input.actorUserId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  await sendEmail(db, {
    to: input.email,
    subject: `Invitation to ${membership.organization.name} on ChatPilot AI`,
    textBody: invitationEmail(
      input.appUrl ?? appConfig.appUrl,
      membership.organization.name,
      token,
    ),
    purpose: "org_invite",
  });

  await writeAuditLog(db, {
    actorUserId: input.actorUserId,
    organizationId: input.organizationId,
    action: "organization.invited",
    targetType: "invitation",
    targetId: invitation.id,
    metadata: { emailDomain: input.email.split("@")[1], role: input.role },
  });

  return { invitation, token };
}

export async function acceptInvitation(
  db: PrismaClient,
  input: { token: string; userId: string; userEmail: string },
) {
  const tokenHash = hashToken(input.token);
  const invitation = await db.invitation.findUnique({
    where: { tokenHash },
    include: { organization: true },
  });

  if (!invitation || invitation.status !== InvitationStatus.PENDING) {
    throw new OrgError("This invitation is not valid.");
  }
  if (invitation.expiresAt.getTime() < Date.now()) {
    await db.invitation.update({
      where: { id: invitation.id },
      data: { status: InvitationStatus.EXPIRED },
    });
    throw new OrgError("This invitation has expired.");
  }
  if (invitation.email !== input.userEmail) {
    throw new OrgError("Sign in with the invited email address to accept this invitation.");
  }
  if (invitation.organization.deletedAt) {
    throw new OrgError("This organization is no longer available.");
  }

  await db.$transaction(async (tx) => {
    await tx.organizationMember.upsert({
      where: {
        organizationId_userId: {
          organizationId: invitation.organizationId,
          userId: input.userId,
        },
      },
      update: { role: invitation.role },
      create: {
        organizationId: invitation.organizationId,
        userId: input.userId,
        role: invitation.role,
      },
    });
    await tx.invitation.update({
      where: { id: invitation.id },
      data: {
        status: InvitationStatus.ACCEPTED,
        acceptedAt: new Date(),
      },
    });
  });

  return invitation.organization;
}

export async function updateMemberRole(
  db: PrismaClient,
  input: {
    organizationId: string;
    actorUserId: string;
    memberId: string;
    role: OrganizationRole;
  },
) {
  const actor = await requireMembership(
    db,
    input.actorUserId,
    input.organizationId,
    OrganizationRole.ADMIN,
  );
  const member = await db.organizationMember.findFirst({
    where: { id: input.memberId, organizationId: input.organizationId },
  });
  if (!member) throw new OrgError("Member not found.", 404);
  if (member.role === OrganizationRole.OWNER) {
    throw new OrgError("The organization owner role cannot be changed this way.");
  }
  if (!canAssignRole(actor.role, input.role)) {
    throw new OrgError("You cannot assign that role.", 403);
  }

  return db.organizationMember.update({
    where: { id: member.id },
    data: { role: input.role },
  });
}

export async function removeMember(
  db: PrismaClient,
  input: { organizationId: string; actorUserId: string; memberId: string },
) {
  const actor = await requireMembership(
    db,
    input.actorUserId,
    input.organizationId,
    OrganizationRole.ADMIN,
  );
  const member = await db.organizationMember.findFirst({
    where: { id: input.memberId, organizationId: input.organizationId },
  });
  if (!member) throw new OrgError("Member not found.", 404);
  if (member.role === OrganizationRole.OWNER) {
    throw new OrgError("The organization owner cannot be removed.");
  }
  if (member.userId === input.actorUserId && actor.role !== OrganizationRole.OWNER) {
    await db.organizationMember.delete({ where: { id: member.id } });
    return;
  }
  if (!canManageMembers(actor.role)) {
    throw new OrgError("You cannot remove this member.", 403);
  }
  await db.organizationMember.delete({ where: { id: member.id } });
}

export async function renameOrganization(
  db: PrismaClient,
  input: { organizationId: string; actorUserId: string; name: string },
) {
  await requireMembership(db, input.actorUserId, input.organizationId, OrganizationRole.ADMIN);
  return db.organization.update({
    where: { id: input.organizationId },
    data: { name: input.name },
  });
}

export async function ensureDefaultPlans(db: PrismaClient) {
  for (const plan of DEFAULT_PLANS) {
    await db.plan.upsert({
      where: { code: plan.code },
      update: {},
      create: {
        code: plan.code,
        name: plan.name,
        description: plan.description,
        monthlyPriceCents: plan.monthlyPriceCents,
        yearlyPriceCents: plan.yearlyPriceCents,
        currency: plan.currency,
        sortOrder: plan.sortOrder,
        monthlyCredits: plan.monthlyCredits,
        limits: plan.limits as unknown as Prisma.InputJsonValue,
        features: plan.features as unknown as Prisma.InputJsonValue,
      },
    });
  }
}
