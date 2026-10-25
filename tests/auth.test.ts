import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import {
  authenticateUser,
  createSession,
  deleteAccount,
  exportAccount,
  getSessionUser,
  registerUser,
  requestPasswordReset,
  resetPassword,
  verifyEmailToken,
} from "../lib/auth/service";
import { ensureDefaultPlans } from "../lib/org/service";
import { resetDb, testDb } from "./helpers";

const db = testDb();

before(async () => {
  await ensureDefaultPlans(db);
  await resetDb(db);
  await ensureDefaultPlans(db);
});

after(async () => {
  await db.$disconnect();
});

test("registers a user, isolates the workspace, and requires a real password", async () => {
  const result = await registerUser(db, {
    name: "Ava Chen",
    email: "ava@example.com",
    password: "ValidPass1",
    organizationName: "Harbor Books",
  });

  assert.equal(result.user.email, "ava@example.com");
  assert.equal(result.user.emailVerifiedAt, null);
  assert.ok(result.verificationToken);

  const user = await db.user.findUnique({ where: { email: "ava@example.com" } });
  assert.ok(user?.passwordHash);
  assert.notEqual(user.passwordHash, "ValidPass1");

  await assert.rejects(
    () => authenticateUser(db, { email: "ava@example.com", password: "WrongPass1" }),
    /Incorrect email or password/,
  );

  const signedIn = await authenticateUser(db, {
    email: "ava@example.com",
    password: "ValidPass1",
  });
  assert.equal(signedIn.id, result.user.id);
});

test("verifies email tokens and rejects reuse", async () => {
  await resetDb(db);
  await ensureDefaultPlans(db);
  const created = await registerUser(db, {
    name: "Ben Ortiz",
    email: "ben@example.com",
    password: "ValidPass1",
  });
  const verified = await verifyEmailToken(db, created.verificationToken);
  assert.ok(verified.emailVerifiedAt);
  await assert.rejects(() => verifyEmailToken(db, created.verificationToken), /invalid/i);
});

test("resets a password and revokes sessions", async () => {
  await resetDb(db);
  await ensureDefaultPlans(db);
  const created = await registerUser(db, {
    name: "Cara Liu",
    email: "cara@example.com",
    password: "ValidPass1",
  });
  const { token: sessionToken } = await createSession(db, { userId: created.user.id });
  const reset = await requestPasswordReset(db, "cara@example.com");
  assert.equal(reset.issued, true);
  assert.ok(reset.token);
  await resetPassword(db, reset.token, "NewPass123");
  assert.equal(await getSessionUser(db, sessionToken), null);
  const signedIn = await authenticateUser(db, {
    email: "cara@example.com",
    password: "NewPass123",
  });
  assert.equal(signedIn.email, "cara@example.com");
});

test("does not reveal whether an unknown email exists during reset", async () => {
  const result = await requestPasswordReset(db, "missing@example.com");
  assert.equal(result.issued, false);
});

test("exports and deletes an account without leaving a live session", async () => {
  await resetDb(db);
  await ensureDefaultPlans(db);
  const created = await registerUser(db, {
    name: "Dee Patel",
    email: "dee@example.com",
    password: "ValidPass1",
    organizationName: "Dee Studio",
  });
  const exported = await exportAccount(db, created.user.id);
  assert.equal(exported.user.email, "dee@example.com");
  assert.equal(exported.organizations[0]?.name, "Dee Studio");

  const { token } = await createSession(db, { userId: created.user.id });
  await deleteAccount(db, created.user.id);
  assert.equal(await getSessionUser(db, token), null);
  const org = await db.organization.findUnique({ where: { id: created.organization.id } });
  assert.ok(org?.deletedAt);
  const deletedUser = await db.user.findUnique({ where: { id: created.user.id } });
  assert.ok(deletedUser?.deletedAt);
  assert.notEqual(deletedUser?.email, "dee@example.com");
});
