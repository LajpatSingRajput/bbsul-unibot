import { z } from "zod";
import { categories } from "./types";
export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const idSchema = z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/);
export const questionSchema = z.string().trim().min(2).max(2000);
export const faqSchema = z.object({
  question: z.string().trim().min(5).max(500),
  answer: z.string().trim().min(5).max(12000),
  category: z.enum(categories as [string, ...string[]]),
  keywords: z.array(z.string().trim().min(1).max(60)).max(30),
  targetAudience: z.array(z.enum(["student", "faculty", "all"])).min(1),
  active: z.boolean(),
});
export const profileSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    department: z.string().trim().max(100),
    studentId: z.string().max(50).optional(),
    employeeId: z.string().max(50).optional(),
  })
  .strict();
export const settingsSchema = z
  .object({
    faqThreshold: z.number().min(0.25).max(1),
    documentThreshold: z.number().min(0.25).max(1),
    geminiEnabled: z.boolean(),
    webSearchEnabled: z.boolean(),
    adminConversationAccess: z.boolean(),
    displayName: z.string().trim().min(2).max(60),
    welcomeMessage: z.string().trim().min(5).max(150),
    maintenanceMode: z.boolean(),
    maxUploadMB: z.number().min(0.1).max(3),
    allowedDocumentTypes: z.array(z.enum(["pdf", "docx", "txt", "csv"])).min(1),
  })
  .strict();
export function assertOwner(row: any, uid: string) {
  if (!row || row.userId !== uid)
    throw new AppError(404, "Conversation not found.");
}
export function assertAdmin(role: string) {
  if (role !== "admin")
    throw new AppError(403, "Administrator access required.");
}
export function protectLastAdmin(
  target: any,
  role: string,
  status: string,
  count: number,
) {
  if (
    target.role === "admin" &&
    target.status === "active" &&
    (role !== "admin" || status !== "active") &&
    count <= 1
  )
    throw new AppError(409, "The final active administrator must be retained.");
}
export function safeUrl(value: string) {
  try {
    const u = new URL(value);
    return u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
}
