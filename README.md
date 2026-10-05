# Verba — Translation Studio

A private translation web application with a simple text/document workflow and a separate service-operations workspace. Built with Next.js (React) on Node.js, with PostgreSQL (Neon) for records and private document storage, hosted on Render. The five specialties are Medical, Legal, Finance, Technology and Marketing.

## Primary workflow

1. Paste text or upload PDF, DOCX, UTF-8 TXT, JPG or PNG.
2. Select source/target language and specialty. Choose faithful, natural, or marketing brand tone.
3. Watch real request-processing progress, then receive an itemized EUR quote based on source word count and configured rates. Uploaded documents show the extracted text for confirmation; editing it recalculates the quote.
4. Explicitly approve the saved quote before translation starts. Quotes expire after 24 hours. They cover an AI draft and automated review, excluding tax, human specialist review, notary and courier work; no payment is collected.
5. The server translates in bounded segments, runs a separate source-versus-draft bilingual review, then checks numeric values/signs, units, identifiers, section completeness and saved terminology.
6. Read the bilingual result, edit it if needed, record qualified review, and download Word or TXT or print to PDF. Original layout is not reproduced. Medical, legal and financial results always require specialist review.

Results remain explicitly labeled AI drafts until an authorized reviewer records an attestation. This records a workspace review; it does not verify professional credentials, certify accuracy, or notarize a document. Automated review uses a separate request to the same configured model, not a human or an independent translation provider.

Jobs, source, glossary snapshots, results, errors, review notes and provider token usage persist. Leaving the page pauses automatic advancement after the current request; reopen History and Resume. There is no background queue. Leases prevent parallel step execution, completed steps are checkpointed, cancellation rejects late writes, edits invalidate approval, and version checks reject stale edits. A failed step permits three attempts. Job creation uses an idempotency key and an atomic 20-job/workspace rolling 24-hour limit. Text is limited to 20,000 characters; uploads to 10 MB; glossary to 200 entries per workspace.

## One-time provider setup — outstanding

The production OpenAI connection was not available during implementation. `OPENAI_API_KEY` must be provisioned securely in the server runtime (Render → service → Environment) through the OpenAI Developers API-key workflow; never place it in client code, source control or a chat message. `OPENAI_MODEL` optionally overrides the default `gpt-6-astra`. The runtime key is site-wide; only grant Site access to intended users. New uninvited identities otherwise receive separate workspaces.

The Connection dialog shows whether a key exists and lets administrators run a minimal live connection test. When no key is configured, pasted-text and TXT quotes still work. Quote acceptance cannot start translation and returns 503. Other file formats need the provider for source extraction. The app never substitutes sample output for live translation. API usage is billed to the connected account, separately from the illustrative human-service estimates.

The integration uses Responses structured JSON output, `store: false`, server-only authorization, no tools or URL retrieval, and instructions to treat source/previous translations/glossaries as untrusted data. Provider storage/retention is not guaranteed to be zero. File extraction is AI transcription except TXT, which uses UTF-8 decoding; scans and tables must be checked by the user. No original-layout guarantee is made.

## Service operations

`/order` keeps the detailed quotation flow separate from `/` (translation). Included:

- Eight requested service categories; multi-document, multi-language service orders; professional/student/machine-draft estimates; review, notary, copies, attendance and collection/delivery details.
- Server-validated provisional estimates in EUR, with configurable reference USD/ILS display rates. No live FX claim.
- Persistent quotes, draft editing, submission consent, customer directory, in-app messages, audit history, private source/completed document uploads and controlled status progression.
- Administrator, customer, reviewer, notary and courier roles with tenant/assignment checks. Couriers see collection/delivery information, not source documents or clinical instructions/discussions. Staff authorization does not send an invitation.
- Sequential courier status tracking and notary assignment. Final translation orders cannot be marked ready without an uploaded result.
- CSV reports with formula-injection protection, real XLSX reports with literal text cells, printable reports/order summaries and text order exports.
- File extension/signature checks. DOCX directory validation rejects malformed archives, path traversal, known macro/embedded executable entries and excessive expanded size. This is not malware scanning.

## Requirements still outside this build

The supplied v1.1.4 documents describe a larger commercial system. The following are not represented as finished or connected:

- Live checkout, payment callbacks, subscriptions, invoices/taxes and refunds.
- Email/SMS and external chat-channel notifications; in-app project messages refresh every 15 seconds.
- Main-system API handoff, external carrier booking, geographic courier claiming, geocoding and automatic carrier prices.
- Human specialist sourcing/contracts, independent credential verification, legal entity policies, approved retention/deletion processes and regulated-data compliance assessment.
- Social login, public customer rollout, native iOS/Android apps, .NET implementation and translated interface localization. This is a responsive web app with independent Verba accounts, with invitation-only accounts.
- Antivirus service, document layout reconstruction, translation-memory matching and unrestricted volume. Order views load the latest 500 records and first 200 messages.

Adding a workspace member does not create an account or send anything. Administrators generate single-use, 24-hour account invitations and share them manually. Verba login uses email/password, scrypt password hashing, secure HttpOnly cookies, database-hashed sessions and recovery codes. Authentication never trusts proxy or hosting identity headers. Do not expand access without intentional authorization. The setup privacy/terms notices must be approved and replaced for commercial launch. Use de-identified documents during setup.

## Hosting, database and accounts

- **Runtime:** Render web service (Node). Build `npm ci && npm run build`; start `npm run migrate && npm start`. `render.yaml` describes the service.
- **Database:** Neon PostgreSQL project “Verba main”. `DATABASE_URL` is set as a Render secret. `lib/runtime.ts` provides the database access used by every route (statements run in transactions where the workflow needs atomicity). Uploaded documents are stored privately in the `file_objects` table (10 MB per file).
- **Migrations:** `drizzle/*.sql`, generated from `db/schema.ts` with `npm run db:generate`, applied by `npm run migrate` (recorded in `verba_migrations`). Deployed migrations are immutable; append new ones.
- **First administrator:** accounts are invitation-only and the web never grants administrator rights to an anonymous visitor. Bootstrap offline: `DATABASE_URL=... npm run create-admin -- you@example.com "Your Name" https://your-site` prints a single-use, 24-hour link. Opening it lets that person choose a password and receive a recovery code. Administrators invite everyone else from Studio → Team & couriers.
- **Environment variables:** `DATABASE_URL` (required; use Neon's direct host, not the `-pooler` host, with `sslmode=verify-full`), `OPENAI_API_KEY` (enables translation and non-TXT source reading), `OPENAI_MODEL` (optional), `APP_ORIGIN` (optional; public origin when using a custom domain).

Key files:
- `lib/translation.ts`: schemas, segmentation, specialty instructions and mechanical checks.
- `lib/ai-provider.ts`: server-only Responses client and sanitized errors.
- `lib/runtime.ts`: PostgreSQL access and private file storage.
- `app/api/translations/`: job lifecycle, source downloads, exports, reviewer actions.
- `lib/office-export.ts`: minimal macro-free DOCX/XLSX generation.
- `components/translator.tsx`: upload/paste, source verification, results, glossary, history and review UX.
- `components/quote-builder.tsx` and `components/studio.tsx`: service requests and operations.

## Static pages on GitHub Pages

The three pages that need no server (services, privacy, terms) are also published to GitHub Pages, so they load instantly even when the Render service is asleep. `npm run build:pages` builds them into `pages-dist/` (a separate static Next.js export assembled by `scripts/build-pages.mjs`) and `scripts/check-pages.mjs` verifies every link and asset. The workflow in `.github/workflows/pages.yml` deploys on each relevant push; set Settings → Pages → Source to “GitHub Actions” once.

Links from those pages to the translator, orders, accounts and workspace point at the Render app, which stays the only home of everything that needs the server, database or sign-in cookie (the session cookie is host-only, so those pages cannot move to another origin). While a visitor reads a static page, it sends one cookie-less request to the app so a sleeping free-plan server is already waking. This does not remove the wake-up delay if someone goes straight to the app address; a paid Render instance does.

## Verification

```
npm run typecheck
npm run build
TEST_DATABASE_URL=postgresql://user@127.0.0.1:5432/postgres npm test
```

`npm test` runs the pure integrity checks and three API suites. Each API suite creates a throwaway PostgreSQL database on the `TEST_DATABASE_URL` server (never use production), starts the production build, and mocks the AI provider strictly at the outbound HTTP boundary (`tests/support/provider-redirect.mjs`, loaded only by the tests). They cover permissions, missing configuration, idempotency, two-pass processing, glossary snapshots, source confirmation, numeric flags, review/approval/edit gates, stale versions, errors, retry exhaustion, concurrent requests, cancellation, quota races, invitations, recovery and logout.

DOCX and XLSX exports were reopened with python-docx and openpyxl; formula-like values remain literal text. The main browser flows (invitation, quote, glossary, specialist order, studio views, team invitation, sign-out, mobile width) were exercised in Chromium.

Limitations: live translation quality and provider access are unverified until the owner connects OpenAI. Real sample translations then need bilingual specialist assessment across the intended language pairs and subjects. No claim of zero errors or guaranteed accuracy is made.

## Commercial defaults

Professional EUR 0.14/word, student EUR 0.08/word, machine draft EUR 0.03/word, review EUR 0.04/word; EUR 25 minimum translation. Specialty multipliers: medical 1.20, legal 1.15, finance 1.10, technology 1.05, marketing 1.00. Hebrew/Arabic/Chinese/Japanese multiplier 1.15. Priority adds 25% and Express 50% to translation/review. Notary EUR 75/document plus EUR 15/extra copy/document, courier EUR 25 provisional. These are illustrative configuration defaults, not statutory fees or verified market prices. USD 1.10/EUR and ILS 4.00/EUR are reference values, not current rates.

## Branding and export

See `SELF_HOSTING.md` for what changed in the move to Render and Neon and what remains before a public launch. Third-party license notices are retained.
