import { redirect } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";
import { getCurrentAuth } from "@/lib/auth/session";
import { isPlatformAdmin } from "@/lib/org/access";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const auth = await getCurrentAuth();
  if (!auth) redirect("/sign-in");
  if (!isPlatformAdmin(auth.user.platformRole)) redirect("/dashboard");
  return <AppShell>{children}</AppShell>;
}
