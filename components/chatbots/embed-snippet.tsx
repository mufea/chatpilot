"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

export function EmbedSnippet({
  publicId,
  status,
  allowedDomains,
  appUrl,
}: {
  publicId: string;
  status: string;
  allowedDomains: string[];
  appUrl: string;
}) {
  const [copied, setCopied] = useState(false);
  const snippet = useMemo(() => {
    const origin = appUrl.replace(/\/$/, "");
    return `<script
  src="${origin}/widget.js"
  data-chatbot-id="${publicId}"
  async
></script>`;
  }, [appUrl, publicId]);

  const ready = status === "PUBLISHED" && allowedDomains.length > 0;

  return (
    <section className="space-y-3 rounded-2xl border bg-card p-5">
      <div>
        <h2 className="font-semibold">Website embed</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Use the public chatbot id only. Provider keys, system instructions, and the internal
          chatbot id stay on the server. The widget loads <code>/widget/v1.js</code> inside a
          Shadow DOM so host-page styles cannot leak in.
        </p>
      </div>
      {!ready ? (
        <p className="rounded-xl border border-amber-300/60 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          {status !== "PUBLISHED"
            ? "Publish the chatbot before websites can load the widget."
            : "Add at least one allowed website domain. An empty allowlist rejects every public embed."}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Allowed on {allowedDomains.join(", ")}. Requests from any other origin receive 403.
        </p>
      )}
      <pre className="overflow-x-auto rounded-xl bg-muted p-4 text-xs">{snippet}</pre>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={async () => {
            await navigator.clipboard.writeText(snippet);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1600);
          }}
        >
          {copied ? "Copied" : "Copy snippet"}
        </Button>
        <p className="self-center text-xs text-muted-foreground">
          Public id <span className="font-mono">{publicId}</span>
        </p>
      </div>
    </section>
  );
}
