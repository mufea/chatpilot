import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <article className="mx-auto w-full max-w-3xl space-y-6 px-4 py-16">
      <h1 className="text-4xl font-semibold tracking-tight">Privacy Policy</h1>
      <p className="text-sm text-muted-foreground">Last updated 25 October 2026.</p>
      <p>
        ChatPilot AI collects the account information you submit: name, email, workspace name, and
        optional profile details. Session tokens, verification tokens, and API keys are stored as
        hashes. Passwords are stored only as bcrypt hashes.
      </p>
      <p>
        Conversation content, uploaded documents, and visitor identifiers will be stored only when
        those features ship, and only inside the organization that owns them. ChatPilot does not
        log full conversation contents by default.
      </p>
      <p>
        You can export your account data from Settings and request deletion. Deletion anonymizes
        your user record, revokes sessions, and soft-deletes workspaces you solely own.
      </p>
      <p>
        If we add optional analytics or error reporting later, those tools will receive operational
        metadata, not provider secrets or unrelated tenant data.
      </p>
    </article>
  );
}
