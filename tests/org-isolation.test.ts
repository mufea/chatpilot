import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { OrganizationRole } from "@prisma/client";
import { registerUser } from "../lib/auth/service";
import {
  acceptInvitation,
  ensureDefaultPlans,
  inviteMember,
  requireMembership,
} from "../lib/org/service";
import { resetDb, testDb } from "./helpers";

const db = testDb();

before(async () => {
  await resetDb(db);
  await ensureDefaultPlans(db);
});

after(async () => {
  await db.$disconnect();
});

test("members cannot read another organization's membership", async () => {
  const alpha = await registerUser(db, {
    name: "Alpha Owner",
    email: "alpha@example.com",
    password: "ValidPass1",
    organizationName: "Alpha Org",
  });
  const beta = await registerUser(db, {
    name: "Beta Owner",
    email: "beta@example.com",
    password: "ValidPass1",
    organizationName: "Beta Org",
  });

  await assert.rejects(
    () => requireMembership(db, alpha.user.id, beta.organization.id),
    /do not have access/,
  );

  const allowed = await requireMembership(db, alpha.user.id, alpha.organization.id);
  assert.equal(allowed.organizationId, alpha.organization.id);
});

test("invitations cannot grant access to a different tenant", async () => {
  const host = await registerUser(db, {
    name: "Host Owner",
    email: "host@example.com",
    password: "ValidPass1",
    organizationName: "Host Org",
  });
  const guest = await registerUser(db, {
    name: "Guest User",
    email: "guest@example.com",
    password: "ValidPass1",
    organizationName: "Guest Org",
  });

  const { token } = await inviteMember(db, {
    organizationId: host.organization.id,
    actorUserId: host.user.id,
    email: "guest@example.com",
    role: OrganizationRole.AGENT,
  });

  const joined = await acceptInvitation(db, {
    token,
    userId: guest.user.id,
    userEmail: "guest@example.com",
  });
  assert.equal(joined.id, host.organization.id);

  const memberships = await db.organizationMember.findMany({
    where: { userId: guest.user.id },
  });
  assert.equal(memberships.some((item) => item.organizationId === host.organization.id), true);
  assert.equal(memberships.some((item) => item.organizationId === guest.organization.id), true);

  await assert.rejects(
    () =>
      acceptInvitation(db, {
        token,
        userId: guest.user.id,
        userEmail: "guest@example.com",
      }),
    /not valid/,
  );
});

test("agents cannot invite members", async () => {
  const owner = await registerUser(db, {
    name: "Owner",
    email: "owner-invite@example.com",
    password: "ValidPass1",
    organizationName: "Invite Org",
  });
  const agent = await registerUser(db, {
    name: "Agent",
    email: "agent-invite@example.com",
    password: "ValidPass1",
  });
  const { token } = await inviteMember(db, {
    organizationId: owner.organization.id,
    actorUserId: owner.user.id,
    email: "agent-invite@example.com",
    role: OrganizationRole.AGENT,
  });
  await acceptInvitation(db, {
    token,
    userId: agent.user.id,
    userEmail: "agent-invite@example.com",
  });

  await assert.rejects(
    () =>
      inviteMember(db, {
        organizationId: owner.organization.id,
        actorUserId: agent.user.id,
        email: "new@example.com",
        role: OrganizationRole.AGENT,
      }),
    /permission|cannot/i,
  );
});
