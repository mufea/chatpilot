import Link from "next/link";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/settings/profile", label: "Profile" },
  { href: "/settings/organization", label: "Workspace" },
  { href: "/settings/members", label: "Members" },
  { href: "/settings/providers", label: "AI providers" },
];

export function SettingsNav({ current }: { current: string }) {
  return (
    <nav className="flex flex-wrap gap-2">
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={cn(
            "rounded-full border px-3 py-1 text-sm",
            current === link.href ? "border-primary bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-muted",
          )}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
