# API-based RAG

The existing pipeline now performs retrieval-augmented generation: eligible knowledge → selected passages → Gemini → sourced natural answer. No downloaded model, Python service, new dependency, Firestore index or data migration is required. Existing documents do not need re-uploading.

## Enable

Configure these server-side variables locally or in Vercel:

```env
RAG_ENABLED=true
GEMINI_ENABLED=true
GEMINI_API_KEY=your_authorized_key
GEMINI_MODEL=a_model_available_to_your_account
```

Also enable Gemini in Admin → Settings. The local existing `.env.local` now includes `RAG_ENABLED=true`; other credentials and settings were preserved. `.env.example` documents the flag with a false default. Restart `npm run dev` after an environment change. On Vercel, add RAG_ENABLED=true to the intended environment and redeploy. Demo mode disables external calls. WEB_SEARCH_ENABLED is not needed for RAG; existing general/current-information fallback retains its separate switches.

## Behavior and boundaries

Retrieval still uses the existing metadata-aware lexical/concept ranking, thresholds, audience restrictions and ready-generation API checks. This change does **not** add learned embeddings or an embedding API; semantic-vector retrieval remains a separate improvement. RAG does not require embeddings to generate from retrieved evidence, but missed retrievals will still abstain.

The server passes up to three evidence passages, truncated to 4,000 characters per passage with 200-character titles. Only selected evidence and the current question reach Gemini, not profiles, user history or original file bytes. The existing REST generateContent adapter is reused, with structured JSON output for grounded generation and no search tools. Instructions require source-only facts, language matching (including Roman Urdu), conflict disclosure and abstention. User/source text is treated as untrusted input.

The adapter checks completed output, answer shape/length, valid source numbers and exact supporting quotes. These checks reject fabricated citations; they do not independently prove claim entailment or eliminate prompt-injection/hallucination risk. Keep authoritative source material and review consequential answers. Retrieved source references remain attached; confidence is retrieval relevance, not a generated-answer probability. New chat records include answerMode=generated or excerpt. Raw internal evidence is not duplicated into chat storage.

If RAG is disabled, return existing verified excerpts. If enabled generation fails (quota, timeout, truncation, invalid JSON or invalid citations), return a clear retry notice; if the model abstains, return the knowledge-not-found response. Never replace failed RAG generation with multi-topic raw excerpts. If retrieval finds no university evidence, preserve the existing missing-information guard and fallback policy. FAQ priority remains, and FAQ hits may also be rephrased when RAG is enabled.

## Test locally

```bash
npm run dev
```

Ask a question supported by an active, permitted source, for example library hours. Ask it in English and Roman Urdu and inspect the document/FAQ source badge. Ask a missing Sunday-specific timing question and confirm no invented hours. Temporarily disable RAG and confirm source excerpts still work. New replies use the new behavior; historical messages are unchanged.

```bash
node --import tsx --test tests/rag.test.ts tests/retrieval-hybrid.test.ts tests/retrieval-library.test.ts
npm run typecheck
npm run build -- --webpack
npm test
```

Fourteen new RAG tests exercise context selection, source preservation, opt-outs, errors, abstention, FAQ generation, missing information, the API request, fabricated quotes/source IDs and incomplete answers. Combined focused suite: 61 tests. Full suite on this Mac: 91/92 pass; the unchanged PDF extraction test fails because the installed native canvas binding cannot load (DOMMatrix undefined). Webpack production build and TypeScript pass. No Windows execution or live browser workflow was verified in this change.

## Changed files

- lib/retrieval.ts: expose selected passages to the server answer engine.
- lib/chat.ts: call grounded generation when opted in; retain safe excerpt behavior and existing fallback policy.
- lib/gemini.ts: bounded source-only generation and citation/output validation.
- app/api/[...path]/route.ts: server RAG flag with demo restriction.
- .env.local and .env.example: RAG_ENABLED switch.
- tests/rag.test.ts: focused regressions.
- README.md and docs/rag.md: current data flow, setup, privacy boundary and limits.

Earlier exported ZIP files are snapshots and do not contain these new changes.

## Live API verification

On 2026-11-13, the configured model (`gemini-3.6-flash`) appeared in the API model listing. A first synthetic generation attempt timed out; a retry completed successfully and passed exact-quote validation, returning “Library ke timings 9:00 se 5:00 tak hain.” for a test-only clock-range passage. No real university documents or private history were used for this live check. Availability in the model list and a successful call do not establish free-tier eligibility or future quota availability. All 61 focused tests pass. `docs/architecture.md` was also updated for the new provider data flow.

## Focused answers follow-up

A stored admission reply was confirmed to have answerMode=excerpt and included an unrelated scholarship section from a neighboring chunk. RAG failures now return an explicit retry notice instead of raw chunks. Generation instructions require own-word answers limited to the requested topic; a broad eligibility question should ask for the intended program rather than enumerate unrelated prospectus sections. Criteria/criterion normalize to requirements, and program-specific admission FAQs cannot answer unspecified-program admission queries. Citation quote checks tolerate formatting-only whitespace and Unicode normalization. Structured output has a larger token budget to reduce truncation. Two new regressions cover program specificity and quote formatting; focused suite now has 63 passing tests.
