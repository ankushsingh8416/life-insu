# Architecture — Phase 1

## RAG pipeline

```
User message
   │
   ▼
GuardrailService.classifyIntent()        (keyword allow/deny + prompt-injection regex)
   │
   ├── rejected ──────────────────────────────────────────┐
   │                                                       │
   ▼ allowed / ambiguous                                   │
EmbeddingService.embed(query)  (OpenAI text-embedding-3-large, fixed regardless of chat provider)
   │
   ▼
QdrantService.search()  → top K by cosine similarity
   │
   ▼
RetrievalService.hybridRerank()  (dense score + keyword-overlap boost)
   │
   ├── topScore < RAG_MIN_SIMILARITY AND intent was ambiguous ──► rejected (no hallucination)
   │
   ▼ relevant chunks found
PromptBuilderService.buildAnsweringPrompt(chunks)  → strict grounding system prompt
   │
   ▼
AiOrchestratorService.streamChatCompletion()  (provider fallback chain)
   │
   ▼
Tokens streamed to client via Socket.IO, citations attached, message persisted
```

### Guardrail

Three layers, in order:

1. **Prompt-injection patterns** (regex) — reject immediately regardless of topic.
2. **Keyword allow/deny lists** — fast-path obvious in-domain ("premium", "IRDAI", "claim", ...) or
   obvious out-of-domain ("write code", "cricket score", "tell me a joke", ...) queries without
   spending an embedding call.
3. **Retrieval-confidence fallback** — anything ambiguous falls through to actually running
   retrieval; if the top match is below `RAG_MIN_SIMILARITY`, the assistant declines instead of
   answering from the LLM's general knowledge. This is the core anti-hallucination guarantee: the
   model is never asked to answer without grounding context above the confidence bar.

When a message is rejected, the LLM is still called once — but with a minimal system prompt that
only asks it to *politely decline in the user's own language and suggest an insurance topic*. No
knowledge-base context is included, so there is nothing for it to hallucinate from.

### Embedding consistency

The whole knowledge base is embedded in **one fixed vector space** (`EmbeddingService`, hardcoded
to OpenAI's embedding API), completely decoupled from `AiOrchestratorService` (which handles chat
completions and *is* swappable via `AI_PRIMARY_PROVIDER`). If chat completions swapped to Gemini
but embeddings also swapped to a different model, previously indexed vectors would silently become
incomparable to new query vectors — same text, different vector space, meaningless cosine
similarity. Keeping embeddings on a fixed provider avoids that failure mode entirely; only the
answering LLM is swappable.

### AI provider fallback semantics

`AiOrchestratorService.streamChatCompletion()` walks the chain
(`AI_PRIMARY_PROVIDER → AI_SECONDARY_PROVIDER → AI_FALLBACK_PROVIDER`). Fallback to the next
provider only happens **before the first token is streamed** (connection/auth/rate-limit
failures). Once a provider has started streaming to the client, a later failure raises
`MidStreamProviderError` instead of silently retrying on another provider — retrying at that point
would duplicate or garble content the user has already seen.

## Data model

See [`apps/api/prisma/schema.prisma`](../apps/api/prisma/schema.prisma) for the full schema:
`Visitor`, `ChatSession`, `Message`, `Feedback`, `KnowledgeDocument`, `KnowledgeChunk`,
`CrawlLog` (Phase 3), `AdminUser` / `AiSettings` (Phase 2).

## Knowledge base ingestion

`KnowledgeBaseService` accepts a file upload or URL, creates a `pending` `KnowledgeDocument` row,
and enqueues a BullMQ job. `IngestionProcessor` (worker, concurrency 3):

1. Extracts text (PDF via `pdf-parse`, DOCX via `mammoth`, HTML via `cheerio`, plain text/CSV as-is).
2. Chunks it (`ChunkingService`: sentence-aware, `RAG_CHUNK_SIZE`/`RAG_CHUNK_OVERLAP`).
3. Embeds each chunk in batches of 64.
4. Wipes any previous vectors/rows for that document (idempotent re-index), then upserts new
   `KnowledgeChunk` rows and Qdrant points.
5. Marks the document `indexed` (or `failed` with a reason).

Automated scheduled crawling (website hourly, IRDAI every 12h) is Phase 3 — the ingestion
pipeline above is already schedule-agnostic, so Phase 3 only adds the crawler + a cron trigger
that calls the same `createFromUrl` path.
