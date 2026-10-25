import { OrganizationRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { CreateChatbotForm } from "@/components/chatbots/create-form";
import { getCurrentAuth } from "@/lib/auth/session";
import { hasOrgRole } from "@/lib/org/access";

export default async function NewChatbotPage() {
  const auth = await getCurrentAuth();
  if (!auth?.activeOrganization) redirect("/sign-in");
  if (!auth.activeMembership || !hasOrgRole(auth.activeMembership, OrganizationRole.ADMIN)) {
    redirect("/chatbots");
  }
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Create a chatbot</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You can configure provider, instructions, and branding after the bot is created.
        </p>
      </div>
      <div className="rounded-2xl border bg-card p-6">
        <CreateChatbotForm />
      </div>
    </div>
  );
}
