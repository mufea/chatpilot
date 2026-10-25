import Link from "next/link";
import { CheckCircle2, Globe, Lock, Sparkles, Workflow } from "lucide-react";
import { DemoChat } from "@/components/marketing/demo-chat";
import { buttonVariants } from "@/components/ui/button";
import { DEFAULT_PLANS, formatPlanPrice } from "@/lib/plans";
import { cn } from "@/lib/utils";

const benefits = [
  {
    title: "Own the conversation",
    body: "Each tenant gets isolated chatbots, knowledge, and members. Organization IDs from the browser are never trusted on their own.",
    icon: Lock,
  },
  {
    title: "Train on your sources",
    body: "Upload documents, paste FAQs, and attach websites. Retrieval and citations land in Phase 3; the data model is already in place.",
    icon: Workflow,
  },
  {
    title: "Ship a widget, not a demo",
    body: "The public embed will use a public chatbot ID, origin allowlists, and visitor sessions. No provider keys ever leave the server.",
    icon: Globe,
  },
  {
    title: "Bill on usage you can audit",
    body: "Plans, credit ledgers, and webhook events are modeled now. Entitlements will change only after verified payment events.",
    icon: Sparkles,
  },
];

const steps = [
  { title: "Create a workspace", body: "Register, verify email, and invite teammates with role-based access." },
  { title: "Configure a chatbot", body: "Use the builder, choose a provider, and test in the playground." },
  { title: "Attach knowledge", body: "Upload files or public URLs. Retrieval stays tenant-scoped and cites sources." },
  { title: "Embed and measure", body: "Phase 4–7 add the widget, inbox, billing, and the admin console." },
];

const faqs = [
  {
    q: "Is this a UI prototype?",
    a: "No. Registration, sessions, organizations, invitations, email verification, password reset, and tenant isolation are implemented against PostgreSQL.",
  },
  {
    q: "Can I talk to a live model today?",
    a: "Yes, in the signed-in playground. With AI_MOCK_MODE the reply is deterministic. Set a platform or workspace key and AI_MOCK_MODE=false to call OpenAI, Gemini, or Anthropic.",
  },
  {
    q: "How are secrets handled?",
    a: "Session cookies are httpOnly. Passwords are hashed. Provider keys stay on the server. Configuration checks never print secret values.",
  },
  {
    q: "What happens if I delete my account?",
    a: "ChatPilot anonymizes your user, revokes sessions, removes memberships, and soft-deletes workspaces you solely own. You can export your account first.",
  },
];

export default function HomePage() {
  return (
    <div>
      <section className="bg-[radial-gradient(circle_at_top,_oklch(0.93_0.04_250),_transparent_50%)]">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 py-16 lg:grid-cols-2 lg:py-24">
          <div className="space-y-6">
            <p className="inline-flex rounded-full border bg-card px-3 py-1 text-xs font-medium text-primary">
              Production-minded chatbot SaaS
            </p>
            <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              Launch customer-ready AI chatbots without writing code.
            </h1>
            <p className="max-w-xl text-lg text-muted-foreground">
              ChatPilot AI gives businesses, stores, and agencies a workspace to create, train,
              and deploy site chatbots. Phase 2 ships the builder and playground on top of the
              identity and tenancy foundation.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link href="/sign-up" className={cn(buttonVariants({ size: "lg" }))}>
                Start a free workspace
              </Link>
              <Link href="/pricing" className={cn(buttonVariants({ size: "lg", variant: "outline" }))}>
                Compare plans
              </Link>
            </div>
            <ul className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
              {[
                "Email verification and password reset",
                "Organization roles and invitations",
                "Auditable credit ledger schema",
                "No fake success states",
              ].map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-primary" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <DemoChat />
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-16">
        <h2 className="text-3xl font-semibold tracking-tight">Why teams choose ChatPilot</h2>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          The product is built as a modular monolith: one Next.js app, PostgreSQL, and clear
          phase gates. Features are marked complete only after they run against real data.
        </p>
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {benefits.map((benefit) => (
            <article key={benefit.title} className="rounded-2xl border bg-card p-6">
              <benefit.icon className="mb-4 size-5 text-primary" />
              <h3 className="text-lg font-semibold">{benefit.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{benefit.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-card">
        <div className="mx-auto w-full max-w-6xl px-4 py-16">
          <h2 className="text-3xl font-semibold tracking-tight">How it works</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-4">
            {steps.map((step, index) => (
              <article key={step.title} className="rounded-2xl border p-5">
                <p className="text-xs font-semibold text-primary">0{index + 1}</p>
                <h3 className="mt-2 font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{step.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-16">
        <h2 className="text-3xl font-semibold tracking-tight">Supported AI providers</h2>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Phase 2 will add adapters for OpenAI, Google Gemini, and Anthropic Claude. Models are
          selected per chatbot. Missing credentials will be reported instead of mocked in production.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {["OpenAI", "Google Gemini", "Anthropic Claude"].map((provider) => (
            <div key={provider} className="rounded-2xl border bg-card px-5 py-8 text-center font-semibold">
              {provider}
            </div>
          ))}
        </div>
      </section>

      <section className="bg-card">
        <div className="mx-auto w-full max-w-6xl px-4 py-16">
          <h2 className="text-3xl font-semibold tracking-tight">Transparent starting plans</h2>
          <p className="mt-3 text-muted-foreground">
            Prices are product defaults and can be edited in the admin panel in Phase 7. Billing
            does not activate from a browser redirect.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-4">
            {DEFAULT_PLANS.map((plan) => (
              <article
                key={plan.code}
                className={cn(
                  "flex flex-col rounded-2xl border p-5",
                  plan.highlighted && "border-primary shadow-lg",
                )}
              >
                <p className="text-sm font-medium text-primary">{plan.name}</p>
                <p className="mt-2 text-3xl font-semibold">
                  {formatPlanPrice(plan.monthlyPriceCents, plan.currency)}
                  {plan.monthlyPriceCents > 0 ? (
                    <span className="text-sm font-normal text-muted-foreground">/mo</span>
                  ) : null}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">{plan.description}</p>
                <ul className="mt-4 flex-1 space-y-2 text-sm">
                  {plan.features.slice(0, 4).map((feature) => (
                    <li key={feature} className="flex gap-2">
                      <CheckCircle2 className="mt-0.5 size-4 text-primary" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-16">
        <h2 className="text-3xl font-semibold tracking-tight">Frequently asked questions</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {faqs.map((item) => (
            <article key={item.q} className="rounded-2xl border bg-card p-5">
              <h3 className="font-semibold">{item.q}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{item.a}</p>
            </article>
          ))}
        </div>
        <div className="mt-12 rounded-3xl bg-primary px-8 py-10 text-primary-foreground">
          <h2 className="text-3xl font-semibold">Create your workspace</h2>
          <p className="mt-2 max-w-2xl text-primary-foreground/80">
            Register now to get a verified account, an isolated organization, and a Free plan
            trial. Chatbot publishing waits for Phase 2.
          </p>
          <Link
            href="/sign-up"
            className={cn(buttonVariants({ size: "lg", variant: "secondary" }), "mt-6")}
          >
            Get started
          </Link>
        </div>
      </section>
    </div>
  );
}
