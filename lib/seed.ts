import { now, type Row } from "./types";
export function seedData() {
  const t = now();
  const demo = (
    id: string,
    question: string,
    answer: string,
    category: string,
    keywords: string[],
  ) => ({
    id,
    question,
    answer,
    category,
    keywords,
    targetAudience: ["all"],
    active: true,
    demo: true,
    createdAt: t,
    updatedAt: t,
    createdBy: "demo-admin",
  });
  return {
    users: ["student", "faculty", "admin"].map((role) => ({
      id: `demo-${role}`,
      uid: `demo-${role}`,
      name:
        role === "student"
          ? "Aima Amir"
          : role === "faculty"
            ? "Faculty Member"
            : "Knowledge Administrator",
      email: `${role}@demo.invalid`,
      role,
      status: "active",
      department: "Computer Science & IT",
      createdAt: t,
    })),
    faqs: [
      demo(
        "faq-about",
        "What can UniBot help me with?",
        "DEMO DATA • UniBot is designed to help with academic, administrative, campus-life and technical questions. It checks managed FAQs and uploaded documents before an optional AI fallback.",
        "Academic Queries",
        ["unibot", "help", "assistant"],
      ),
      demo(
        "faq-history",
        "How do I find my previous conversations?",
        "Open Chat history in the sidebar. Search by title or message, then select a conversation to continue. Only you can access your history by default.",
        "Technical Queries",
        ["history", "previous", "chats", "conversation"],
      ),
      demo(
        "faq-sources",
        "How can I verify an answer?",
        "Check the source badge below each reply. University Document answers include the source filename. AI Generated and Web Search answers are clearly distinguished. Contact the relevant department when verified university information is unavailable.",
        "Academic Queries",
        ["source", "verify", "answer"],
      ),
      demo(
        "faq-feedback",
        "How do I report an incorrect answer?",
        "Use the Not helpful button below an answer. Administrators can review feedback and improve the knowledge base.",
        "Technical Queries",
        ["incorrect", "feedback", "report"],
      ),
      demo(
        "faq-upload",
        "Which document formats can be uploaded?",
        "Administrators can upload text-based PDF, DOCX, TXT and CSV files, up to 3 MB each. Scanned PDFs need text recognition before upload.",
        "Technical Queries",
        ["upload", "document", "format"],
      ),
    ],
    documents: [],
    knowledgeChunks: [],
    conversations: [],
    feedback: [],
    unresolvedQueries: [],
    auditLogs: [],
    systemSettings: [],
    messages: [],
  } as Record<string, Row[]>;
}
