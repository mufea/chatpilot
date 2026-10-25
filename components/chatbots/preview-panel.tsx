"use client";

type PreviewPanelProps = {
  name: string;
  welcomeMessage: string;
  suggestedQuestions: string[];
  brandColor: string;
  fallbackMessage: string;
};

export function PreviewPanel({
  name,
  welcomeMessage,
  suggestedQuestions,
  brandColor,
  fallbackMessage,
}: PreviewPanelProps) {
  return (
    <div className="flex h-[640px] flex-col overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="flex items-center gap-3 border-b px-4 py-3" style={{ borderColor: `${brandColor}33` }}>
        <div
          className="flex size-10 items-center justify-center rounded-full text-sm font-semibold text-white"
          style={{ backgroundColor: brandColor }}
        >
          {name.slice(0, 2).toUpperCase() || "AI"}
        </div>
        <div>
          <p className="text-sm font-semibold">{name || "Untitled chatbot"}</p>
          <p className="text-xs text-muted-foreground">Live preview · configuration only</p>
        </div>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        <div className="max-w-[90%] rounded-2xl px-3 py-2 text-sm text-white" style={{ backgroundColor: brandColor }}>
          {welcomeMessage || "Hi! How can I help you today?"}
        </div>
        <div className="max-w-[80%] rounded-2xl bg-muted px-3 py-2 text-sm text-muted-foreground">
          Preview does not call a model. Use Playground to send a real request.
        </div>
        {fallbackMessage ? (
          <div className="text-xs text-muted-foreground">Fallback: {fallbackMessage}</div>
        ) : null}
      </div>
      <div className="space-y-3 border-t px-4 py-3">
        <div className="flex flex-wrap gap-2">
          {suggestedQuestions.length ? (
            suggestedQuestions.map((question) => (
              <span key={question} className="rounded-full border px-3 py-1 text-xs">
                {question}
              </span>
            ))
          ) : (
            <span className="text-xs text-muted-foreground">Add suggested questions to show them here.</span>
          )}
        </div>
        <div className="h-8 rounded-lg border bg-muted/40 px-3 text-sm leading-8 text-muted-foreground">
          Visitor message
        </div>
      </div>
    </div>
  );
}
