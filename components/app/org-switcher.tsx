"use client";

import { switchOrganizationAction } from "@/app/actions/org";

type Option = {
  id: string;
  name: string;
};

export function OrgSwitcher({
  organizations,
  activeId,
}: {
  organizations: Option[];
  activeId?: string;
}) {
  if (organizations.length < 2) return null;

  return (
    <form>
      <label className="sr-only" htmlFor="organizationId">
        Switch workspace
      </label>
      <select
        id="organizationId"
        name="organizationId"
        defaultValue={activeId}
        className="h-8 max-w-44 rounded-lg border bg-background px-2 text-sm"
        onChange={(event) => {
          void switchOrganizationAction(event.target.value);
        }}
      >
        {organizations.map((organization) => (
          <option key={organization.id} value={organization.id}>
            {organization.name}
          </option>
        ))}
      </select>
    </form>
  );
}
