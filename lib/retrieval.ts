import type { Row, Role } from "./types";
import { concepts, normalize, tokens } from "./retrieval-language";
export { normalize, tokens } from "./retrieval-language";
function cosine(a: Map<string, number>, b: Map<string, number>) {
  let dot = 0,
    aa = 0,
    bb = 0;
  for (const [k, v] of a) {
    dot += v * (b.get(k) || 0);
    aa += v * v;
  }
  for (const v of b.values()) bb += v * v;
  return aa && bb ? dot / Math.sqrt(aa * bb) : 0;
}
const textValue = (value: unknown): string =>
  typeof value === "string"
    ? value
    : Array.isArray(value)
      ? value.filter((x) => typeof x === "string").join(" ")
      : "";
const title = (r: Row) => textValue(r.question || r.documentName || r.title);
const metadata = (r: Row) =>
  `${title(r)} ${textValue(r.category)} ${textValue(r.tags)} ${textValue(r.keywords)}`;
const overlap = (q: Set<string>, words: Set<string>) =>
  q.size ? [...q].filter((t) => words.has(t)).length / q.size : 0;

// Scores are relevance signals, not probabilities. Metadata improves recall but
// cannot establish answer-bearing evidence on its own.
export function rank(query: string, rows: Row[], field: (r: Row) => string) {
  const corpus = rows.map((r) => tokens(field(r)));
  const q = [...new Set(tokens(query))];
  const semanticQuery = concepts(query, true);
  const df = new Map<string, number>();
  for (const ts of corpus)
    for (const t of new Set(ts)) df.set(t, (df.get(t) || 0) + 1);
  const vector = (ts: string[]) => {
    const m = new Map<string, number>();
    for (const t of ts) m.set(t, (m.get(t) || 0) + 1);
    for (const [t, n] of m)
      m.set(
        t,
        (1 + Math.log(n)) *
          (1 + Math.log((rows.length + 1) / ((df.get(t) || 0) + 1))),
      );
    return m;
  };
  const qv = vector(q);
  return rows
    .map((row, i) => {
      const body = textValue(row.answer || row.content);
      const bodyConcepts = concepts(body);
      const allConcepts = concepts(`${field(row)} ${metadata(row)}`);
      const coverage = overlap(new Set(q), new Set(corpus[i]));
      const semantic = overlap(semanticQuery, allConcepts);
      const titleMatch = overlap(new Set(q), new Set(tokens(title(row))));
      const categoryMatch = overlap(
        new Set(q),
        new Set(tokens(textValue(row.category))),
      );
      const phrase =
        q.length > 1 && tokens(body).join(" ").includes(q.join(" ")) ? 1 : 0;
      const exact =
        !!row.question && normalize(row.question) === normalize(query);
      // Missing named subjects/modifiers and answer facets must not be rescued by
      // a broad title/category, a long chunk, or an administrator's low threshold.
      const facets = ["requirement", "amount", "date", "hours", "schedule"];
      const facetsSupported = facets
        .filter((t) => semanticQuery.has(t))
        .every((t) => bodyConcepts.has(t));
      const supported =
        body.trim().length > 0 &&
        semanticQuery.size > 0 &&
        semantic >= 0.8 &&
        [...semanticQuery]
          .filter((t) => !facets.includes(t))
          .every((t) => allConcepts.has(t)) &&
        overlap(semanticQuery, bodyConcepts) > 0 &&
        facetsSupported;
      const score =
        exact && body.trim()
          ? 1
          : supported
            ? Math.min(
                1,
                0.25 * cosine(qv, vector(corpus[i])) +
                  0.25 * coverage +
                  0.35 * semantic +
                  0.08 * titleMatch +
                  0.04 * categoryMatch +
                  0.03 * phrase,
              )
            : 0;
      return { row, score };
    })
    .sort((a, b) => b.score - a.score);
}
function threshold(value: unknown, fallback: number) {
  return typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 1
    ? Math.max(value, 0.4)
    : fallback;
}
export function audienceAllowed(r: Row, role: Role) {
  return (
    r.active === true &&
    (role === "admin" ||
      r.targetAudience?.includes("all") ||
      r.targetAudience?.includes(role))
  );
}
export function retrieve(
  query: string,
  faqs: Row[],
  chunks: Row[],
  role: Role,
  settings: any,
) {
  const f = rank(
    query,
    faqs.filter((r) => audienceAllowed(r, role)),
    (r) => `${metadata(r)} ${textValue(r.answer)}`,
  )[0];
  if (f && f.score >= threshold(settings.faqThreshold, 0.55))
    return {
      text: f.row.answer,
      sourceType: "FAQ" as const,
      sourceReferences: [{ id: f.row.id, title: f.row.question }],
      confidence: f.score,
    };
  const ds = rank(
    query,
    chunks.filter((r) => audienceAllowed(r, role)),
    (r) => `${metadata(r)} ${textValue(r.content)}`,
  )
    .filter((x) => x.score >= threshold(settings.documentThreshold, 0.48))
    .filter(
      (x, i, all) =>
        all.findIndex(
          (other) =>
            other.row.documentId === x.row.documentId &&
            other.row.content === x.row.content,
        ) === i,
    )
    .slice(0, 3);
  if (ds.length)
    return {
      text:
        ds.length === 1
          ? ds[0].row.content
          : ds
              .map(
                (d) =>
                  `[${d.row.documentName || d.row.title || "University document"}${Number.isInteger(d.row.chunkIndex) ? ` — excerpt ${d.row.chunkIndex + 1}` : ""}]\n${d.row.content}`,
              )
              .join("\n\n"),
      sourceType: "DOCUMENT" as const,
      sourceReferences: ds.map((d) => ({
        id: d.row.documentId,
        title: d.row.documentName || d.row.title || "University document",
        chunkId: d.row.id,
        ...(Number.isInteger(d.row.chunkIndex)
          ? { chunkIndex: d.row.chunkIndex }
          : {}),
      })),
      confidence: ds[0].score,
    };
  return null;
}
export function universitySpecific(query: string) {
  const words = new Set(tokens(query));
  // Preserve explicit general educational questions and external HEC searches.
  const general =
    /^(explain|define|what (is|are))\b/i.test(query.trim()) &&
    /\b(concept|meaning|definition|difference|in general)\b/i.test(query);
  return (
    /\b(bbsul|lyari|our university|my university|my department|our campus|lms|student portal)\b/i.test(
      query,
    ) ||
    (!general &&
      [
        "admission",
        "semester",
        "enrollment",
        "exam",
        "fee",
        "faculty",
        "department",
        "schedule",
        "registration",
        "attendance",
        "hostel",
      ].some((t) => words.has(t))) ||
    (words.has("library") && (words.has("hours") || words.has("date")))
  );
}
export function needsWeb(query: string) {
  return /\b(latest|current|today|news|announc|recent|this year|deadline|hec|national scholarship)/i.test(
    query,
  );
}
export function suspicious(query: string) {
  return /ignore (all |any |the |your )?(previous|prior|system)|reveal.{0,20}(key|secret|prompt)|system prompt|override.{0,20}instruction/i.test(
    query,
  );
}
export function chunkText(text: string, size = 1200, overlap = 150) {
  const clean = text
    .replace(/\u0000/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const out: string[] = [];
  let start = 0;
  while (start < clean.length) {
    let end = Math.min(start + size, clean.length);
    if (end < clean.length) {
      const cut = clean.lastIndexOf(" ", end);
      if (cut > start + size / 2) end = cut;
    }
    out.push(clean.slice(start, end));
    if (end === clean.length) break;
    start = end - overlap;
  }
  return out;
}
