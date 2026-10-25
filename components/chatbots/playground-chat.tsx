"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ChatItem = { role: "user" | "assistant"; content: string };

export function PlaygroundChat({
  chatbotId,
  welcomeMessage,
  suggestedQuestions,
  mockMode,
  brandColor,
}: {
  chatbotId: string;
  welcomeMessage: string;
  suggestedQuestions: string[];
  mockMode: boolean;
  brandColor: string;
}) {
  const [messages, setMessages] = useState<ChatItem[]>([{ role: "assistant", content: welcomeMessage }]);
  const [value, setValue] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [usage, setUsage] = useState<string | null>(null);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || pending) return;
    setPending(true);
    setError(null);
    setValue("");
    setMessages((current) => [...current, { role: "user", content: trimmed }, { role: "assistant", content: "" }]);

    try {
      const response = await fetch(`/api/chatbots/${chatbotId}/play`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: trimmed, conversationId }),
      });
      if (!response.ok || !response.body) {
        throw new Error("The playground request failed.");
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value: chunk } = await reader.read();
        if (done) break;
        buffer += decoder.decode(chunk, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          const data = part.replace(/^data:\s*/, "");
          if (!data) continue;
          const event = JSON.parse(data) as {
            type: string;
            text?: string;
            conversationId?: string;
            message?: string;
            credits?: number;
            provider?: string;
            model?: string;
            usage?: { inputTokens: number; outputTokens: number; source: string };
          };
          if (event.type === "conversation" && event.conversationId) {
            setConversationId(event.conversationId);
          }
          if (event.type === "delta" && event.text) {
            setMessages((current) => {
              const next = [...current];
              const last = next[next.length - 1];
              if (last?.role === "assistant") {
                next[next.length - 1] = { role: "assistant", content: last.content + event.text };
              }
              return next;
            });
          }
          if (event.type === "usage" && event.usage) {
            setUsage(
              `${event.provider}/${event.model} · ${event.usage.inputTokens}+${event.usage.outputTokens} tokens (${event.usage.source}) · ${event.credits} credit(s)`,
            );
          }
          if (event.type === "error") {
            setError(event.message ?? "The model request failed.");
          }
        }
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The model request failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-[640px] flex-col overflow-hidden rounded-2xl border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <p className="text-sm font-semibold">Playground</p>
          <p className="text-xs text-muted-foreground">
            {mockMode
              ? "AI_MOCK_MODE is on. Replies come from the deterministic mock adapter, not a live vendor."
              : "Requests use the selected provider. Missing keys are reported as errors."}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setConversationId(null);
            setMessages([{ role: "assistant", content: welcomeMessage }]);
            setUsage(null);
            setError(null);
          }}
        >
          Restart
        </Button>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.map((message, index) => (
          <div key={`${message.role}-${index}`} className={message.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={
                message.role === "user"
                  ? "max-w-[85%] rounded-2xl px-3 py-2 text-sm text-white"
                  : "max-w-[85%] rounded-2xl bg-muted px-3 py-2 text-sm"
              }
              style={message.role === "user" ? { backgroundColor: brandColor } : undefined}
            >
              {message.content || (pending ? "…" : "")}
            </div>
          </div>
        ))}
      </div>
      <div className="space-y-3 border-t px-4 py-3">
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {usage ? <p className="text-xs text-muted-foreground">{usage}</p> : null}
        <div className="flex flex-wrap gap-2">
          {suggestedQuestions.map((question) => (
            <button
              key={question}
              type="button"
              className="rounded-full border px-3 py-1 text-xs hover:bg-muted"
              onClick={() => send(question)}
            >
              {question}
            </button>
          ))}
        </div>
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void send(value);
          }}
        >
          <Input value={value} onChange={(event) => setValue(event.target.value)} placeholder="Ask the chatbot" />
          <Button type="submit" disabled={pending}>
            {pending ? "Sending" : "Send"}
          </Button>
        </form>
      </div>
    </div>
  );
}
