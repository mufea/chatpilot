"use client";

import { useMemo, useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type DemoMessage = {
  role: "visitor" | "bot";
  text: string;
};

const REPLIES: Record<string, string> = {
  hours:
    "North Harbor Books is open 10:00–19:00 on weekdays and 11:00–17:00 on weekends. Holiday hours are posted on the store homepage.",
  return:
    "Unopened books can be returned within 30 days with a receipt. Opened books can be exchanged for store credit within 14 days.",
  shipping:
    "Domestic orders placed before 14:00 local time ship the same day. Standard delivery is 2–5 business days.",
  default:
    "This preview uses scripted answers so you can judge the widget, not a live model. After you connect a provider in a later phase, published bots will stream real replies with citations.",
};

const SUGGESTIONS = [
  "What are your store hours?",
  "How do returns work?",
  "Do you ship same day?",
];

export function DemoChat() {
  const [messages, setMessages] = useState<DemoMessage[]>([
    {
      role: "bot",
      text: "Hi, I am Harbor, the North Harbor Books assistant. Ask about hours, returns, or shipping to see how a trained bot will feel on your site.",
    },
  ]);
  const [value, setValue] = useState("");
  const [pending, setPending] = useState(false);

  const transcript = useMemo(() => messages, [messages]);

  function replyTo(text: string) {
    const lower = text.toLowerCase();
    if (lower.includes("hour") || lower.includes("open")) return REPLIES.hours;
    if (lower.includes("return") || lower.includes("refund")) return REPLIES.return;
    if (lower.includes("ship") || lower.includes("delivery")) return REPLIES.shipping;
    return REPLIES.default;
  }

  function ask(text: string) {
    const trimmed = text.trim();
    if (!trimmed || pending) return;
    setPending(true);
    setMessages((current) => [...current, { role: "visitor", text: trimmed }]);
    setValue("");
    window.setTimeout(() => {
      setMessages((current) => [...current, { role: "bot", text: replyTo(trimmed) }]);
      setPending(false);
    }, 450);
  }

  return (
    <div className="flex h-[520px] flex-col overflow-hidden rounded-2xl border bg-card shadow-xl">
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <div className="flex size-10 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
          NH
        </div>
        <div>
          <p className="text-sm font-semibold">Harbor Assistant</p>
          <p className="text-xs text-muted-foreground">Interactive preview · scripted replies</p>
        </div>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {transcript.map((message, index) => (
          <div
            key={`${message.role}-${index}`}
            className={message.role === "visitor" ? "flex justify-end" : "flex justify-start"}
          >
            <div
              className={
                message.role === "visitor"
                  ? "max-w-[85%] rounded-2xl bg-primary px-3 py-2 text-sm text-primary-foreground"
                  : "max-w-[85%] rounded-2xl bg-muted px-3 py-2 text-sm"
              }
            >
              {message.text}
            </div>
          </div>
        ))}
        {pending ? (
          <div className="text-xs text-muted-foreground">Harbor is typing…</div>
        ) : null}
      </div>
      <div className="space-y-3 border-t px-4 py-3">
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              className="rounded-full border px-3 py-1 text-xs hover:bg-muted"
              onClick={() => ask(suggestion)}
            >
              {suggestion}
            </button>
          ))}
        </div>
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            ask(value);
          }}
        >
          <Input
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="Ask a preview question"
            aria-label="Preview question"
          />
          <Button type="submit" size="icon" aria-label="Send preview message">
            <Send className="size-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
