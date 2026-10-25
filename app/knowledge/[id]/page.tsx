import { OrganizationRole } from "@prisma/client";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { deleteDocumentAction, deleteKnowledgeBaseAction, retryDocumentAction, updateKnowledgeBaseAction } from "@/app/actions/knowledge";
import { PasteDocumentForm, UploadDocumentForm, UrlDocumentForm } from "@/components/knowledge/ingest-forms";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getCurrentAuth } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getKnowledgeBaseForOrg } from "@/lib/knowledge/service";
import { hasOrgRole } from "@/lib/org/access";
import { cn } from "@/lib/utils";

export default async function KnowledgeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const auth = await getCurrentAuth();
  if (!auth?.activeOrganization) redirect("/sign-in");
  const { id } = await params;
  const loaded = await getKnowledgeBaseForOrg(prisma, auth.activeOrganization.id, id).catch(() => null);
  if (!loaded) notFound();
  const kb = loaded;
  const canManage = auth.activeMembership
    ? hasOrgRole(auth.activeMembership, OrganizationRole.ADMIN)
    : false;
  async function saveDetails(formData: FormData) {
    "use server";
    await updateKnowledgeBaseAction(id, {}, formData);
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{kb.name}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{kb.description || "No description"}</p>
        </div>
        <Link href="/knowledge" className={cn(buttonVariants({ variant: "outline" }))}>
          All knowledge bases
        </Link>
      </div>

      {canManage ? (
        <section className="rounded-2xl border bg-card p-6">
          <h2 className="font-semibold">Details</h2>
          <form action={saveDetails} className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" defaultValue={kb.name} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="description">Description</Label>
              <Input id="description" name="description" defaultValue={kb.description ?? ""} />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit">Save</Button>
            </div>
          </form>
        </section>
      ) : null}

      {canManage ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <section className="rounded-2xl border bg-card p-5">
            <h2 className="font-semibold">Upload a file</h2>
            <div className="mt-4">
              <UploadDocumentForm knowledgeBaseId={kb.id} />
            </div>
          </section>
          <section className="rounded-2xl border bg-card p-5">
            <h2 className="font-semibold">Paste text</h2>
            <div className="mt-4">
              <PasteDocumentForm knowledgeBaseId={kb.id} />
            </div>
          </section>
          <section className="rounded-2xl border bg-card p-5">
            <h2 className="font-semibold">Public URL</h2>
            <div className="mt-4">
              <UrlDocumentForm knowledgeBaseId={kb.id} />
            </div>
          </section>
        </div>
      ) : null}

      <section className="rounded-2xl border bg-card p-6">
        <h2 className="font-semibold">Documents</h2>
        {kb.documents.length ? (
          <ul className="mt-4 divide-y">
            {kb.documents.map((doc) => (
              <li key={doc.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div>
                  <p className="font-medium">{doc.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {doc.sourceType} · {doc.status}
                    {doc.attempts ? ` · ${doc.attempts} attempt${doc.attempts === 1 ? "" : "s"}` : ""}
                  </p>
                  {doc.errorMessage ? <p className="mt-1 text-xs text-destructive">{doc.errorMessage}</p> : null}
                </div>
                {canManage ? (
                  <div className="flex gap-2">
                    {doc.status === "FAILED" || doc.status === "PENDING" ? (
                      <form
                        action={async () => {
                          "use server";
                          await retryDocumentAction(kb.id, doc.id);
                        }}
                      >
                        <Button type="submit" size="sm" variant="outline">
                          Retry
                        </Button>
                      </form>
                    ) : null}
                    <form
                      action={async () => {
                        "use server";
                        await deleteDocumentAction(kb.id, doc.id);
                      }}
                    >
                      <Button type="submit" size="sm" variant="destructive">
                        Delete
                      </Button>
                    </form>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">No documents yet.</p>
        )}
      </section>

      {canManage ? (
        <form
          action={async () => {
            "use server";
            await deleteKnowledgeBaseAction(kb.id);
          }}
        >
          <Button type="submit" variant="destructive">
            Delete knowledge base
          </Button>
        </form>
      ) : null}
    </div>
  );
}
