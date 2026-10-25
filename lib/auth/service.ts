import {
  PlatformRole,
  Prisma,
  VerificationType,
  type PrismaClient,
  type User,
} from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { appConfig } from "@/lib/config";
import { generateToken, hashToken } from "@/lib/crypto";
import { resetEmail, sendEmail, verificationEmail } from "@/lib/email/send";
import { hashPassword, validatePasswordStrength, verifyPassword } from "@/lib/auth/password";
import { createOrganization } from "@/lib/org/service";

export class AuthError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export type PublicUser = {
  id: string;
  email: string;
  name: string;
  imageUrl: string | null;
  platformRole: PlatformRole;
  emailVerifiedAt: Date | null;
  createdAt: Date;
};

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    imageUrl: user.imageUrl,
    platformRole: user.platformRole,
    emailVerifiedAt: user.emailVerifiedAt,
    createdAt: user.createdAt,
  };
}

function platformRoleFor(email: string): PlatformRole {
  return appConfig.superAdminEmails.includes(email)
    ? PlatformRole.SUPER_ADMIN
    : PlatformRole.USER;
}

export async function registerUser(
  db: PrismaClient,
  input: {
    name: string;
    email: string;
    password: string;
    organizationName?: string;
    appUrl?: string;
  },
) {
  const passwordErrors = validatePasswordStrength(input.password);
  if (passwordErrors.length) {
    throw new AuthError(passwordErrors.join(" "));
  }

  const existing = await db.user.findUnique({ where: { email: input.email } });
  if (existing && !existing.deletedAt) {
    throw new AuthError("An account with this email already exists.");
  }
  if (existing?.deletedAt) {
    throw new AuthError("This email is associated with a deleted account.");
  }

  const passwordHash = await hashPassword(input.password);
  const user = await db.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash,
      platformRole: platformRoleFor(input.email),
    },
  });

  const organization = await createOrganization(db, {
    name: input.organizationName?.trim() || `${input.name}'s workspace`,
    ownerUserId: user.id,
  });

  const token = await issueVerificationToken(db, user.email, input.appUrl);

  await writeAuditLog(db, {
    actorUserId: user.id,
    organizationId: organization.id,
    action: "user.registered",
    targetType: "user",
    targetId: user.id,
  });

  return { user: toPublicUser(user), organization, verificationToken: token };
}

export async function issueVerificationToken(
  db: PrismaClient,
  email: string,
  appUrl = appConfig.appUrl,
) {
  await db.verificationToken.updateMany({
    where: {
      identifier: email,
      type: VerificationType.EMAIL_VERIFY,
      consumedAt: null,
    },
    data: { consumedAt: new Date() },
  });

  const token = generateToken();
  await db.verificationToken.create({
    data: {
      identifier: email,
      tokenHash: hashToken(token),
      type: VerificationType.EMAIL_VERIFY,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  await sendEmail(db, {
    to: email,
    subject: "Verify your ChatPilot AI email",
    textBody: verificationEmail(appUrl, token),
    purpose: "email_verify",
  });

  return token;
}

export async function verifyEmailToken(db: PrismaClient, token: string) {
  const record = await db.verificationToken.findUnique({
    where: { tokenHash: hashToken(token) },
  });

  if (!record || record.type !== VerificationType.EMAIL_VERIFY || record.consumedAt) {
    throw new AuthError("This verification link is invalid.");
  }
  if (record.expiresAt.getTime() < Date.now()) {
    throw new AuthError("This verification link has expired.");
  }

  const user = await db.user.findUnique({ where: { email: record.identifier } });
  if (!user || user.deletedAt) {
    throw new AuthError("Account not found.");
  }

  await db.$transaction([
    db.user.update({
      where: { id: user.id },
      data: { emailVerifiedAt: new Date() },
    }),
    db.verificationToken.update({
      where: { id: record.id },
      data: { consumedAt: new Date() },
    }),
  ]);

  return toPublicUser({ ...user, emailVerifiedAt: new Date() });
}

export async function authenticateUser(
  db: PrismaClient,
  input: { email: string; password: string },
) {
  const user = await db.user.findUnique({ where: { email: input.email } });
  if (!user || user.deletedAt || !user.passwordHash) {
    throw new AuthError("Incorrect email or password.", 401);
  }

  const valid = await verifyPassword(input.password, user.passwordHash);
  if (!valid) {
    throw new AuthError("Incorrect email or password.", 401);
  }

  if (platformRoleFor(user.email) === PlatformRole.SUPER_ADMIN && user.platformRole !== PlatformRole.SUPER_ADMIN) {
    await db.user.update({
      where: { id: user.id },
      data: { platformRole: PlatformRole.SUPER_ADMIN },
    });
    user.platformRole = PlatformRole.SUPER_ADMIN;
  }

  return toPublicUser(user);
}

export async function createSession(
  db: PrismaClient,
  input: {
    userId: string;
    activeOrganizationId?: string | null;
    ipAddress?: string | null;
    userAgent?: string | null;
    ttlDays?: number;
  },
) {
  const token = generateToken();
  const ttlDays = input.ttlDays ?? appConfig.sessionTtlDays;
  const session = await db.session.create({
    data: {
      userId: input.userId,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000),
      activeOrganizationId: input.activeOrganizationId ?? undefined,
      ipAddress: input.ipAddress ?? undefined,
      userAgent: input.userAgent ?? undefined,
    },
  });
  return { token, session };
}

export async function getSessionUser(db: PrismaClient, token: string | undefined | null) {
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!session || session.expiresAt.getTime() < Date.now() || session.user.deletedAt) {
    return null;
  }
  return {
    session,
    user: toPublicUser(session.user),
  };
}

export async function revokeSession(db: PrismaClient, token: string) {
  await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
}

export async function revokeAllSessions(db: PrismaClient, userId: string) {
  await db.session.deleteMany({ where: { userId } });
}

export async function requestPasswordReset(
  db: PrismaClient,
  email: string,
  appUrl = appConfig.appUrl,
) {
  const user = await db.user.findUnique({ where: { email } });
  if (!user || user.deletedAt) {
    return { issued: false };
  }

  await db.verificationToken.updateMany({
    where: {
      identifier: email,
      type: VerificationType.PASSWORD_RESET,
      consumedAt: null,
    },
    data: { consumedAt: new Date() },
  });

  const token = generateToken();
  await db.verificationToken.create({
    data: {
      identifier: email,
      tokenHash: hashToken(token),
      type: VerificationType.PASSWORD_RESET,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });

  await sendEmail(db, {
    to: email,
    subject: "Reset your ChatPilot AI password",
    textBody: resetEmail(appUrl, token),
    purpose: "password_reset",
  });

  return { issued: true, token };
}

export async function resetPassword(db: PrismaClient, token: string, password: string) {
  const passwordErrors = validatePasswordStrength(password);
  if (passwordErrors.length) {
    throw new AuthError(passwordErrors.join(" "));
  }

  const record = await db.verificationToken.findUnique({
    where: { tokenHash: hashToken(token) },
  });
  if (!record || record.type !== VerificationType.PASSWORD_RESET || record.consumedAt) {
    throw new AuthError("This reset link is invalid.");
  }
  if (record.expiresAt.getTime() < Date.now()) {
    throw new AuthError("This reset link has expired.");
  }

  const user = await db.user.findUnique({ where: { email: record.identifier } });
  if (!user || user.deletedAt) {
    throw new AuthError("Account not found.");
  }

  const passwordHash = await hashPassword(password);
  await db.$transaction([
    db.user.update({
      where: { id: user.id },
      data: { passwordHash },
    }),
    db.verificationToken.update({
      where: { id: record.id },
      data: { consumedAt: new Date() },
    }),
    db.session.deleteMany({ where: { userId: user.id } }),
  ]);
}

export async function updateProfile(
  db: PrismaClient,
  userId: string,
  input: { name: string },
) {
  const user = await db.user.update({
    where: { id: userId },
    data: { name: input.name },
  });
  return toPublicUser(user);
}

export async function changePassword(
  db: PrismaClient,
  userId: string,
  input: { currentPassword: string; nextPassword: string },
) {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user?.passwordHash) {
    throw new AuthError("Password login is not available for this account.");
  }
  const valid = await verifyPassword(input.currentPassword, user.passwordHash);
  if (!valid) {
    throw new AuthError("Current password is incorrect.", 401);
  }
  const passwordErrors = validatePasswordStrength(input.nextPassword);
  if (passwordErrors.length) {
    throw new AuthError(passwordErrors.join(" "));
  }
  await db.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(input.nextPassword) },
  });
  await revokeAllSessions(db, userId);
}

export async function exportAccount(db: PrismaClient, userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      memberships: { include: { organization: true } },
      ownedOrganizations: true,
      accounts: {
        select: { provider: true, providerAccountId: true, createdAt: true },
      },
    },
  });
  if (!user) throw new AuthError("Account not found.", 404);

  return {
    exportedAt: new Date().toISOString(),
    user: toPublicUser(user),
    organizations: user.memberships.map((membership) => ({
      id: membership.organization.id,
      name: membership.organization.name,
      slug: membership.organization.slug,
      role: membership.role,
    })),
    connectedAccounts: user.accounts,
  };
}

export async function deleteAccount(db: PrismaClient, userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      ownedOrganizations: {
        include: { members: true },
      },
    },
  });
  if (!user || user.deletedAt) {
    throw new AuthError("Account not found.", 404);
  }

  const anonymizedEmail = `deleted+${user.id}@deleted.chatpilot.local`;

  await db.$transaction(async (tx) => {
    for (const org of user.ownedOrganizations) {
      const otherOwners = org.members.filter(
        (member) => member.userId !== userId && member.role === "OWNER",
      );
      if (otherOwners.length === 0) {
        await tx.organization.update({
          where: { id: org.id },
          data: { deletedAt: new Date() },
        });
      }
    }

    await tx.organizationMember.deleteMany({ where: { userId } });
    await tx.session.deleteMany({ where: { userId } });
    await tx.account.deleteMany({ where: { userId } });
    await tx.user.update({
      where: { id: userId },
      data: {
        email: anonymizedEmail,
        name: "Deleted user",
        passwordHash: null,
        imageUrl: null,
        deletedAt: new Date(),
        emailVerifiedAt: null,
      },
    });
  });

  await writeAuditLog(db, {
    actorUserId: userId,
    action: "user.deleted",
    targetType: "user",
    targetId: userId,
  });
}

export async function upsertGoogleUser(
  db: PrismaClient,
  input: {
    email: string;
    name: string;
    imageUrl?: string | null;
    providerAccountId: string;
    accessTokenEnc?: string | null;
    refreshTokenEnc?: string | null;
  },
) {
  const existingAccount = await db.account.findUnique({
    where: {
      provider_providerAccountId: {
        provider: "google",
        providerAccountId: input.providerAccountId,
      },
    },
    include: { user: true },
  });

  if (existingAccount && !existingAccount.user.deletedAt) {
    return toPublicUser(existingAccount.user);
  }

  let user = await db.user.findUnique({ where: { email: input.email } });
  if (user?.deletedAt) {
    throw new AuthError("This email is associated with a deleted account.");
  }

  if (!user) {
    user = await db.user.create({
      data: {
        email: input.email,
        name: input.name,
        imageUrl: input.imageUrl ?? undefined,
        emailVerifiedAt: new Date(),
        platformRole: platformRoleFor(input.email),
      },
    });
    await createOrganization(db, {
      name: `${input.name}'s workspace`,
      ownerUserId: user.id,
    });
  } else if (!user.emailVerifiedAt) {
    user = await db.user.update({
      where: { id: user.id },
      data: { emailVerifiedAt: new Date(), imageUrl: input.imageUrl ?? user.imageUrl },
    });
  }

  await db.account.upsert({
    where: {
      provider_providerAccountId: {
        provider: "google",
        providerAccountId: input.providerAccountId,
      },
    },
    update: {
      accessTokenEnc: input.accessTokenEnc ?? undefined,
      refreshTokenEnc: input.refreshTokenEnc ?? undefined,
    },
    create: {
      userId: user.id,
      provider: "google",
      providerAccountId: input.providerAccountId,
      accessTokenEnc: input.accessTokenEnc ?? undefined,
      refreshTokenEnc: input.refreshTokenEnc ?? undefined,
    },
  });

  return toPublicUser(user);
}

export function assertNotDeleted(user: { deletedAt: Date | null } | null) {
  if (!user || user.deletedAt) {
    throw new AuthError("Account not found.", 404);
  }
}

export type { Prisma };
