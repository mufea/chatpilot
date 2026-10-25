import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";

const columns = [
  {
    title: "Product",
    links: [
      { href: "/features", label: "Features" },
      { href: "/pricing", label: "Pricing" },
      { href: "/use-cases", label: "Use cases" },
      { href: "/docs", label: "Documentation" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/contact", label: "Contact" },
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
    ],
  },
  {
    title: "Get started",
    links: [
      { href: "/sign-up", label: "Create account" },
      { href: "/sign-in", label: "Sign in" },
      { href: "/docs", label: "Embed the widget" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t bg-card">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-12 md:grid-cols-4">
        <div className="space-y-3">
          <BrandMark />
          <p className="max-w-xs text-sm text-muted-foreground">
            Multi-tenant AI chatbot software for teams that need real knowledge, real billing, and
            a widget they can trust on a customer site.
          </p>
        </div>
        {columns.map((column) => (
          <div key={column.title}>
            <p className="mb-3 text-sm font-semibold">{column.title}</p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="hover:text-foreground">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t">
        <div className="mx-auto flex w-full max-w-6xl justify-between px-4 py-4 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} ChatPilot AI. All rights reserved.</p>
          <p>Phase 1 foundation is live. Chat, RAG, and billing follow in later phases.</p>
        </div>
      </div>
    </footer>
  );
}
