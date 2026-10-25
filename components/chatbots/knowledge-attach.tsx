import { setChatbotKnowledgeAction } from "@/app/actions/knowledge";
import { Button } from "@/components/ui/button";

export function KnowledgeAttachForm({
  chatbotId,
  bases,
  linkedIds,
  canManage,
}: {
  chatbotId: string;
  bases: { id: string; name: string }[];
  linkedIds: string[];
  canManage: boolean;
}) {
  const bound = setChatbotKnowledgeAction.bind(null, chatbotId);
  return (
    <section className="rounded-2xl border bg-card p-5">
      <h2 className="font-semibold">Knowledge bases</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Retrieval only uses bases attached to this chatbot. Sources stay inside this workspace.
      </p>
      {bases.length ? (
        <form action={bound} className="mt-4 space-y-3">
          {bases.map((kb) => (
            <label key={kb.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="knowledgeBaseIds"
                value={kb.id}
                defaultChecked={linkedIds.includes(kb.id)}
                disabled={!canManage}
              />
              {kb.name}
            </label>
          ))}
          {canManage ? <Button type="submit">Save attachments</Button> : null}
        </form>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">Create a knowledge base first.</p>
      )}
    </section>
  );
}
