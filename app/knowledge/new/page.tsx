import { OrganizationRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { CreateKnowledgeForm } from "@/components/knowledge/create-form";
import { getCurrentAuth } from "@/lib/auth/session";
import { hasOrgRole } from "@/lib/org/access";

export default async function NewKnowledgePage() {
  const auth = await getCurrentAuth();
  if (!auth?.activeOrganization) redirect("/sign-in");
  if (!auth.activeMembership || !hasOrgRole(auth.activeMembership, OrganizationRole.ADMIN)) {
    redirect("/knowledge");
  }
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Create a knowledge base</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Add files, pasted text, or public URLs after the base exists.
        </p>
      </div>
      <div className="rounded-2xl border bg-card p-6">
        <CreateKnowledgeForm />
      </div>
    </div>
  );
}
