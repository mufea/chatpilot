"use client";

import { useActionState } from "react";
import { removeProviderKeyAction, saveProviderKeyAction } from "@/app/actions/providers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FormState } from "@/lib/validators";

const LABELS = {
  openai: "OpenAI",
  gemini: "Google Gemini",
  anthropic: "Anthropic",
} as const;

export function ProviderKeyForm({
  provider,
  hasCustomerKey,
  hasPlatformKey,
  canManage,
}: {
  provider: keyof typeof LABELS;
  hasCustomerKey: boolean;
  hasPlatformKey: boolean;
  canManage: boolean;
}) {
  const [saveState, saveAction, saving] = useActionState(saveProviderKeyAction, {} as FormState);
  const [removeState, removeAction, removing] = useActionState(removeProviderKeyAction, {} as FormState);
  const state = saveState.message ? saveState : removeState;

  return (
    <section className="space-y-4 rounded-2xl border bg-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">{LABELS[provider]}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {hasCustomerKey
              ? "A workspace key is stored encrypted on the server."
              : hasPlatformKey
                ? "No workspace key. Requests will use the platform key."
                : "No key configured. Chat requests will fail with missing_credentials."}
          </p>
        </div>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
          {hasCustomerKey ? "Workspace key on file" : hasPlatformKey ? "Platform key available" : "No key"}
        </span>
      </div>
      {state.message ? (
        <p className={state.ok ? "text-sm text-primary" : "text-sm text-destructive"}>{state.message}</p>
      ) : null}
      {canManage ? (
        <form action={saveAction} className="space-y-3">
          <input type="hidden" name="provider" value={provider} />
          <div className="space-y-1.5">
            <Label htmlFor={`${provider}-key`}>API key</Label>
            <Input
              id={`${provider}-key`}
              name="apiKey"
              type="password"
              autoComplete="off"
              placeholder={hasCustomerKey ? "Replace existing key" : "Paste a key. It is never shown again."}
              required
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : hasCustomerKey ? "Replace key" : "Save key"}
            </Button>
          </div>
        </form>
      ) : (
        <p className="text-sm text-muted-foreground">Only owners and admins can change provider keys.</p>
      )}
      {canManage && hasCustomerKey ? (
        <form action={removeAction}>
          <input type="hidden" name="provider" value={provider} />
          <Button type="submit" variant="outline" disabled={removing}>
            {removing ? "Removing…" : "Remove workspace key"}
          </Button>
        </form>
      ) : null}
    </section>
  );
}
