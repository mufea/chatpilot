import type { Metadata } from "next";
import { ContactForm } from "@/components/forms/contact-form";

export const metadata: Metadata = { title: "Contact" };

export default function ContactPage() {
  return (
    <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-16 lg:grid-cols-2">
      <div>
        <h1 className="text-4xl font-semibold tracking-tight">Talk to the ChatPilot team</h1>
        <p className="mt-4 text-muted-foreground">
          Questions about tenancy, onboarding, or later-phase billing belong here. Messages are
          stored as outbound email records. They are not silently discarded.
        </p>
      </div>
      <div className="rounded-2xl border bg-card p-6">
        <ContactForm />
      </div>
    </div>
  );
}
