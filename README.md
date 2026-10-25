# ChatPilot AI

Multi-tenant AI chatbot SaaS for businesses, ecommerce stores, agencies, and individuals. This repository is being built in phases. **Phase 1 is implemented:** public site, design system, PostgreSQL + Prisma, session authentication, organizations, and platform admin.

Later phases add the chatbot builder, RAG, embeddable widget, inbox, Stripe/Midtrans billing, analytics, and the public API. Those screens exist as honest placeholders and are not marked complete.

## Phase 0 audit

The starting repository contained only the empty root commit. There was no application, schema, authentication, or CI. Phase 1 initializes the stack requested in the master prompt:

- Next.js App Router, TypeScript (strict), Tailwind CSS v4, shadcn/ui, Lucide
- Next.js server actions and route handlers
- PostgreSQL 16 and Prisma 6 with a committed migration
- Session cookies, email verification, password reset, optional Google OAuth
- Organization membership and RBAC (owner / admin / agent)
- Platform super-admin area
- Docker Compose, Dockerfile, GitHub Actions CI

## What works in Phase 1

- Register, sign in, sign out
- Email verification and password reset
- Create workspaces, invite members, change roles
- Account export and account deletion
- Tenant isolation enforced on the server
- Seeded Free / Starter / Pro / Business plans
- Credit account + welcome ledger row (billing checkout is not live)
- `/api/health` and `/api/ready`
- Development mailbox at `/dev/mailbox` when `ALLOW_DEV_MAILBOX=true`

## What is not complete

Do not treat these as shipped: live AI providers, streaming chat, document ingestion, RAG, the website widget, inbox/handoff, Stripe/Midtrans, usage enforcement, or the versioned public API.

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

Tests use `TEST_DATABASE_URL` (defaults to `chatpilot_test`) and never call live AI or payment providers.

## Deployment

The app is a Node.js Next.js server. It needs:

- Managed PostgreSQL
- Environment variables from `.env.example` (never commit secrets)
- `npx prisma migrate deploy` before or during release
- `npm run build` and `npm run start`

Vercel, Fly, Render, or a container from `Dockerfile` all work. Redis and object storage are reserved for later phases. A startup configuration check is exposed at `/api/health` and never prints secret values.

## Backup

Use `pg_dump` / `pg_restore` on the PostgreSQL database. Uploaded documents are not stored in Phase 1.

## Project layout

- `app/` routes, server actions, and health endpoints
- `components/` marketing, dashboard, and shadcn primitives
- `lib/auth` and `lib/org` authorization used by both the UI and tests
- `prisma/schema.prisma` tenant-aware foundation for later phases
- `tests/` Node.js test runner coverage for auth, isolation, and admin
