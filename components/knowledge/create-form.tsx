"use client";

import { useActionState } from "react";
import { createKnowledgeBaseAction } from "@/app/actions/knowledge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FormState } from "@/lib/validators";

export function CreateKnowledgeForm() {
  const [state, action, pending] = useActionState(createKnowledgeBaseAction, {} as FormState);
  return (
    <form action={action} className="max-w-lg space-y-4">
      {state.message ? <p className="text-sm text-destructive">{state.message}</p> : null}
      <div className="space-y-1.5">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" required placeholder="Store policies" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="description">Description</Label>
        <Input id="description" name="description" placeholder="Hours, returns, and shipping" />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create knowledge base"}
      </Button>
    </form>
  );
}
