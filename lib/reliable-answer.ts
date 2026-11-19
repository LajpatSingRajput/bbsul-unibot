import {
  retrieve,
  audienceAllowed,
  rank,
  tokens,
  normalize,
} from "./retrieval";
import {
  generateKnowledgeAnswer,
  knowledgeSources,
  type Source,
} from "./knowledge-answer";
import { rewriteSearchQuery } from "./query-understanding";
import type { Role, Row } from "./types";

const empty = {
  sourceType: null,
  sourceReferences: [],
  confidence: null,
  fallbackUsed: false,
  webSearchUsed: false,
};
const clean = (s: string) =>
  s.replace(/^\s*--\s*\d+\s+of\s+\d+\s*--\s*$/gm, "").trim();
const roman = (q: string) =>
  /\b(kya|hai|hain|kab|kitna|kitni|batao|btao|chahiye|mujhe)\b/i.test(q);
const result = (text: string, sources: Source[], mode: string) => ({
  ...empty,
  text,
  sourceType: sources.every((s) => s.type === "FAQ") ? "FAQ" : "DOCUMENT",
  sourceReferences: sources.map((s) => s.reference),
  answerMode: mode,
  resolution: "answered",
});
const clarification = (text: string, reason: string) => ({
  ...empty,
  text,
  answerMode: "clarification",
  resolution: "unresolved",
  failureReason: reason,
});
function selectSources(
  hit: NonNullable<ReturnType<typeof retrieve>>,
  all: Source[],
) {
  return all
    .filter((s) =>
      hit.sourceReferences.some((r: any) =>
        s.type === "FAQ"
          ? r.id === s.reference.id
          : r.chunkId === s.reference.chunkId,
      ),
    )
    .map((s, i) => ({ ...s, source: i + 1, content: clean(s.content) }));
}
function deduplicate(rows: Row[], faq: boolean) {
  const seen = new Set<string>();
  return rows.filter((r) => {
    const key = `${normalize(String(faq ? r.question : r.documentName || r.title || ""))}\0${normalize(String(faq ? r.answer : r.content))}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
// Conservative extraction: rank complete sentences with the same coverage gates
// as retrieval. Never cut a sentence to make it fit or return whole prospectuses.
export function focusedExcerpts(query: string, sources: Source[]): Source[] {
  const out: Source[] = [];
  let size = 0;
  for (const source of sources) {
    const sentences = source.content
      .split(/(?<=[.!?])\s+|\n+/)
      .map(clean)
      .filter(Boolean);
    const candidates = sentences.map((content, index) => ({
      id: String(index),
      content,
      documentName: source.title,
    }));
    const matches = rank(
      query,
      candidates,
      (r) => `${r.documentName} ${r.content}`,
    )
      .filter((r) => r.score >= 0.48)
      .slice(0, 2)
      .sort((a, b) => Number(a.row.id) - Number(b.row.id));
    const content = matches.map((r) => r.row.content).join(" ");
    if (!content || content.length > 700 || size + content.length > 1200)
      continue;
    size += content.length;
    out.push({ ...source, content, source: out.length + 1 });
    if (out.length === 3) break;
  }
  return out;
}
function directText(query: string, source: Source) {
  const content = clean(source.content);
  // Render a time range only when the *entire* statement has this simple shape.
  // No inferred AM/PM or dropped day/holiday qualifiers.
  const timing = content.match(
    /^(library|office|cafeteria|laboratory)\s+(?:timigs|timings?|hours)\s+(?:are|is|:)\s*((?:\d{1,2}:\d{2}\s*(?:[ap]\.?m\.?)?)\s*(?:to|[-–])\s*(?:\d{1,2}:\d{2}\s*(?:[ap]\.?m\.?)?))\.?$/i,
  );
  if (timing)
    return roman(query)
      ? `${timing[1][0].toUpperCase() + timing[1].slice(1)} ka waqt ${timing[2]} hai.`
      : `${timing[1][0].toUpperCase() + timing[1].slice(1)} timings: ${timing[2]}.`;
  return content;
}
export async function reliableAnswer(
  query: string,
  faqs: Row[],
  chunks: Row[],
  role: Role,
  settings: any,
  generator = generateKnowledgeAnswer,
  rewriter = rewriteSearchQuery,
) {
  // Filter before deduplication so hidden records cannot suppress visible ones.
  const fs = deduplicate(
    faqs.filter((r) => audienceAllowed(r, role)),
    true,
  );
  const ds = deduplicate(
    chunks.filter((r) => audienceAllowed(r, role)),
    false,
  );
  const all = knowledgeSources(fs, ds, role);
  const exact = all.filter(
    (s) => s.type === "FAQ" && normalize(s.title) === normalize(query),
  );
  if (exact.length > 1)
    return {
      ...clarification(
        "The knowledge base contains different answers to this question. Please confirm with the relevant university department.",
        "conflicting_sources",
      ),
      sourceReferences: exact.map((s) => s.reference),
    };
  if (exact.length === 1) return result(exact[0].content, exact, "verified");
  const terms = new Set(tokens(query));
  const broadAdmission =
    terms.has("admission") &&
    terms.has("requirement") &&
    [...terms].every(
      (t) => ["admission", "requirement"].includes(t) || /^\d{4}$/.test(t),
    );
  if (broadAdmission)
    return clarification(
      roman(query)
        ? "Kis program ke admission criteria chahiye—BS, BBA, Pharm-D ya koi aur? Program ka naam aur morning/evening bata dein, taake usi ki eligibility de sakun."
        : "Which program and morning/evening session are you applying for? Admission eligibility differs by program.",
      "program_required",
    );
  const faqCandidates = (q: string) => {
    const facets = tokens(q).filter((t) =>
      ["hours", "fee", "paperwork", "requirement", "date"].includes(t),
    );
    return fs.filter((r) =>
      facets.every((t) => tokens(String(r.question)).includes(t)),
    );
  };
  let searchQuery = query;
  let hit = retrieve(query, faqCandidates(query), ds, role, settings);
  let rewritten = false;
  const aiEnabled = settings.geminiEnabled && settings.ragEnabled;
  if (!hit && aiEnabled && all.length) {
    try {
      const rewrittenQuery = await rewriter(query);
      if (rewrittenQuery && normalize(rewrittenQuery) !== normalize(query)) {
        searchQuery = rewrittenQuery;
        hit = retrieve(
          searchQuery,
          faqCandidates(searchQuery),
          ds,
          role,
          settings,
        );
        rewritten = !!hit;
      }
    } catch {
      /* Query understanding is optional, never required for known facts. */
    }
  }
  if (!hit)
    return clarification(
      roman(query)
        ? "Is sawaal ka clear, verified match KB mein nahi mila. Topic aur program/department ka naam zara wazeh kar dein; main university facts guess nahi karunga."
        : "I could not confidently match this question to verified university information. Please specify the topic and program or department. I will not guess university facts.",
      all.length ? "no_confident_match" : "no_eligible_sources",
    );
  const selected = selectSources(hit, all);
  if (!selected.length)
    return clarification(
      "No eligible source is available for this question.",
      "no_eligible_sources",
    );
  const ranges = new Set(
    selected
      .flatMap(
        (s) =>
          s.content.match(/\b\d{1,2}:\d{2}\s*(?:to|[-–])\s*\d{1,2}:\d{2}/gi) ??
          [],
      )
      .map((s) => s.replace(/\s/g, "")),
  );
  if (tokens(searchQuery).includes("hours") && ranges.size > 1)
    return {
      ...clarification(
        "The matching university sources contain different timings. Please confirm the applicable day/session with the relevant office.",
        "conflicting_sources",
      ),
      sourceReferences: selected.map((s) => s.reference),
    };
  const excerpts = focusedExcerpts(searchQuery, selected);
  // A compact direct answer is independent of generative APIs. For documents,
  // include all matching compact sources; do not arbitrarily choose one conflict.
  if (
    !rewritten &&
    selected.length === 1 &&
    clean(selected[0].content).length <= 400
  )
    return result(directText(query, selected[0]), selected, "verified");
  if (aiEnabled) {
    try {
      // Tables/headings can cross chunk boundaries. Add adjacent chunks from
      // the same already-authorized document, with a strict total budget.
      const context = [...selected];
      for (const offset of [-1, -2, 1])
        for (const source of selected) {
          if (
            source.type !== "DOCUMENT" ||
            source.reference.chunkIndex === undefined
          )
            continue;
          const neighbor = all.find(
            (s) =>
              s.type === "DOCUMENT" &&
              s.reference.id === source.reference.id &&
              s.reference.chunkIndex === source.reference.chunkIndex! + offset,
          );
          if (
            neighbor &&
            !context.some(
              (s) => s.reference.chunkId === neighbor.reference.chunkId,
            ) &&
            context.length < 8 &&
            context.reduce((n, s) => n + s.content.length, 0) +
              neighbor.content.length <=
              16000
          )
            context.push(neighbor);
        }
      if (context.reduce((n, s) => n + s.content.length, 0) > 16000)
        throw new Error("context_limit");
      const generated = await generator(
        query,
        context.map((s, i) => ({ ...s, source: i + 1 })),
      );
      if (generated.kind === "answer") {
        const { kind, ...answer } = generated;
        return {
          ...empty,
          ...answer,
          answerMode: "generated",
          resolution: "answered",
        };
      }
      // Provider abstention is evidence insufficiency, not an outage.
      return clarification(
        "The retrieved sources do not clearly answer that specific question. Please specify the program, department or date, or confirm with the relevant university office.",
        "insufficient_evidence",
      );
    } catch {
      /* Supply bounded excerpts below, not a false no-knowledge badge. */
    }
  }
  if (!rewritten && excerpts.length)
    return {
      ...result(
        "Relevant university source excerpts:\n\n" +
          excerpts.map((s) => s.content).join("\n\n"),
        excerpts,
        "excerpt",
      ),
      serviceDegraded: !!aiEnabled,
    };
  return clarification(
    "I found potentially relevant sources, but cannot confidently answer this wording right now. Please ask a more specific question or check with the relevant university office.",
    "generation_unavailable",
  );
}

/** Resolve only an explicit program-selection follow-up, not arbitrary chat history. */
export function resolveProgramFollowUp(
  question: string,
  messages: Row[],
): string {
  const latest = messages
    .filter((m) => m.sender === "assistant")
    .sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)))[0];
  if (latest?.failureReason !== "program_required" || question.length > 100)
    return question;
  if (
    /\b(fee|fees|scholarship|deadline|library|exam|hostel|timing)\b/i.test(
      question,
    )
  )
    return question;
  if (
    !/^(?:bs\b|bsc\b|bba\b|mba\b|ms\b|pharm[- ]?d\b|b\.?ed\b)/i.test(
      question.trim(),
    )
  )
    return question;
  return `Admission eligibility criteria for ${question.trim()}`;
}
