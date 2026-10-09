# Verba: hosting migration record

The application originally ran on a managed Cloudflare Workers host (D1 database, R2 file bucket, a private access gate and a one-time hosted-identity account adapter). It now runs as a standard Node.js server on Render with a Neon PostgreSQL database.

## Changes made in the move

- Runtime: Next.js production server (`next build` / `next start`) on a Render web service. The Workers build tooling, connector-preview scaffolding, `.openai/hosting.json` and the example D1 app were removed together with their code. `build/sites-vite-plugin.LICENSE` is no longer needed because that component is no longer included.
- Database: the D1 tables were recreated in PostgreSQL (`db/schema.ts`, `drizzle/0000_initial.sql`). `lib/runtime.ts` keeps the routes' statement API; SQLite-specific SQL was converted (upserts, JSON array matching, quoting). Multi-statement operations run in one transaction. The 20-jobs/24-hours quota uses a per-workspace transaction lock so concurrent requests cannot exceed it.
- Files: R2 objects are replaced by the private `file_objects` table (bytea). Access rules are unchanged; downloads still go through the authorized API routes.
- Accounts: the hosted-identity adapter (`lib/hosted-account-setup.ts`, `HOSTED_ACCOUNT_SETUP`) was deleted. No request header ever creates or authenticates an account. The first administrator is bootstrapped offline with `npm run create-admin` (single-use 24-hour invitation link), as this document previously required.
- Origin checks: write requests still require a same-site `Origin`. Behind Render's TLS proxy the public origin is derived from the `Host`/`X-Forwarded-Proto` headers, `RENDER_EXTERNAL_URL` or `APP_ORIGIN`.
- Tests: the Miniflare suites were ported to start the production build against throwaway PostgreSQL databases; the AI provider is still mocked only at the outbound HTTP boundary.

## Still required before a public, commercial launch

1. Provide `OPENAI_API_KEY` in Render's environment (never in source or chat). `lib/ai-provider.ts` calls the OpenAI Responses API; the privacy page names that provider. Replace both together if you change provider.
2. Custom domain: add it in Render, then set `APP_ORIGIN` to the new origin.
3. Backups and retention: Neon keeps point-in-time history for its retention window; define retention/deletion policy and scheduled cleanup of expired sessions, invitations and rate-limit rows.
4. Render's free plan sleeps when idle (first request after a pause is slow). Use a paid instance for production traffic.
5. The privacy and terms pages are setup notices. The operator must approve and replace them, identify the legal entity, and confirm processing agreements.
6. Payments, DHL, UPS and FedEx booking, and the Main System's own API remain unfinished. Email, SMS, WhatsApp, captcha, social login, antivirus and the Main System webhook are built and turn on with their environment variables (see README).
7. Migrations: `drizzle/0001_spec_1_1_4.sql` is applied by `npm run migrate`, which runs when Render starts. Netlify shares the same database and does not run migrations itself. Live translation quality is unverified until the provider is connected and bilingual specialists assess representative outputs.
