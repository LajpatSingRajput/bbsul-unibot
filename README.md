# BBSUL UniBot

**Windows recipients:** start with [WINDOWS-SETUP.md](WINDOWS-SETUP.md) for installation, credential-free demo, and persistent Firebase setup.

**Smart Campus Assistant** — a responsive, web-only Final Year Project for Benazir Bhutto Shaheed University Lyari, Karachi.

Next.js + TypeScript, Firebase Authentication, Firestore, Firebase Storage, metadata-aware hybrid retrieval and an optional server-side Gemini/Google Search fallback. Student, Faculty and Admin workspaces are implemented. No native mobile app is included.

## Start with the demonstration

Requirements: Node.js 22.12+ (tested with Node 24), npm, a modern browser.

```bash
npm ci
cp .env.example .env.local
npm run demo
```

On Windows, copy `.env.example` to `.env.local` in your editor instead of running `cp`. Open `http://localhost:3000`, select **Log in**, then choose Student, Faculty or Admin in **Explore the project**. No real passwords are included.

Demo mode is explicitly separate from live Firebase. Each browser session receives an isolated dataset and a signed, HttpOnly demo cookie. The role chooser works only in this mode. Data is held in server memory and resets on restart. Demo is for a local single-process demonstration, not a persistent or multi-instance deployment. It never calls Gemini. Set `DEMO_MODE=false` for real use; the server also disables demo whenever `FIREBASE_PROJECT_ID` is set.

The initial answers describe the application, not BBSUL policies. **The supplied thesis and slides describe a 150-FAQ target but do not provide 150 verified question-answer records.** Do not present the sample data as university policy. Real deployments start with an empty knowledge base.

## What is implemented

- Public landing page, registration, login, password reset, email verification and persistent Firebase sessions.
- Student and faculty dashboards, private conversations, search, deletion, profile updates, source badges, copying and feedback.
- Admin analytics, secure user management, FAQ CRUD/import, document upload/processing/reprocessing, knowledge excerpts, feedback, unresolved queries, settings and optional conversation review.
- PDF, DOCX, UTF-8 TXT and CSV ingestion, size/type checks, text extraction, overlapping chunks, audience restrictions and source provenance.
- FAQ-first matching, document-second matching, configurable relevance thresholds, general AI fallback and current-information search fallback. University-specific missing facts are declined rather than guessed.
- Server token verification, active-account checks, last-admin protection, Firestore/Storage rules, request validation, origin checks, per-user rate limits and audit logs.
- API integration tests, browser workflows, retrieval/security unit tests and a Firestore emulator rules suite.

The design uses institutional green accents and typographic branding inspired by the supplied materials; it does not reproduce an official university seal.

## Firebase setup

1. Create a Firebase project and register a Web application. Copy its six public configuration values into the `NEXT_PUBLIC_FIREBASE_*` fields in `.env.local`. These identify the client project; authorization does not rely on keeping these values secret.
2. Enable **Authentication → Sign-in method → Email/Password**. Add `localhost` and your final Vercel hostname to Authentication's authorized domains. Configure verification/password-reset email templates as appropriate.
3. Create Cloud Firestore in **production mode** and choose a location close to your users.
4. Enable Firebase Storage and copy the exact bucket name into both `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` and `FIREBASE_STORAGE_BUCKET`. Use the value Firebase provides, including its actual `.firebasestorage.app` or `.appspot.com` suffix.
5. In Project settings → Service accounts, create a server service-account key. Put its project ID, client email and private key into the server-only fields. Never add `NEXT_PUBLIC_` to private values. A private key can be a quoted `.env.local` value containing escaped `\n`; the server converts these into newlines. Do not place the downloaded key JSON in this repository.
6. Install dependencies, sign in to the Firebase CLI, then deploy rules to your project:

```bash
npx firebase login
npx firebase deploy --only firestore:rules,firestore:indexes,storage --project YOUR_FIREBASE_PROJECT_ID
```

`storage.rules` deliberately denies direct client file access. The server uses the Admin SDK after checking the user and validating the document. Managed collection writes also go through the API. Firestore rules protect direct SDK access, while the API separately enforces authorization because Admin SDK operations bypass rules.

### First admin and faculty onboarding

Register normally, verify the email, and copy that account's UID from Firebase Authentication. Set `BOOTSTRAP_ADMIN_UID` in `.env.local`, then run:

```bash
npm run bootstrap
```

This trusted local process creates the first admin only when none exists. Sign in again. Use **Admin → University members** to approve faculty requests or assign additional administrators. All public registrations receive `student` access initially, even when they request faculty access. Faculty privileges require administrator approval. No browser-supplied role is authoritative.

The final active administrator cannot be demoted or disabled. Role/status updates serialize through a Firestore transaction and shared lock document. An admin cannot change their own role. Deactivation is an app-level account restriction enforced on every API request and in Firestore rules; it does not delete the Firebase Authentication identity.

## Gemini and Google Search

1. Create an API key in Google AI Studio and put it in **server-only** `GEMINI_API_KEY`.
2. Set `GEMINI_MODEL` to a supported text model. The example uses `gemini-2.5-flash`, listed in Google's official pricing documentation when reviewed on **2026-09-16**. The implementation never embeds a model name in the request code.
3. Review provider data handling and quotas before sending real questions. Set `GEMINI_ENABLED=true` and optionally `WEB_SEARCH_ENABLED=true` in the server environment.
4. Also enable the corresponding controls in **Admin → Settings**. Both the server opt-in and admin setting must be enabled. API keys cannot be entered or read through that screen.

The adapter uses the documented `generateContent` REST endpoint and `tools: [{google_search: {}}]`. It parses grounding citations and search suggestions. A web answer without a supported HTTPS citation is treated as unavailable, not presented as verified. Google-provided search suggestion HTML is rendered in an isolated sandboxed iframe without scripts or same-origin access.

Only the current question is sent to Gemini. Profiles, private history and uploaded files are not sent. Document answers use verbatim retrieved excerpts, avoiding an extra AI call. Model calls time out after 25 seconds. Quota failures do not crash the chat.

The provider function is injected into the `answer` engine and can be replaced with another server-side search/AI adapter. Return the same `text`, `sourceType`, `sourceReferences`, and `confidence` shape; preserve the retrieval-first and university-fact gates.

### Costs and limits — verified 2026-09-16

- Firebase Storage requires the **Blaze billing plan**, even when usage fits a no-cost allowance. It is not a billing-free Spark deployment. [Official Storage billing change](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024).
- Firestore and Authentication have no-cost allowances; usage and features can incur charges. Monitor your own console and set budgets. [Firebase pricing](https://firebase.google.com/pricing).
- Gemini 2.5 Flash is listed with free input/output and limited free Search grounding. Account/model quotas apply; paid-tier usage can be billed, and free-tier content may be used to improve Google's products. Do not send sensitive data through the free tier. [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing).
- Vercel Hobby is for personal, non-commercial use with limits. Review eligibility before an institutional deployment. [Hobby plan](https://vercel.com/docs/plans/hobby).

API references: [Generate content](https://ai.google.dev/api/generate-content), [Google Search grounding](https://ai.google.dev/gemini-api/docs/google-search).

## Development and production

```bash
npm run dev
npm run typecheck
npm test
npm run build
npm start
```

For live development, populate `.env.local` and set `DEMO_MODE=false`. Firebase's browser SDK keeps the login session and sends ID tokens as Bearer tokens. The server verifies signature, expiry and revocation, then reads the authoritative user profile on each request. Unverified users can initialize their profile but cannot use chat or admin APIs.

## Document processing

Upload approved information from Admin → Documents. Default limit: 3 MB, configurable downwards. Text limit: 150,000 characters. PDF limit: 100 pages. DOCX archives have expanded-size and entry-count checks. Scanned PDFs require OCR before uploading; no OCR is silently simulated. CSV is indexed as text, suitable for small tables of university information.

Processing runs synchronously within the Node API request, with status recorded before processing. Chunks are roughly 1,200 characters with 150-character overlap. A generation identifier prevents stale chunks from being used. Reprocessing first disables the document, replaces chunks, then activates the completed generation. Deletion disables retrieval first, removes chunks and storage, then removes metadata. Failed records remain visible and safely inactive. If the platform terminates a long request, the admin can retry/reprocess or delete it.

This is deliberately an FYP-scale implementation: FAQ/chunk searches load the eligible corpus, analytics inspect saved messages and list screens return their collection. Benchmark your actual corpus before institution-wide use; large deployments need bounded pagination, a maintained search index and asynchronous ingestion. No claim of 99% uptime, sub-two-second latency or 85% accuracy has been experimentally established.

## FAQ import

Admin → FAQs accepts a JSON array of up to 250 records / 200 KB per import. Repeat imports for larger approved datasets. Example schema is in `docs/faq-import-example.json` and contains an explicitly marked demo entry. Supported categories follow the thesis. Existing FAQs can be edited, disabled or deleted without changing code.

Relevance scores are **not probabilities**. Evaluate exact questions, paraphrases and unrelated negative queries against your verified corpus before adjusting thresholds. Default FAQ threshold is 0.55 and document threshold 0.48. A local concept vocabulary supports common English paraphrases and Roman Urdu campus terms without embedding API calls. This is bounded rule-based semantic matching, not general multilingual understanding. See [retrieval implementation and local tests](docs/retrieval.md).

## Tests

```bash
npm test
npm run typecheck
npx playwright install chromium
npm run test:e2e
```

The browser suite starts a local demo server. Stop a separate dev server first when your environment isolates process networking. It checks desktop/mobile layout, role flows, FAQ management, chat/history/feedback, IDOR, document lifecycle and XSS rendering. `CHROMIUM_EXECUTABLE=/path/to/chromium` optionally selects an existing compatible browser in a Linux test environment.

Firestore rules need **Java 21+** with the bundled current Firebase CLI:

```bash
npm run test:rules
```

The rules suite is isolated under `tests/rules`, uses project `demo-unibot` and does not touch a live Firebase project. See `docs/testing.md` for executed checks and remaining credential-dependent validation. Do not confuse demo-role access with successful real Firebase account tests.

## Vercel deployment

1. Put this source in your own private Git repository, excluding `.env.local`, keys, `node_modules` and build output. Import it into Vercel using the Next.js preset.
2. Add the public Firebase values and all required server-only environment values in Vercel Project settings → Environment Variables. Set `DEMO_MODE=false`. Set `APP_ORIGIN` to the exact final HTTPS origin, without a trailing slash. Use separate Firebase projects/environments for development and production.
3. Deploy, then add the deployed hostname to Firebase Authentication's authorized domains. Changing any `NEXT_PUBLIC_*` value requires a new build.
4. Deploy Firebase rules, create/verify the admin and run the bootstrap from a trusted local machine. Add official FAQs/documents and test one student, one faculty and one admin account.
5. Enable AI/search only after configuration, quota and privacy review. Confirm that document/FAQ matches do not call Gemini.

No Vercel account or Firebase project configuration was supplied, so this source package is **not a live deployment**. A Gemini key supplied later was kept in the local ignored environment and passed a model-access check; it is excluded from this archive. The code and setup instructions are provided without fabricated service connections.

### Portal embedding and QR access

The supplied thesis also mentions campus portal embedding and QR access. Set `EMBED_ORIGIN` to a single trusted HTTPS university portal origin before allowing an iframe. The portal can use `<iframe src="https://YOUR_HOST/student/chat" title="BBSUL UniBot" width="100%" height="720"></iframe>`. Authentication remains required; browsers that restrict cross-site storage may require opening UniBot in its own tab. Prefer a normal link where embedded authentication is unreliable. No access to the existing university portal was supplied.

Generate a QR image for the final HTTPS portal URL using the included Python helper: `python scripts/create_qr.py https://YOUR_HOST output.png` (requires `pip install 'qrcode[pil]'`). A QR code does not bypass login.

## Project map

| Path                                       | Purpose                                                     |
| ------------------------------------------ | ----------------------------------------------------------- |
| `app/[[...slug]]/page.tsx`                 | Public and role-based web routes                            |
| `app/api/[...path]/route.ts`               | Authenticated API orchestration                             |
| `components/portal.tsx`                    | Landing, auth, dashboards, history and profile              |
| `components/chat.tsx`                      | Chat, source citations and feedback                         |
| `components/admin.tsx`                     | Administration workflows                                    |
| `components/ui.tsx`                        | Shared accessible fields, dialogs and status states         |
| `lib/auth.ts`, `firebase-*.ts`             | Sessions, verification and Firebase adapters                |
| `lib/retrieval.ts`, `chat.ts`, `gemini.ts` | Retrieval, policy gates and AI provider                     |
| `lib/documents.ts`, `store.ts`             | Ingestion and persistence                                   |
| `firestore.rules`, `storage.rules`         | Direct-client security boundary                             |
| `scripts/bootstrap.ts`                     | Trusted first-admin creation                                |
| `tests/`                                   | Unit, API/browser and rules suites                          |
| `docs/`                                    | Requirements, architecture, schema, security and validation |

## Troubleshooting

| Symptom                                      | Action                                                                             |
| -------------------------------------------- | ---------------------------------------------------------------------------------- |
| Firebase is not configured                   | Fill both public web config and server account variables; restart.                 |
| Email verification loop                      | Follow the verification email, then choose “I have verified my email.”             |
| Faculty registration opens student workspace | An admin must approve the faculty request in University members.                   |
| Admin bootstrap refuses to run               | Existing admins must manage roles through the app.                                 |
| Upload fails                                 | Check Blaze/bucket access, allowed format, 3 MB limit and actual extractable text. |
| No university answer                         | Upload approved information. Do not reduce thresholds just to force a match.       |
| Gemini unavailable                           | Check both opt-ins, API key, current model availability and account quota.         |
| Web search unavailable                       | Check search opt-in and model support; answers without citations are declined.     |
| Request origin not allowed                   | Match `APP_ORIGIN` to the browser's exact deployed origin.                         |
| Demo data vanished                           | Expected after server restart; use Firebase for persistence.                       |
| Rules tests will not start                   | Install Java 21+ and allow emulator downloads.                                     |

For live use, define a university retention policy for conversations, unresolved queries and feedback, and configure expiration for `rateLimits.expiresAt`. TTL deletion may have billing implications. Rate limiting protects chat/ingestion, not the hosting provider from general network abuse. This code has automated checks but is not a substitute for an institutional security review.
