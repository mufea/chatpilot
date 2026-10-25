# ChatPilot AI

Multi-tenant AI chatbot SaaS for businesses, ecommerce stores, agencies, and individuals. This repository is being built in phases. **Phase 2 is implemented:** chatbot CRUD, a signed-in playground, provider-independent adapters, encrypted workspace keys, streaming where the vendor supports it, and actual usage tracking.

Later phases add RAG, the embeddable widget, inbox, Stripe/Midtrans billing, analytics, and the public API. Those screens remain honest placeholders.

## Phase 0 audit

The starting repository contained only the empty root commit. Phase 1 added identity, tenancy, and the public site. Phase 2 adds the builder and live model path on that foundation.

- Next.js App Router, TypeScript (strict), Tailwind CSS v4, shadcn/ui, Lucide
- Next.js server actions and route handlers
- PostgreSQL 16 and Prisma 6 with committed migrations
- Session cookies, organizations, and RBAC
- OpenAI, Gemini, and Anthropic adapters behind one interface
- Deterministic mock adapter for tests and `AI_MOCK_MODE`

## What works in Phase 2

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

## What is not complete

Do not treat these as shipped: document ingestion, RAG, the website widget, inbox/handoff, Stripe/Midtrans checkout, or the versioned public API.

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

Credits: 1 credit per 1,000 tokens, minimum 1, reserved before the model call and settled from the provider usage payload (or a character estimate if the vendor omitted usage).

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
- `lib/ai` provider adapters, credentials, credits, and routing
- `lib/chatbot` CRUD and playground orchestration
- `lib/auth` and `lib/org` authorization used by both the UI and tests
- `prisma/schema.prisma` tenant-aware models
- `tests/` Node.js test runner coverage for auth, isolation, chatbots, and adapters
