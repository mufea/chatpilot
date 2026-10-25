export type Citation = {
  documentId: string;
  title: string;
  chunkIndex: number;
  snippet: string;
  score: number;
};

export type RetrievedChunk = Citation & {
  content: string;
  knowledgeBaseId: string;
};
