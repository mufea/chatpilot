"use client";

import { useActionState } from "react";
import { createChatbotAction } from "@/app/actions/chatbot";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FormState } from "@/lib/validators";

export function CreateChatbotForm() {
  const [state, action, pending] = useActionState(createChatbotAction, {} as FormState);
  return (
    <form action={action} className="max-w-lg space-y-4">
      {state.message ? <p className="text-sm text-destructive">{state.message}</p> : null}
      <div className="space-y-1.5">
        <Label htmlFor="name">Chatbot name</Label>
        <Input id="name" name="name" required placeholder="Harbor Assistant" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="description">Description</Label>
        <Input id="description" name="description" placeholder="Answers store hours and returns" />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create chatbot"}
      </Button>
    </form>
  );
}
