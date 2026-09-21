export type Role = "student" | "faculty" | "admin";
export type Source = "FAQ" | "DOCUMENT" | "GEMINI" | "WEB";
export type Row = { id: string; [key: string]: any };
export type Profile = Row & {
  uid: string;
  name: string;
  email: string;
  role: Role;
  status: "active" | "inactive";
  department: string;
};
export const categories = [
  "Semester Enrollment Queries",
  "Academic Queries",
  "Administrative Queries",
  "Faculty & Department Queries",
  "Campus Life Queries",
  "Technical Queries",
];
export const sourceLabels: Record<Source, string> = {
  FAQ: "University Knowledge Base",
  DOCUMENT: "University Document",
  GEMINI: "AI Generated",
  WEB: "Web Search",
};
export const defaultSettings = {
  faqThreshold: 0.55,
  documentThreshold: 0.48,
  geminiEnabled: false,
  webSearchEnabled: false,
  adminConversationAccess: false,
  displayName: "UniBot Assistant",
  welcomeMessage: "How can I help you today?",
  maintenanceMode: false,
  maxUploadMB: 3,
  allowedDocumentTypes: ["pdf", "docx", "txt", "csv"],
};
export const now = () => new Date().toISOString();
