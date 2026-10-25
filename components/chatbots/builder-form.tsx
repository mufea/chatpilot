"use client";

import { useActionState, useMemo, useState } from "react";
import { updateChatbotAction } from "@/app/actions/chatbot";
import { PreviewPanel } from "@/components/chatbots/preview-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MODEL_CATALOG } from "@/lib/ai/models";
import type { FormState } from "@/lib/validators";

export type BuilderValues = {
  name: string;
  description: string;
  avatarUrl: string;
  brandColor: string;
  welcomeMessage: string;
  systemInstructions: string;
  persona: string;
  languages: string;
  provider: "openai" | "gemini" | "anthropic";
  model: string;
  temperature: number;
  maxResponseTokens: number;
  historyLimit: number;
  fallbackMessage: string;
  suggestedQuestions: string;
  conversationLimit: string;
  collectLeads: boolean;
  humanHandoffEnabled: boolean;
  handoffMessage: string;
  allowedDomains: string;
  showSources: boolean;
  fallbackEnabled: boolean;
  fallbackProvider: string;
};

export function BuilderForm({
  chatbotId,
  initial,
  canManage = true,
}: {
  chatbotId: string;
  initial: BuilderValues;
  canManage?: boolean;
}) {
  const bound = updateChatbotAction.bind(null, chatbotId);
  const [state, action, pending] = useActionState(bound, {} as FormState);
  const [values, setValues] = useState(initial);

  const models = useMemo(
    () => MODEL_CATALOG.filter((model) => model.provider === values.provider),
    [values.provider],
  );

  function set<K extends keyof BuilderValues>(key: K, value: BuilderValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <form action={action} className="space-y-6">
        <fieldset disabled={!canManage} className="space-y-6">
        {state.message ? (
          <p className={state.ok ? "text-sm text-primary" : "text-sm text-destructive"}>{state.message}</p>
        ) : null}
        <section className="space-y-3 rounded-2xl border bg-card p-5">
          <h2 className="font-semibold">Identity</h2>
          <Field label="Name" htmlFor="name">
            <Input id="name" name="name" value={values.name} onChange={(event) => set("name", event.target.value)} required />
          </Field>
          <Field label="Description" htmlFor="description">
            <Input
              id="description"
              name="description"
              value={values.description}
              onChange={(event) => set("description", event.target.value)}
            />
          </Field>
          <Field label="Avatar URL" htmlFor="avatarUrl">
            <Input
              id="avatarUrl"
              name="avatarUrl"
              value={values.avatarUrl}
              onChange={(event) => set("avatarUrl", event.target.value)}
            />
          </Field>
          <Field label="Brand color" htmlFor="brandColor">
            <Input
              id="brandColor"
              name="brandColor"
              value={values.brandColor}
              onChange={(event) => set("brandColor", event.target.value)}
            />
          </Field>
        </section>
        <section className="space-y-3 rounded-2xl border bg-card p-5">
          <h2 className="font-semibold">Conversation</h2>
          <Field label="Welcome message" htmlFor="welcomeMessage">
            <Textarea
              id="welcomeMessage"
              name="welcomeMessage"
              value={values.welcomeMessage}
              onChange={(event) => set("welcomeMessage", event.target.value)}
            />
          </Field>
          <Field label="Business instructions" htmlFor="systemInstructions">
            <Textarea
              id="systemInstructions"
              name="systemInstructions"
              rows={6}
              value={values.systemInstructions}
              onChange={(event) => set("systemInstructions", event.target.value)}
            />
          </Field>
          <Field label="Persona" htmlFor="persona">
            <Input id="persona" name="persona" value={values.persona} onChange={(event) => set("persona", event.target.value)} />
          </Field>
          <Field label="Languages (comma or newline)" htmlFor="languages">
            <Input id="languages" name="languages" value={values.languages} onChange={(event) => set("languages", event.target.value)} />
          </Field>
          <Field label="Suggested questions (one per line)" htmlFor="suggestedQuestions">
            <Textarea
              id="suggestedQuestions"
              name="suggestedQuestions"
              value={values.suggestedQuestions}
              onChange={(event) => set("suggestedQuestions", event.target.value)}
            />
          </Field>
          <Field label="Fallback message" htmlFor="fallbackMessage">
            <Textarea
              id="fallbackMessage"
              name="fallbackMessage"
              value={values.fallbackMessage}
              onChange={(event) => set("fallbackMessage", event.target.value)}
            />
          </Field>
        </section>
        <section className="space-y-3 rounded-2xl border bg-card p-5">
          <h2 className="font-semibold">Model</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Provider" htmlFor="provider">
              <select
                id="provider"
                name="provider"
                className="h-8 w-full rounded-lg border bg-background px-2 text-sm"
                value={values.provider}
                onChange={(event) => {
                  const provider = event.target.value as BuilderValues["provider"];
                  const nextModel = MODEL_CATALOG.find((model) => model.provider === provider)?.id ?? values.model;
                  setValues((current) => ({ ...current, provider, model: nextModel }));
                }}
              >
                <option value="openai">OpenAI</option>
                <option value="gemini">Google Gemini</option>
                <option value="anthropic">Anthropic Claude</option>
              </select>
            </Field>
            <Field label="Model" htmlFor="model">
              <select
                id="model"
                name="model"
                className="h-8 w-full rounded-lg border bg-background px-2 text-sm"
                value={values.model}
                onChange={(event) => set("model", event.target.value)}
              >
                {models.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.label}
                    {!model.capabilities.streaming ? " (no stream)" : ""}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Temperature" htmlFor="temperature">
              <Input
                id="temperature"
                name="temperature"
                type="number"
                step="0.1"
                min="0"
                max="2"
                value={values.temperature}
                onChange={(event) => set("temperature", Number(event.target.value))}
              />
            </Field>
            <Field label="Max response tokens" htmlFor="maxResponseTokens">
              <Input
                id="maxResponseTokens"
                name="maxResponseTokens"
                type="number"
                value={values.maxResponseTokens}
                onChange={(event) => set("maxResponseTokens", Number(event.target.value))}
              />
            </Field>
            <Field label="History messages" htmlFor="historyLimit">
              <Input
                id="historyLimit"
                name="historyLimit"
                type="number"
                value={values.historyLimit}
                onChange={(event) => set("historyLimit", Number(event.target.value))}
              />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="fallbackEnabled"
              checked={values.fallbackEnabled}
              onChange={(event) => {
                const enabled = event.target.checked;
                const fallback =
                  values.fallbackProvider ||
                  (["openai", "gemini", "anthropic"] as const).find((item) => item !== values.provider) ||
                  "gemini";
                setValues((current) => ({ ...current, fallbackEnabled: enabled, fallbackProvider: fallback }));
              }}
            />
            Enable fallback provider
          </label>
          {values.fallbackEnabled ? (
            <Field label="Fallback provider" htmlFor="fallbackProvider">
              <select
                id="fallbackProvider"
                name="fallbackProvider"
                className="h-8 w-full rounded-lg border bg-background px-2 text-sm"
                value={values.fallbackProvider}
                onChange={(event) => set("fallbackProvider", event.target.value)}
              >
                {(["openai", "gemini", "anthropic"] as const)
                  .filter((provider) => provider !== values.provider)
                  .map((provider) => (
                    <option key={provider} value={provider}>
                      {provider}
                    </option>
                  ))}
              </select>
            </Field>
          ) : null}
        </section>
        <section className="space-y-3 rounded-2xl border bg-card p-5">
          <h2 className="font-semibold">Limits and handoff</h2>
          <Field label="Conversation message limit" htmlFor="conversationLimit">
            <Input
              id="conversationLimit"
              name="conversationLimit"
              value={values.conversationLimit}
              onChange={(event) => set("conversationLimit", event.target.value)}
              placeholder="Unlimited"
            />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="collectLeads"
              checked={values.collectLeads}
              onChange={(event) => set("collectLeads", event.target.checked)}
            />
            Collect leads (widget, later phase)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="humanHandoffEnabled"
              checked={values.humanHandoffEnabled}
              onChange={(event) => set("humanHandoffEnabled", event.target.checked)}
            />
            Allow human handoff (inbox, later phase)
          </label>
          <Field label="Handoff message" htmlFor="handoffMessage">
            <Input
              id="handoffMessage"
              name="handoffMessage"
              value={values.handoffMessage}
              onChange={(event) => set("handoffMessage", event.target.value)}
            />
          </Field>
          <Field label="Allowed website domains (one per line)" htmlFor="allowedDomains">
            <Textarea
              id="allowedDomains"
              name="allowedDomains"
              value={values.allowedDomains}
              onChange={(event) => set("allowedDomains", event.target.value)}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="showSources"
              checked={values.showSources}
              onChange={(event) => set("showSources", event.target.checked)}
            />
            Show sources when retrieval is available
          </label>
        </section>
        {canManage ? (
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save chatbot"}
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">Agents can view configuration and use the playground.</p>
        )}
        </fieldset>
      </form>
      <PreviewPanel
        name={values.name}
        welcomeMessage={values.welcomeMessage}
        suggestedQuestions={values.suggestedQuestions.split(/\r?\n/).map((item) => item.trim()).filter(Boolean)}
        brandColor={values.brandColor}
        fallbackMessage={values.fallbackMessage}
      />
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}
