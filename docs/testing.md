# Validation report — 2026-09-16

## Executed

- TypeScript check and Next.js production build passed.
- 31 core unit tests passed. They cover exact/paraphrased FAQs, spelling normalization, FAQ precedence, grounded excerpts, unrelated queries, inactive/audience filtering, 180+ records, provider failures, general/web routing, university-fact blocking, injection refusal, ownership, profile allowlists, admin guards, file validation and citation parsing, plus real PDF and DOCX text extraction.
- Seven Playwright workflows passed in Chromium: student chat/source/feedback/history, faculty isolation, admin FAQ creation and immediate retrieval, API authorization/IDOR/last-admin safety, upload/retrieve/disable/reprocess/delete, invalid input/XSS/unresolved logging, desktop/mobile navigation and overflow checks.
- Screenshots at 1440×1000 and 390×844 were visually inspected. No horizontal overflow occurred at the mobile width.
- A supplied Gemini key successfully accessed the configured model metadata endpoint (HTTP 200). This confirms model access, not generation quota or grounding entitlement.

## Not executed / requires configuration

- Live Firebase student registration, email verification, student/faculty/admin login, invalid credentials, password-reset email delivery, persistent sessions, revocation and Storage writes require the user's Firebase project.
- Eleven direct-client Firestore rules tests are included. Execution was blocked because the installed Java runtime was 17 and the current Firebase CLI requires Java 21+. These are not reported as passed.
- Live Gemini text generation and Google grounding were not exercised. Provider behavior is tested using deterministic mocked responses. No university or personal data was sent during key validation.
- Safari, Firefox and Edge device runs remain required for a full cross-browser acceptance claim. Chromium responsive testing does not establish those results.
- Corpus accuracy, F1, latency and availability targets require a verified university dataset and representative operational evaluation.

## Acceptance checklist after Firebase connection

1. Register a student, confirm unverified access is blocked, verify email and log in.
2. Register a faculty request; confirm it starts with student access; approve through another admin.
3. Log in with all three roles and invalid credentials. Exercise reset email and logout.
4. Try modifying role/status through the client SDK; run `npm run test:rules` under Java 21+.
5. Verify direct and API requests cannot access another account's conversations/messages.
6. Disable a user and confirm existing tokens no longer grant API access.
7. Try simultaneous final-admin demotion/deactivation requests.
8. Upload official PDF/DOCX/TXT/CSV examples; exercise enable/disable/reprocess/delete and extraction errors.
9. Run exact, paraphrased, irrelevant and prompt-injection query sets against approved knowledge.
10. Enable provider opt-ins, check general fallback, cited web fallback, quota failure and sensitive-university-query blocking.
11. Submit Helpful and Not helpful feedback and confirm admin review/unresolved resolution.
12. Repeat on Chrome, Edge, Firefox, Safari, tablet and mobile browsers, including keyboard navigation and 200% zoom.
