# ChatPilot AI

Multi-tenant AI chatbot SaaS for businesses, ecommerce stores, agencies, and individuals. This repository is being built in phases. **Phase 4 is implemented:** a versioned, embeddable website widget with Shadow DOM style isolation, visitor sessions, domain allowlisting, rate limiting, streaming replies, and server-side AI access.

Later phases add the inbox, Stripe/Midtrans billing, analytics, and the public API. Those screens remain honest placeholders.

## Phase 0 audit

The starting repository contained only the empty root commit. Phase 1 added identity and tenancy. Phase 2 added the builder and playground. Phase 3 added retrieval. Phase 4 adds the public website widget.

- Next.js App Router, TypeScript (strict), Tailwind CSS v4, shadcn/ui, Lucide
- Next.js server actions and route handlers
- PostgreSQL 16 and Prisma 6 with committed migrations
- Session cookies, organizations, and RBAC
- OpenAI, Gemini, and Anthropic adapters behind one interface
- Deterministic mock adapter for tests and `AI_MOCK_MODE`

## What works in Phase 4

- Everything from Phase 1 (register, sessions, orgs, invites, admin, health)
- Create, configure, publish, unpublish, duplicate, and soft-delete chatbots
- Plan-limit enforcement and tenant isolation on every chatbot query
- Playground with server-sent events and streaming tokens
- OpenAI, Gemini, and Anthropic adapters with normalized errors
- Platform keys from env, or workspace keys encrypted with AES-256-GCM
- Credit reservation, settlement from actual token counts, and refunds on failure
- Usage records written per successful request
- Email verification required before publish
- Agents can view and playground; only owners and admins can mutate
- Knowledge bases with file, paste, FAQ, URL, and sitemap ingestion
- SSRF protection (private, loopback, link-local, and credentialed URLs are rejected)
- Background jobs with retry and per-document status
- Deterministic mock embeddings plus OpenAI/Gemini embeddings when live keys exist
- pgvector cosine retrieval scoped to the chatbot's attached knowledge bases
- Grounded playground replies with stored source citations
- Versioned widget at `/widget/v1.js` (alias `/widget.js`) rendered in Shadow DOM
- Public APIs `/api/widget/v1/{config,session,chat}` with CORS only for allowed domains
- Visitor sessions with hashed tokens, isolated conversations, and stricter rate limits
- Embed snippet on the chatbot editor; empty allowlist or draft status blocks public use
- Independent Harbor Books demo site on port 43211 (`npm run widget-demo`)

## What is not complete

Do not treat these as shipped: inbox/handoff, Stripe/Midtrans checkout, or the versioned public API.

## Local setup

1. Install Node.js 22 and PostgreSQL 16 (or Docker).
2. Copy environment variables:

   ```bash
   cp .env.example .env
   ```

3. Start Postgres:

   ```bash
   docker compose up -d postgres
   ```

   Or use a local server with the credentials in `.env.example`.

4. Apply migrations and seed plans:

   ```bash
   npm install
   npx prisma migrate deploy
   npm run db:seed
   npm run check:env
   ```

5. Run the app:

   ```bash
   npm run dev
   ```

   The app listens on [http://127.0.0.1:43180](http://127.0.0.1:43180).

### Email in development

`EMAIL_DELIVERY=console` writes verification, reset, and invite messages to the `OutboundEmail` table and the process log. Enable `ALLOW_DEV_MAILBOX=true` and open `/dev/mailbox` or the verification page to copy the link. Production should use SMTP; console delivery is reported as a warning.

### AI providers

`AI_MOCK_MODE=true` (the default) uses a deterministic mock adapter. No vendor network call is made.

To call a live provider:

1. Set `AI_MOCK_MODE=false`.
2. Add `OPENAI_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`, and/or `ANTHROPIC_API_KEY` on the server, **or** paste a workspace key at `/settings/providers`.
3. Workspace keys are encrypted with `APP_ENCRYPTION_KEY` (32-byte hex). They are never returned to the browser.

Credits: 1 credit per 1,000 tokens, minimum 1, reserved before the model call and settled from the provider usage payload (or a character estimate if the vendor omitted usage). The public widget uses the same reservation path. Public chatbot ids never receive provider keys.

### Knowledge and pgvector

PostgreSQL needs the `vector` extension (`postgresql-16-pgvector` or the `pgvector/pgvector:pg16` image). Uploads go to `data/uploads` when `STORAGE_DRIVER=local`. URL ingestion only fetches public http(s) hosts after DNS resolution and an IP denylist check. Pasted and uploaded documents are processed immediately in the request; URL jobs also run on `npm run worker`.

### Website widget

1. Publish a chatbot after verifying email.
2. Add at least one allowed website domain (`store.example.com` or `127.0.0.1:43211`).
3. Paste the snippet from the chatbot editor. The script reads `data-chatbot-id` and derives the API origin from its own `src`.
4. Host-page CSS cannot style the panel; the widget attaches a Shadow DOM.

Local independent-site check:

```bash
npm run dev
npm run widget-demo
```

Open [http://127.0.0.1:43211](http://127.0.0.1:43211). The demo origin is allowlisted; any other `Origin` receives 403.

### Google OAuth

Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `NEXT_PUBLIC_GOOGLE_OAUTH=true`. The callback is `/api/auth/google/callback`. Tokens are encrypted when `APP_ENCRYPTION_KEY` is a 32-byte hex string.

### Super administrators

Set `SUPER_ADMIN_EMAILS` to a comma-separated list. Matching accounts receive the platform role on register or password login. You can also promote users from `/admin`.

## Verify

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Tests use `TEST_DATABASE_URL` (defaults to `chatpilot_test`) and the mock adapter. They never call live vendors unless you opt in:

```bash
LIVE_AI_TESTS=true AI_MOCK_MODE=false OPENAI_API_KEY=... npm test
```

Live cases skip when `LIVE_AI_TESTS` is unset or the matching key is missing.

## Deployment

The app is a Node.js Next.js server. It needs:

- Managed PostgreSQL
- Environment variables from `.env.example` (never commit secrets)
- `npx prisma migrate deploy` before or during release
- `npm run build` and `npm run start`

Vercel, Fly, Render, or a container from `Dockerfile` all work. Redis and object storage are reserved for later phases. A startup configuration check is exposed at `/api/health` and never prints secret values.

## Backup

Use `pg_dump` / `pg_restore` on the PostgreSQL database. Uploaded documents are not stored yet.

## Project layout

- `app/` routes, server actions, and health endpoints
- `app/api/chatbots/[id]/play` SSE playground
- `app/api/widget/v1` public config, visitor session, and SSE chat
- `public/widget/v1.js` Shadow DOM widget (`/widget.js` aliases it)
- `lib/ai` provider adapters, credentials, credits, and routing
- `lib/chatbot` CRUD and playground orchestration
- `lib/widget` origin checks, public config, visitor sessions
- `lib/knowledge` ingestion, SSRF, jobs, embeddings, and retrieval
- `lib/auth` and `lib/org` authorization used by both the UI and tests
- `widget-demo/` independent storefront used for embed verification
- `prisma/schema.prisma` tenant-aware models
- `tests/` Node.js test runner coverage for auth, isolation, chatbots, adapters, knowledge, and the widget
