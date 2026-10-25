import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Bot,
  CreditCard,
  Inbox,
  LayoutDashboard,
  Library,
  Settings,
  Shield,
} from "lucide-react";
import { signOutAction } from "@/app/actions/auth";
import { OrgSwitcher } from "@/components/app/org-switcher";
import { BrandMark } from "@/components/brand-mark";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button, buttonVariants } from "@/components/ui/button";
import { getCurrentAuth } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/chatbots", label: "Chatbots", icon: Bot },
  { href: "/knowledge", label: "Knowledge", icon: Library },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/billing", label: "Billing", icon: CreditCard },
  { href: "/settings/organization", label: "Settings", icon: Settings },
];

export async function AppShell({ children }: { children: React.ReactNode }) {
  const auth = await getCurrentAuth();
  if (!auth) redirect("/sign-in");

  return (
    <div className="min-h-screen bg-muted/40">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r bg-card p-4 lg:block">
        <Link href="/dashboard">
          <BrandMark />
        </Link>
        <nav className="mt-8 space-y-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          ))}
          {auth.user.platformRole === "SUPER_ADMIN" ? (
            <Link
              href="/admin"
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Shield className="size-4" />
              Platform admin
            </Link>
          ) : null}
        </nav>
      </aside>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b bg-background/80 px-4 py-3 backdrop-blur-md">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {auth.activeOrganization?.name ?? "No workspace"}
            </p>
            <p className="truncate text-xs text-muted-foreground">{auth.user.email}</p>
          </div>
          <div className="flex items-center gap-2">
            <OrgSwitcher
              activeId={auth.activeOrganization?.id}
              organizations={auth.memberships.map((membership) => ({
                id: membership.organizationId,
                name: membership.organization.name,
              }))}
            />
            <Link href="/settings/profile" className={cn(buttonVariants({ variant: "ghost" }))}>
              Profile
            </Link>
            <ThemeToggle />
            <form action={signOutAction}>
              <Button type="submit" variant="outline">
                Sign out
              </Button>
            </form>
          </div>
        </header>
        <div className="flex gap-2 overflow-x-auto border-b px-4 py-2 lg:hidden">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
              {item.label}
            </Link>
          ))}
        </div>
        <main className="mx-auto w-full max-w-6xl px-4 py-8">{children}</main>
      </div>
    </div>
  );
}
