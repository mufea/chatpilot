"use client";

import { useActionState } from "react";
import {
  changePasswordAction,
  deleteAccountAction,
  updateProfileAction,
} from "@/app/actions/auth";
import { createOrganizationAction, inviteMemberAction, renameOrganizationAction } from "@/app/actions/org";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FormState } from "@/lib/validators";

function Message({ state }: { state: FormState }) {
  if (!state.message) return null;
  return (
    <p className={state.ok ? "text-sm text-primary" : "text-sm text-destructive"}>{state.message}</p>
  );
}

export function ProfileForm({ defaultName }: { defaultName: string }) {
  const [state, action, pending] = useActionState(updateProfileAction, {} as FormState);
  return (
    <form action={action} className="space-y-4">
      <Message state={state} />
      <div className="space-y-1.5">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" defaultValue={defaultName} required />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save profile"}
      </Button>
    </form>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePasswordAction, {} as FormState);
  return (
    <form action={action} className="space-y-4">
      <Message state={state} />
      <div className="space-y-1.5">
        <Label htmlFor="currentPassword">Current password</Label>
        <Input id="currentPassword" name="currentPassword" type="password" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="nextPassword">New password</Label>
        <Input id="nextPassword" name="nextPassword" type="password" required />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Updating…" : "Change password"}
      </Button>
    </form>
  );
}

export function DeleteAccountButton() {
  return (
    <form
      action={deleteAccountAction}
      onSubmit={(event) => {
        if (!window.confirm("Delete your account and solely owned workspaces? This cannot be undone.")) {
          event.preventDefault();
        }
      }}
    >
      <Button type="submit" variant="destructive">
        Delete account
      </Button>
    </form>
  );
}

export function RenameOrganizationForm({ defaultName }: { defaultName: string }) {
  const [state, action, pending] = useActionState(renameOrganizationAction, {} as FormState);
  return (
    <form action={action} className="space-y-4">
      <Message state={state} />
      <div className="space-y-1.5">
        <Label htmlFor="name">Workspace name</Label>
        <Input id="name" name="name" defaultValue={defaultName} required />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Rename workspace"}
      </Button>
    </form>
  );
}

export function CreateOrganizationForm() {
  const [state, action, pending] = useActionState(createOrganizationAction, {} as FormState);
  return (
    <form action={action} className="space-y-4">
      <Message state={state} />
      <div className="space-y-1.5">
        <Label htmlFor="new-org-name">New workspace</Label>
        <Input id="new-org-name" name="name" required />
      </div>
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Creating…" : "Create workspace"}
      </Button>
    </form>
  );
}

export function InviteMemberForm() {
  const [state, action, pending] = useActionState(inviteMemberAction, {} as FormState);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[1fr_140px_auto] sm:items-end">
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="role">Role</Label>
        <select id="role" name="role" className="h-8 w-full rounded-lg border bg-background px-2 text-sm" defaultValue="AGENT">
          <option value="ADMIN">Admin</option>
          <option value="AGENT">Agent</option>
        </select>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Sending…" : "Invite"}
      </Button>
      <div className="sm:col-span-3">
        <Message state={state} />
      </div>
    </form>
  );
}
