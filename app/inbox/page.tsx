export default function InboxPage() {
  return (
    <div className="rounded-2xl border bg-card p-8">
      <h1 className="text-2xl font-semibold">Inbox</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Live conversations, assignment, and human handoff are not shipped. There is no fake inbox
        activity here. Billing, admin, and analytics are available under their own routes.
      </p>
    </div>
  );
}
