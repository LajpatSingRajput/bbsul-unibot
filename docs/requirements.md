# Requirements and implementation decisions

Sources analyzed: `CUSTOMISED UNI CHAT BOT THESIS(3).docx`, the 16-slide `Blue and White Modern AI Chatbot Solutions Twitter Post(3).pptx`, and both supplied pasted prompts. The later `Pasted text(3).txt` takes priority where the prompts differ.

## Source-derived scope

The thesis and slides describe a responsive campus chatbot, Student/Faculty/Admin roles, quick topics, private chat history, a managed FAQ knowledge base, lightweight NLP retrieval and LLM fallback. The thesis identifies six categories: semester enrollment, academic, administrative, faculty/department, campus life, and technical questions. Green institutional accents, accessible typography, source transparency and nontechnical knowledge maintenance guide the interface.

The thesis also mentions portal embedding and QR access. An embed integration guide and QR generator are included; connecting to the existing BBSUL portal requires its operator. Multilingual support, speech, native mobile apps and live university database integrations are outside this implementation.

The source describes 150 verified FAQs, an 85% model-accuracy target, sub-two-second responses, 99% availability, surveys and past user testing. These are source claims/targets, not evidence that this new implementation achieved them. No actual verified FAQ corpus, university handbook, timetable or fee schedule was supplied. The thesis is not indexed as authoritative policy.

## Newer user instructions

Next.js/React/TypeScript replace plain HTML/Flask. Firebase Auth/Firestore/Storage replace JWT/MySQL. Gemini replaces older Claude/OpenAI references. Detailed admin analytics, ingestion, feedback, unresolved-query tracking, safe web fallback and configurable system settings extend the thesis's smaller admin scope. The final platform is web-only. Deployment targets Vercel, honoring the later explicit provider preference.

## Implementation choices

- TF-IDF cosine plus normalized query-term coverage provides explainable, low-cost lexical retrieval. Lightweight spelling aliases improve common English variants. This is not a trained NER classifier or semantic embedding model.
- FAQs are checked before document chunks. Sufficient FAQ matches prevent AI calls. Documents return matching excerpts without speculative synthesis.
- Unverified university questions are declined. General educational questions may use Gemini; current external queries require enabled grounding and returned citations.
- Registration creates student access. A requested faculty role awaits administrator approval.
- Server-side Firestore roles are authoritative. Every sensitive request checks the current profile; no client-selected privilege is trusted.
- Server-only document ingestion is capped at 3 MB. Upload policy can be narrowed by admins. PDF/DOCX/TXT/CSV support excludes scanned PDFs without OCR.
- No credentials or real passwords are bundled. Local demo mode is isolated, explicit and nonpersistent; production uses Firebase.
- Admin conversation review is disabled by default and audited when enabled. Other users' private chats are inaccessible to students/faculty.

## Delivery phases

1. Source analysis and requirements extraction.
2. Architecture, schema, authorization and retrieval decisions.
3. Next.js public site and three workspaces.
4. Firebase adapters, secure APIs and rules.
5. FAQ/document management and retrieval.
6. Gemini/search adapters, citations, feedback and analytics.
7. Unit, API/browser and rules tests; build verification.
8. Source packaging and deployment instructions.
