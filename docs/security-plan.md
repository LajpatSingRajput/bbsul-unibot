# Security plan

| Threat                            | Implemented boundary                                                                                         |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Browser role tampering            | Server-verified Firebase token plus current Firestore profile; strict profile field allowlist                |
| Unverified/inactive account       | Verified-email and active-state checks per request; matching direct-client rules                             |
| IDOR                              | Owner check on conversation reads, writes, deletions and feedback submission                                 |
| Faculty acting as admin           | Explicit admin-role check on management endpoints                                                            |
| Loss of final admin               | Transactional role/status update and shared coordination document                                            |
| Bypassing admin workflows via SDK | Managed client writes denied; server API validates and audits                                                |
| API secret disclosure             | Server-only variables, ignored `.env.local`, no private fields in API configuration                          |
| CSRF                              | Bearer auth for live users; signed HttpOnly SameSite demo cookie; origin validation on mutations             |
| XSS                               | React text rendering; HTTPS citation allowlist; provider HTML isolated in sandboxed iframe                   |
| Unsafe upload                     | Admin check, 3 MB ceiling, extension and magic checks, DOCX expanded-size cap, text limits, safe object path |
| Obsolete document answers         | Active/status/generation gates, disable-before-reprocess and delete                                          |
| Excessive AI calls                | FAQ/document precedence, dual opt-ins, per-user rate limits and timeout                                      |
| Web prompt injection              | Untrusted-data system instruction, suspicious-request gate, no privileged model tools                        |
| Unwanted chat review              | Disabled by default, explicit admin setting, review audit entries                                            |

Firebase Admin SDK bypasses Firestore rules: server authorization is therefore tested separately from direct-client rules. Deactivation is effective on the next API request, even while the browser has an old ID token. An already in-flight request may complete.

Before real rollout, verify real email flows, deploy rules, configure trusted origins, enable budgets, define retention, approve provider privacy terms, and assess the complete verified FAQ corpus. The app is an FYP implementation, not a claim of independently audited production security. A prompt-injection regex and system instruction cannot guarantee perfect model behavior; the fallback has no access to profiles, chat history or private uploaded documents.

No real passwords are seeded. The supplied Gemini key is stored only in the local ignored environment file and excluded from the distributable archive. The recipient must set their own server environment on another machine/hosting project. The downloaded source is safe to inspect without a key.
