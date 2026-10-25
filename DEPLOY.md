# Deployment

ChatPilot is a Next.js Node server plus PostgreSQL 16 with pgvector. It is not a static export.

## Required services

- Node.js 22
- PostgreSQL 16 with the `vector` extension (`postgresql-16-pgvector` or `pgvector/pgvector:pg16`)
- Object storage is optional. Local uploads use `data/uploads` when `STORAGE_DRIVER=local`

Redis is not required. Background jobs use PostgreSQL.

## Environment

Copy `.env.example` and set values on the host. Never commit secrets.

Required for a healthy production boot:

- `DATABASE_URL`
- `APP_URL` / `NEXT_PUBLIC_APP_URL`
- `APP_ENCRYPTION_KEY` (32-byte hex)
- `SESSION_COOKIE_NAME`

Recommended:

- `EMAIL_DELIVERY=smtp` plus SMTP credentials
- One or more AI keys, or workspace keys in Settings
- `AI_MOCK_MODE=false` only after a provider key is present

Billing is optional until you take money:

- Stripe: `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`
- Midtrans: `MIDTRANS_SERVER_KEY` (optional)
- Webhook URLs:
  - `https://YOUR-DOMAIN/api/billing/stripe/webhook`
  - `https://YOUR-DOMAIN/api/billing/midtrans/notification`

If those keys are missing, checkout fails closed. The UI will not pretend a workspace is paid.

`/api/health` reports `billing.liveVerified: false` until you have processed a real, signed provider event in that environment. Do not advertise live payments from a local mock.

## Release steps

1. Provision PostgreSQL and install pgvector.
2. Set environment variables on the host.
3. `npm ci`
4. `npx prisma migrate deploy`
5. `npm run db:seed` (creates default plans if they are missing; it does not overwrite admin edits)
6. `npm run check:env`
7. `npm run build`
8. `npm run start` (port 43180)

Or build the container from `Dockerfile` and pass the same environment into the runtime.

## Checks before traffic

```bash
npm run lint
npm run typecheck
npm test
npm run build
curl -sS https://YOUR-DOMAIN/api/health
curl -sS https://YOUR-DOMAIN/api/ready
```

Production build must succeed before you call the release done. Tests cover duplicate webhooks, failed payments, concurrent credit usage, and tenant isolation. They do not charge a live card.

## Webhook go-live

1. Create the Stripe webhook endpoint with the raw body URL above.
2. Store `STRIPE_WEBHOOK_SECRET` on the server only.
3. Send a Stripe test event and confirm a `WebhookEvent` row and that a replay is stored as `duplicate`.
4. Only then enable checkout for customers.

Midtrans is the same: compute the SHA-512 signature with the server key, reject mismatches, and ignore duplicate `transaction_id` values.

## Backup

- `pg_dump` / `pg_restore` for PostgreSQL
- Copy `data/uploads` if you use local storage

## What this release does not include

Inbox/human handoff and the versioned public API are not shipped.
