import { redirect } from "next/navigation";
import { SettingsNav } from "@/components/app/settings-nav";
import { ProviderKeyForm } from "@/components/forms/provider-forms";
import { listOrganizationProviderStatus } from "@/lib/ai/credentials";
import { getCurrentAuth } from "@/lib/auth/session";
import { appConfig } from "@/lib/config";
import { prisma } from "@/lib/db";
import { canManageMembers } from "@/lib/org/access";

export default async function ProviderSettingsPage() {
  const auth = await getCurrentAuth();
  if (!auth?.activeOrganization) redirect("/sign-in");
  const providers = await listOrganizationProviderStatus(prisma, auth.activeOrganization.id);
  const canManage = auth.activeMembership ? canManageMembers(auth.activeMembership.role) : false;

  return (
    <div className="space-y-8">
      <SettingsNav current="/settings/providers" />
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">AI providers</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Keys stay on the server and are encrypted with APP_ENCRYPTION_KEY. They are never returned
          to the browser. {appConfig.aiMockMode ? "AI_MOCK_MODE is on, so playground replies use the mock adapter." : "Live provider calls are enabled."}
        </p>
      </div>
      {providers.map((item) => (
        <ProviderKeyForm
          key={item.provider}
          provider={item.provider}
          hasCustomerKey={item.hasCustomerKey}
          hasPlatformKey={item.hasPlatformKey}
          canManage={canManage}
        />
      ))}
    </div>
  );
}
