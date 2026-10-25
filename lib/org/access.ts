import { OrganizationRole, PlatformRole, type OrganizationMember } from "@prisma/client";

export const ORG_ROLE_RANK: Record<OrganizationRole, number> = {
  AGENT: 10,
  ADMIN: 20,
  OWNER: 30,
};

export function hasOrgRole(member: Pick<OrganizationMember, "role">, minimum: OrganizationRole) {
  return ORG_ROLE_RANK[member.role] >= ORG_ROLE_RANK[minimum];
}

export function canManageMembers(role: OrganizationRole) {
  return role === OrganizationRole.OWNER || role === OrganizationRole.ADMIN;
}

export function canDeleteOrganization(role: OrganizationRole) {
  return role === OrganizationRole.OWNER;
}

export function isPlatformAdmin(platformRole: PlatformRole) {
  return platformRole === PlatformRole.SUPER_ADMIN;
}

export function assertSameOrganization(leftId: string, rightId: string) {
  if (leftId !== rightId) {
    throw new Error("Organization isolation violation.");
  }
}

export function canAssignRole(actorRole: OrganizationRole, targetRole: OrganizationRole) {
  if (actorRole === OrganizationRole.OWNER) return true;
  if (actorRole === OrganizationRole.ADMIN) {
    return targetRole === OrganizationRole.ADMIN || targetRole === OrganizationRole.AGENT;
  }
  return false;
}
