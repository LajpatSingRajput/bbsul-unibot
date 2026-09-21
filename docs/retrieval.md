# Retrieval changes and local verification

The existing application was inspected before editing. Upload and reprocessing are in `app/api/[...path]/route.ts`; originals use the existing Cloudinary adapter (demo originals remain in memory). `lib/documents.ts` extracts PDF/DOCX/TXT/CSV and invokes overlapping 1,200-character chunking with 150-character overlap. The API persists `documents` and `knowledgeChunks` through `lib/store.ts`, including documentName, category, audience, generation and chunkIndex. It filters active, ready document generations before calling `lib/chat.ts`. FAQs are in `faqs`. Chat returns FAQ answers or verbatim document evidence, then applies the university-specific gate before the existing optional Gemini/web fallback. Default thresholds are FAQ 0.55 and document 0.48.

## Files changed

- `lib/retrieval-language.ts` (new): shared normalization and a bounded local semantic vocabulary, including Roman Urdu, singular/plural forms, phrase aliases and evidence concepts. This lets stored wording such as credential lists match requirements questions without new infrastructure.
- `lib/retrieval.ts`: metadata-aware hybrid scores, evidence gates, safe threshold handling, duplicate removal, chunk provenance and labeled multiple excerpts. University-specific fallback detection uses the same language normalization to prevent Roman Urdu campus questions reaching general AI.
- `tests/retrieval-hybrid.test.ts` (new): synthetic positive, negative, grounding, metadata, audience, provenance and fallback regressions.
- `README.md` and `docs/architecture.md`: replace outdated retrieval descriptions and link this guide.
- `docs/retrieval.md` (new): inspection findings, setup, results and limitations.

UI, authentication, panels, upload/extraction, Firestore collections/rules/indexes, Gemini adapter and web-search configuration are unchanged. No new package, environment variable, Firebase migration, embedding backfill or document re-upload is required. Existing chunks are interpreted at read time; original data is not rewritten. Stored chat sourceReferences now optionally include chunkId/chunkIndex, which do not require a schema migration in Firestore.

## Running locally

From the existing project directory, install its existing locked dependencies if necessary:

```bash
npm ci
npm run dev
```

Keep the existing `.env.local`; do not overwrite it. Live mode uses the existing Firebase/Cloudinary configuration. Open http://localhost:3000 and use an existing authorized account. Existing documents become searchable immediately after restarting the app. No Firebase bootstrap or deployment is needed for this change.

Run the focused synthetic suite without Firebase or Gemini:

```bash
node --import tsx --test tests/retrieval-hybrid.test.ts
npm run typecheck
npm test
```

Production:

```bash
npm run build
npm start
```

On the inspected Mac, native SWC could not load; the existing Webpack option successfully builds using the fallback bindings:

```bash
npm run build -- --webpack
npm start
```

For manual retrieval checks, use Admin → Documents to upload a TEST-ONLY text fixture to a development dataset with the following separate facts, or query equivalent facts in your already-approved documents:

```text
Applicants must submit CNIC, photographs, intermediate certificate and domicile.
The semester tuition is PKR 42,000 in this test fixture.
Examinations commence on 12 December 2026 in this test fixture.
The Department of Computing offers BS Computer Science.
```

These are invented test data, not BBSUL facts. Ask the eight questions below and confirm the returned excerpt and source. Also ask for a hostel fee, medicine admission requirements and exam results: these facts are absent and must not be invented. Use the focused automated suite for separate chunks and adversarial distractors; it asserts precise source IDs, verbatim answers and no AI fallback.

## Results (2026-09-17)

All eight requested queries passed against synthetic stored-row fixtures:

- “What are the admission requirements?” → admission credential list.
- “admission ke liye kya chahiye?” → same credential list.
- “What documents do I need for admission?” → same credential list.
- “semester fee kitni hai?” → semester tuition excerpt.
- “What is the semester fee?” → same tuition excerpt.
- “When do exams start?” → examination commencement excerpt.
- “exam kab hain?” → same commencement excerpt.
- “Which departments offer BS Computer Science?” → degree directory excerpt.

Additional tests cover dakhla, imtihan, akhrajat, paperwork, numeric fees without a currency prefix, class timing, misleading document titles, unsupported program qualifiers, missing data, audience restrictions, legacy rows, metadata fields and three-excerpt provenance. No production university data or live API calls were used for these fixtures.

The focused suite has 33 tests. TypeScript checking passes. The full unit suite has one environment failure in the unchanged PDF extraction test: `@napi-rs/canvas` cannot load its native binding, leaving `DOMMatrix` undefined. Other tests pass. The Webpack production build passes; default Turbopack is blocked by native SWC code-signature loading on this Mac. Browser verification remains incomplete: Chromium is not installed for Playwright, and the API workflow attempts also failed against the current local server. No successful live Firebase/authentication or end-to-end claim is made.

To prepare browser verification in a correctly configured local demo environment, install the browser with `npx playwright install chromium`, ensure port 3000 is not serving a live Firebase app, and run `npm run test:e2e`. The existing app disables demo mode when FIREBASE_PROJECT_ID is configured; use a separate demo environment rather than changing a live project's credentials.

## Limits and design choice

The semantic layer uses explicit campus concepts and evidence patterns, not learned embeddings. It has no model download, API quota, external transmission of document content, vector database or persistent index. Learned embeddings would require model/provider selection, indexing and lifecycle handling; they were not added to this synchronous, small-corpus architecture.

Unrecognized wording and Roman Urdu spellings can still miss. Conservative subject and facet gates favor abstention over returning a vaguely related excerpt. These heuristic checks are not a proof of entailment: a long passage may contain matching words about separate facts, and conflicting or outdated source material is not resolved automatically. Verify real university documents before relying on scores. Scores are not calibrated probabilities. Thresholds were not lowered from the existing defaults.

Retrieval still scans the existing corpus on each request. OCR, multi-turn context resolution, broad multilingual understanding and large-scale vector search remain outside this fix. General educational Gemini and external current-information search retain the existing opt-ins and citation safeguards; recognized campus questions with missing evidence return the existing knowledge-not-found message.

## Follow-up: library timing miss (2026-09-17)

Read-only inspection of the configured Firestore identified `Library timigs are 9.pdf`, whose extracted content also spells “timings” as “timigs”. The original screenshot question failed the timing evidence gate while the single-word “library” query passed. This was reproduced before changing code.

`lib/retrieval-language.ts` now recognizes that spelling variation, unifies timings/time/opening-hours wording for campus facilities, and recognizes explicit clock ranges as hours/schedule evidence. Numeric book counts and room numbers are not clock evidence. Thresholds and stored records were not modified.

`tests/retrieval-library.test.ts` adds 14 regressions for the stored typo, English/Roman Urdu timing questions, heading-free clock ranges, unrelated numeric content and unsupported Sunday/Ramadan/facility qualifiers. Together with the previous hybrid suite, 47 focused tests pass. Full unit suite: 77/78 pass; the unchanged PDF native-binding failure remains. TypeScript passes.

The current answer function was additionally verified read-only against the actual eligible Firestore document generations and configured settings for the faculty role. The exact screenshot question, “What are the library opening hours?” and “library ka time kya hai?” each returned the library document with relevance 0.843 (not a probability), without Gemini/web fallback. Sunday-specific hours returned unresolved. This verification neither saved conversations nor changed university data. Send a new question after refreshing the running development app; historical chat replies are not rewritten.
