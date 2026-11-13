import {
  retrieve,
  universitySpecific,
  needsWeb,
  suspicious,
} from "./retrieval";
import { generateGrounded, generate } from "./gemini";
export const missing =
  "I could not find verified information for this question in the current BBSUL knowledge base. Please check with the relevant university department or administrator.";
export const groundedUnavailable =
  "I found relevant university sources, but could not prepare a focused answer right now. Please try again shortly.";
export const unavailable =
  "I could not find a verified answer in the university knowledge base, and the AI service is currently unavailable. Please try again later or contact the relevant university department.";
export async function answer(
  query: string,
  faqs: any[],
  chunks: any[],
  role: any,
  settings: any,
  provider = generate,
  groundedProvider = generateGrounded,
) {
  if (suspicious(query))
    return {
      text: "I can help with university information and educational questions, but cannot follow instructions to override safeguards or expose private information.",
      sourceType: null,
      sourceReferences: [],
      confidence: null,
      resolution: "blocked",
      fallbackUsed: false,
      webSearchUsed: false,
    };
  const hit = retrieve(query, faqs, chunks, role, settings);
  if (hit) {
    // Evidence is internal context, never persisted as a second copy in chat.
    const { evidence, ...result } = hit;
    let text = result.text;
    let answerMode: "generated" | "excerpt" = "excerpt";
    if (settings.geminiEnabled && settings.ragEnabled) {
      try {
        const generated = await groundedProvider(query, evidence);
        if (!generated)
          return {
            text: missing,
            sourceType: null,
            sourceReferences: [],
            confidence: null,
            answerMode: "unavailable",
            resolution: "unresolved",
            fallbackUsed: false,
            webSearchUsed: false,
          };
        text = generated.text;
        answerMode = "generated";
      } catch (error) {
        // Never turn failed generation into an unrelated multi-topic document dump.
        console.warn(
          "RAG generation failed",
          error instanceof Error ? error.name : "UnknownError",
        );
        return {
          text: groundedUnavailable,
          sourceType: null,
          sourceReferences: [],
          confidence: null,
          answerMode: "unavailable",
          resolution: "unresolved",
          fallbackUsed: false,
          webSearchUsed: false,
        };
      }
    }
    return {
      ...result,
      text,
      answerMode,
      resolution: "answered",
      fallbackUsed: false,
      webSearchUsed: false,
    };
  }
  const base = {
    sourceType: null,
    sourceReferences: [],
    confidence: null,
    resolution: "unresolved",
    fallbackUsed: false,
    webSearchUsed: false,
  };
  if (universitySpecific(query)) return { ...base, text: missing };
  const web = needsWeb(query);
  if (!settings.geminiEnabled || (web && !settings.webSearchEnabled))
    return {
      ...base,
      text: web
        ? "Current web information is unavailable. No matching verified university source was found. Please check an official source or ask the administrator to enable web search."
        : unavailable,
    };
  try {
    return {
      ...(await provider(query, web)),
      resolution: "fallback",
      fallbackUsed: true,
      webSearchUsed: web,
    };
  } catch {
    return {
      ...base,
      text: unavailable,
      fallbackUsed: true,
      webSearchUsed: false,
    };
  }
}
