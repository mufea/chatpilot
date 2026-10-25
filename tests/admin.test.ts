import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { PlatformRole } from "@prisma/client";
import { listUsers, setUserPlatformRole } from "../lib/admin/service";
import { registerUser } from "../lib/auth/service";
import { ensureDefaultPlans } from "../lib/org/service";
import { resetDb, testDb } from "./helpers";

const db = testDb();

before(async () => {
  await resetDb(db);
  await ensureDefaultPlans(db);
});

after(async () => {
  await db.$disconnect();
});

test("rejects non-admin user listing", async () => {
  const user = await registerUser(db, {
    name: "Regular",
    email: "regular@example.com",
    password: "ValidPass1",
  });
  await assert.rejects(() => listUsers(db, user.user.platformRole), /administrator/);
});

test("allows a super admin to change another user's platform role", async () => {
  const admin = await registerUser(db, {
    name: "Admin",
    email: "root@example.com",
    password: "ValidPass1",
  });
  await db.user.update({
    where: { id: admin.user.id },
    data: { platformRole: PlatformRole.SUPER_ADMIN },
  });
  const target = await registerUser(db, {
    name: "Target",
    email: "target@example.com",
    password: "ValidPass1",
  });

  const updated = await setUserPlatformRole(db, {
    actorUserId: admin.user.id,
    actorRole: PlatformRole.SUPER_ADMIN,
    userId: target.user.id,
    role: PlatformRole.SUPER_ADMIN,
  });
  assert.equal(updated.platformRole, PlatformRole.SUPER_ADMIN);

  await assert.rejects(
    () =>
      setUserPlatformRole(db, {
        actorUserId: admin.user.id,
        actorRole: PlatformRole.SUPER_ADMIN,
        userId: admin.user.id,
        role: PlatformRole.USER,
      }),
    /your own/,
  );
});
