# Verba vs. "Online Translation Services Ordering System" spec 1.1.4: gap scan and build plan

Scan date: 2026-10-09. Compared against two documents:
- *Characterization small English system 1.1.4* (34 pages)
- *Small system work screens 1.1.4* (19 slides)

## How the scan was done

- **Code:** read every page, API route and pricing rule.
- **Live deploy:** Netlify serves commit `19ebc60`, the same code that was scanned.
- **Automated checks:** typecheck passes; all 265 automated assertions pass.
- **Browser walk-through:** I drove a production build in Chromium:
  - all 8 order services as an anonymous visitor;
  - every studio screen as the administrator;
  - real invitations for a notary, a courier and a customer, then each role's own screens and actions.
- **Limit:** this session cannot open `*.netlify.app` or `*.onrender.com`. The scan ran on the same code with a local database.

Legend: ✅ done · 🟡 partial · ❌ missing

---

## Part A: Errors found (bugs and wrong behaviour)

| # | Error | Evidence |
|---|-------|----------|
| E1 | An order update with no valid fields still returns "OK". It also writes a false **"Terms accepted"** entry into the order history. | Sent `{payment:"Paid"}`. Got 200 and a "Terms accepted" event; payment stayed "Not requested". |
| E2 | Payment status can never change. Admins cannot mark an order paid, and no payment flow exists. | Every order shows "Payment: Not requested". |
| E3 | **Notary only** and **Courier only** still ask for languages, pages and words. | Wizard scan, services 6 and 8. |
| E4 | **Additional services** runs the full translation wizard. It shows €0.00 and creates a €0 "order" instead of a contact request. | Wizard scan, service 7. |
| E5 | Urgency does not change the notary or courier price. | Notary only: Standard €75 / Express €75. Courier only: €25 / €25. |
| E6 | One-way courier jobs (collection only, or delivery only) are rejected. | Returns 400 "Complete both delivery addresses". |
| E7 | Assigning a courier leaves the shipment at "Awaiting assignment". | Deliveries list after assignment. |
| E8 | Couriers and customers see screens that are not theirs. Both see "Notary desk"; couriers see €0.00 estimates, "Start a project" and "Translate". | Courier and customer screenshots. |
| E9 | No "Personal information" page for customers. Team members cannot be removed or deactivated. | Customer menu; `DELETE /api/team` returns 405. |
| E10 | A visitor on the order page uploads a file and is told to sign in first. The spec says no identification is needed until confirmation. | Alert: "Sign in to upload documents". |
| E11 | Every visitor page load logs a 401 error in the browser console. | Console log on `/order`. |
| E12 | "Download order summary" produces a raw JSON text file, not a readable summary. | Order sheet. |
| E13 | Order numbers are random (`VB-2026-94D9907A`), not running numbers. | Order list. |
| E14 | Lint fails: 92 errors in source files (mostly loose `any` types inherited from the original zip). The lint config also scans local build folders. | `npm run lint`. |
| E15 | Netlify still requires a Netlify team login for every visitor, so a client cannot open the site. | `requiresSSOTeamLogin: all`. |
| E16 | Not yet verified on Netlify: the upload size cap (files above about 6 MB may fail) and the function time limit for long AI translations. | Needs a live test. |

---

## Part B: Spec vs. current site

### Customer ordering (slides 1.0–1.8)

| Spec item | Status | Notes |
|---|---|---|
| 8 services | ✅ | All 8 present. |
| No login until confirmation | 🟡 | Estimate works without login; upload and save need login (E10). |
| Number of documents, source, multiple targets, pages, words, format, 250 words = 1 page | ✅ | |
| Translation field (technical / medical / general …) | 🟡 | 5 sectors; no "General". |
| Document description + "What is translated" (document / website …) | 🟡 | Only name and type. |
| Upload with format, size and **anti-script scan** | 🟡 | Format and size checks only; no malware scan. |
| "Accurate analysis": word count read from the uploaded file | ❌ | |
| Translation-memory analysis | ❌ | Needs the Main System. |
| Prices for **Professional / Student / Machine** side by side, each with a validation checkbox and delivery days | ❌ | Radio buttons without prices. |
| Urgency changes the price | 🟡 | Translation only (E5). |
| Pricing factors: customer type (new / existing / organization), document type, file format, DTP, country of origin, notary service type, official notary price list per country | ❌ | Only sector, level, language and urgency. |
| Notary: service type, copies, urgency, physical arrival | 🟡 | No separate notary urgency. |
| Courier: collection Yes/No + return Yes/No | ❌ | Both always required (E6). |
| Courier address: country and city dropdowns, street autocomplete, postcode, phone with prefix, time range | 🟡 | Free-text fields. |
| Same-day / next-day, 1-way / 2-way, invoice, 2 kg / A4 note | ❌ | |
| Israel = own couriers; abroad = DHL / UPS / FedEx; carrier chosen from address | ❌ | |
| Additional services = contact form, sent to admin by email | ❌ | (E4) |
| Order summary table | ✅ | |
| **PDF quotation** download before paying | 🟡 | Print page only after saving (E12). |
| Personal details: first + last name, email, password strength, phone prefix, terms checkbox | 🟡 | One name field; no prefix. |
| Running order number | ❌ | (E13) |
| Unpaid quote saved in account | ✅ | Drafts. |
| Payment logos → third-party payment (Visa, Mastercard, bit, Amex, bank transfer, PayPal) | ❌ | (E2) |
| After payment: email + SMS, go to personal area, cookie | 🟡 | Cookie and session only. |
| Customer area menu: Create order / Orders & offers / Personal information / Banner | 🟡 | No personal info, no banner. |
| Search by bid number, description, name, date, languages, amount | 🟡 | One free-text box + status. |
| EUR default, switch to local currency | 🟡 | EUR / USD / ILS with manual rates. |

### Delivery area (slides 1.9–1.13)

| Spec item | Status | Notes |
|---|---|---|
| Menu: Main / Deliveries / Customers / Reports / Settings | 🟡 | Inside the shared studio. |
| Shipments table: status, delivery date, urgency, customer, order no., pickup, delivery, type, operator, sum; red "Stop" | ❌ | Shows project / languages / status / shipment / created. |
| User-chosen columns + search on every column | ❌ | |
| Edit form for both ends (messenger, city, street, number, floor, apartment, remarks, contact name + phone; same / next day) with Save / Update / Cancel | ❌ | Addresses are read-only after ordering. |
| Courier card: name, area, phone, address, business no., active / not active, total deliveries, open deliveries, email, password, history | ❌ | Team table shows name / email / role / area only. |
| Customer card: type, address, total shipments, history, edit open deliveries | 🟡 | Name / email / phone / counts. |
| Delivery reports by courier / customer / address / time; Print / Excel / PDF | 🟡 | Project report with dates; CSV / Excel / print. |
| Courier area: available deliveries **in the courier's own area**, courier accepts one, own reports | ❌ | Admin must assign; no courier reports. |

### Notary area (slides 1.14–1.16)

| Spec item | Status | Notes |
|---|---|---|
| Login by **phone** + password; forgot password by email / phone link | ❌ | Email + recovery code. |
| Orders table: total, delivery, physical, copies, words, doc type, type, client, date, number; user-chosen columns | ❌ | Generic table. |
| Order details, download / print source and translated files | ✅ | |
| Notary reports page with search | ❌ | |
| "Date of delivery of the project" | ❌ | No due date stored. |

### Chat (slide 1.17)

| Spec item | Status | Notes |
|---|---|---|
| Per-order messages with history | ✅ | Refreshes every 15 seconds. |
| Real-time chat, including **while filling the order form** (before an order exists) | ❌ | |
| Customer service inbox; customer, notary and vendor routing by permission and stage | 🟡 | Per-order only. |

### General guidelines

| Spec item | Status |
|---|---|
| SSL | ✅ |
| **Open self sign-up** + Facebook / Google / Twitter login | ❌ (invitation-only today) |
| Captcha | ❌ (rate limits only) |
| Several payment ("clearing") systems with a comparison | ❌ |
| SMTP: password reset, email verification, quote copy, work order, customer inquiries | ❌ |
| International SMS | ❌ |
| WhatsApp / Viber / WeChat notifications | ❌ |
| Multi-language UI, admin-entered, incl. Hebrew RTL | ❌ |
| Handoff of paid orders to the Main System | ❌ |
| Native iOS and Android apps | ❌ |
| Chrome / Safari / Firefox | ✅ |

**Beyond the spec (kept):** AI translation studio with quotes, glossary, quality checks, reviewer approval and DOCX / XLSX export.

---

## Part C: Build plan, one plan for both, in stages

Every stage ends the same way:
1. Full test suite plus new tests for the stage.
2. A browser walk-through of every role.
3. Push to GitHub, which redeploys both Render and Netlify.
4. A short report: what's done and what's verified.

### Stage 1: Fix the errors (no outside accounts needed)
- **E1:** reject empty or unknown updates, and log only real changes.
- **E2:** add "mark paid / refunded" for admins (manual) until a payment provider is connected.
- **E3, E4:** service-aware form.
  - Notary only and Courier only skip languages and pages.
  - Additional services becomes a contact request that lands in the admin inbox.
- **E5:** urgency applies to notary and courier prices.
- **E6:** collection and return are each optional Yes/No.
- **E7:** assigning a courier moves the shipment to "Assigned".
- **E8:** menus and home screen per role; nothing that doesn't apply.
- **E9:** Personal information page; remove or deactivate members.
- **E10:** visitors can upload before sign-in; files attach to the order on sign-in.
- **E11:** stop the visitor console error.
- **E12:** readable order summary.
- **E13:** running order numbers (e.g. `VB-2026-000123`).
- **E14:** clean lint (types instead of `any`; ignore build folders).
- **E15:** make the Netlify site public, with your OK.
- **E16:** live upload and translation-time test on Netlify.

### Stage 2: Ordering forms exactly per slides 1.1–1.8
- **One form per service** with the spec's fields:
  - first and last name, phone prefix;
  - country and city lists, time ranges;
  - same-day / next-day, 1-way / 2-way, invoice, the 2 kg / A4 note;
  - "What is translated", document description, General field.
- **Prices:** Professional / Student / Machine side by side, each with a validation checkbox and delivery days.
- **Settings → price factors table:**
  - customer type (new / existing / organization);
  - document type, file format, DTP, country;
  - notary type and per-country notary prices;
  - courier price by country / zone.
- **"Accurate analysis":** word count read automatically from uploaded TXT / DOCX / PDF.
- **Real PDF quotation** downloadable before paying, on all services.

### Stage 3: Customer area and accounts
- Customer layout per slides: Create order / Orders & offers / Personal information / Banner.
- Search on every field (bid no., description, name, date, languages, amount).
- **Open self sign-up** (your decision), with email verification.
- Password reset by email link.
- Notary login by phone number.

### Stage 4: Delivery area per slides 1.9–1.13
- **Data:** a separate shipments record with structured addresses (city, street, number, floor, apartment, remarks, contact), delivery date, urgency, type, operator (carrier), sum and status incl. "Stop".
- **Shipments table:** user-chosen columns and per-column search.
- **Editing:** Save / Update / Cancel on in-progress shipments.
- **Courier cards:** business no., status, address, totals, open deliveries, history.
- **Customer cards:** type, address, total shipments, history.
- **Delivery reports:** by courier / customer / address / date; Print, Excel and real PDF.
- **Courier area:**
  - "available in my area" list;
  - accept a delivery;
  - status steps;
  - own reports.

### Stage 5: Notary area per slides 1.14–1.16
- Notary orders table with the spec's columns, user-chosen columns and order.
- Order detail with print / download.
- Project delivery date.
- Notary reports page with search and export.

### Stage 6: Chat per slide 1.17
- Live chat, with near-instant updates instead of the 15-second refresh.
- Chat available **during** order entry, including visitors.
- Customer service inbox for staff.
- Routing by permission and stage: customers, notaries, vendors, employees.
- Full history per customer.

### Stage 7: Outside services (each needs an account or key from you)

| Service | Suggested provider | Cost to test |
|---|---|---|
| Payments | Stripe (cards, Apple / Google Pay) + PayPal; for **bit** in Israel: Tranzila or Cardcom | Free test mode |
| Email (SMTP) | Resend or Postmark | Free tier |
| SMS + WhatsApp | Twilio | Small trial credit |
| Captcha | Cloudflare Turnstile | Free |
| Social login | Google, Facebook, X developer apps | Free |
| Malware scan | External scanning API (serverless hosts cannot run ClamAV) | Free tier / paid |
| Couriers abroad | DHL / UPS / FedEx business accounts | Business account |
| Exchange rates | Daily rates feed (e.g. ECB) | Free |
| Main System handoff | Needs the Main System's API document | — |

### Stage 8: Languages
- Translation framework for every screen; you or an admin enter texts per language.
- Hebrew and Arabic right-to-left layout.
- Customer picks their language.

### Stage 9: Mobile
- First, an installable web app (PWA) on iPhone and Android, with no app-store cost.
- Native iOS / Android apps only if still needed after that.

---

## Decisions needed from you

1. **Open sign-up:** may anyone create a customer account? The spec says yes; today it is invitation-only.
2. **Payment provider:** Stripe + PayPal, an Israeli processor for bit, or both?
3. **UI languages** to include first (e.g. English + Hebrew)?
4. **Mobile:** a PWA first, or native apps?
5. **Main System:** is there an API document for handing off paid orders?

Stages 1–6 and 8 need nothing from you except decision 1 (for Stage 3).
