import assert from "node:assert/strict";
import { test } from "node:test";
import { OrganizationRole, PlatformRole } from "@prisma/client";
import {
  assertSameOrganization,
  canAssignRole,
  canManageMembers,
  hasOrgRole,
  isPlatformAdmin,
} from "../lib/org/access";

test("role ranks", () => {
  assert.equal(hasOrgRole({ role: OrganizationRole.AGENT }, OrganizationRole.ADMIN), false);
  assert.equal(hasOrgRole({ role: OrganizationRole.OWNER }, OrganizationRole.ADMIN), true);
  assert.equal(canManageMembers(OrganizationRole.AGENT), false);
  assert.equal(canAssignRole(OrganizationRole.ADMIN, OrganizationRole.AGENT), true);
  assert.equal(canAssignRole(OrganizationRole.ADMIN, OrganizationRole.OWNER), false);
  assert.equal(isPlatformAdmin(PlatformRole.SUPER_ADMIN), true);
});

test("tenant isolation helper", () => {
  assert.doesNotThrow(() => assertSameOrganization("org_a", "org_a"));
  assert.throws(() => assertSameOrganization("org_a", "org_b"));
});
