"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";
import { addPastedDocumentAction, addUrlDocumentAction } from "@/app/actions/knowledge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { FormState } from "@/lib/validators";

export function PasteDocumentForm({ knowledgeBaseId }: { knowledgeBaseId: string }) {
  const bound = addPastedDocumentAction.bind(null, knowledgeBaseId);
  const [state, action, pending] = useActionState(bound, {} as FormState);
  return (
    <form action={action} className="space-y-3">
      {state.message ? (
        <p className={state.ok ? "text-sm text-primary" : "text-sm text-destructive"}>{state.message}</p>
      ) : null}
      <div className="space-y-1.5">
        <Label htmlFor="title">Title</Label>
        <Input id="title" name="title" required placeholder="Return policy" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="text">Text</Label>
        <Textarea id="text" name="text" rows={6} required placeholder="Paste FAQs or policy text" />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="faq" />
        Treat as FAQ pairs (Q:/A: or question|answer)
      </label>
      <Button type="submit" disabled={pending}>
        {pending ? "Ingesting…" : "Add text"}
      </Button>
    </form>
  );
}

export function UrlDocumentForm({ knowledgeBaseId }: { knowledgeBaseId: string }) {
  const bound = addUrlDocumentAction.bind(null, knowledgeBaseId);
  const [state, action, pending] = useActionState(bound, {} as FormState);
  return (
    <form action={action} className="space-y-3">
      {state.message ? (
        <p className={state.ok ? "text-sm text-primary" : "text-sm text-destructive"}>{state.message}</p>
      ) : null}
      <div className="space-y-1.5">
        <Label htmlFor="url">Public URL</Label>
        <Input id="url" name="url" required placeholder="https://example.com/help" />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="sitemap" />
        This is a sitemap (same-origin pages only)
      </label>
      <Button type="submit" disabled={pending}>
        {pending ? "Checking…" : "Add URL"}
      </Button>
    </form>
  );
}

export function UploadDocumentForm({ knowledgeBaseId }: { knowledgeBaseId: string }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    data.set("knowledgeBaseId", knowledgeBaseId);
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch("/api/knowledge/upload", { method: "POST", body: data });
      const json = (await response.json()) as { error?: string; status?: string; title?: string };
      if (!response.ok) {
        setOk(false);
        setMessage(json.error ?? "Upload failed.");
        return;
      }
      setOk(true);
      setMessage(`${json.title ?? "File"} is ${json.status?.toLowerCase() ?? "processed"}.`);
      form.reset();
      router.refresh();
    } catch {
      setOk(false);
      setMessage("Upload failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {message ? <p className={ok ? "text-sm text-primary" : "text-sm text-destructive"}>{message}</p> : null}
      <div className="space-y-1.5">
        <Label htmlFor="file">File (.txt, .md, .csv, .pdf, .docx)</Label>
        <Input id="file" name="file" type="file" required accept=".txt,.md,.markdown,.csv,.pdf,.docx" />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Uploading…" : "Upload file"}
      </Button>
    </form>
  );
}
