import type { Metadata } from "next";

export const metadata: Metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <article className="mx-auto w-full max-w-3xl space-y-6 px-4 py-16">
      <h1 className="text-4xl font-semibold tracking-tight">Terms of Service</h1>
      <p className="text-sm text-muted-foreground">Last updated 25 October 2026.</p>
      <p>
        ChatPilot AI is provided as multi-tenant software. You are responsible for the content you
        upload, the instructions you give chatbots, and the websites where you embed a widget.
      </p>
      <p>
        You may not attempt to access another organization&apos;s data, probe internal services
        through document or URL ingestion, or use the service to generate illegal content.
      </p>
      <p>
        Paid plans, when enabled, renew until canceled. Entitlements change only after a verified
        billing event. Unused credits do not constitute a cash balance.
      </p>
      <p>
        The service is provided as-is during the current build-out. Features marked as later
        phases are not contractual commitments until they are implemented and documented.
      </p>
    </article>
  );
}
