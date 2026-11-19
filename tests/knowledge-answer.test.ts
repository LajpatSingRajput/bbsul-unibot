import { test } from "node:test";
import assert from "node:assert/strict";
import {
  knowledgeSources,
  validateKnowledgeAnswer,
  generateKnowledgeAnswer,
  MAX_KB_CHARACTERS,
} from "../lib/knowledge-answer";
import { answer, missing, groundedUnavailable } from "../lib/chat";
const row = {
  id: "chunk",
  documentId: "doc",
  documentName: "Library",
  content: "Library timings are 9:00 to 5:00.",
  active: true,
  targetAudience: ["all"],
};
const sources = knowledgeSources([], [row], "student");
const payload = {
  supported: true,
  universityQuestion: true,
  answer: "Library ka waqt 9:00 se 5:00 hai.",
  citations: [{ source: 1, quote: "9:00 to 5:00" }],
};
const settings = {
  geminiEnabled: true,
  ragEnabled: true,
  fullContextEnabled: true,
};
const forbidden: any = async () => {
  throw new Error("Unexpected provider call");
};
test("whole KB filters inactive and audience-restricted text before transmission", () => {
  const selected = knowledgeSources(
    [{ ...row, id: "faq", question: "Hours", answer: "9:00 to 5:00" }],
    [
      row,
      { ...row, id: "hidden", active: false },
      { ...row, id: "faculty", targetAudience: ["faculty"] },
    ],
    "student",
  );
  assert.equal(selected.length, 2);
  assert.deepEqual(
    selected.map((s) => s.reference.id),
    ["faq", "doc"],
  );
});
test("references contain only cited sources, including later KB entries", () => {
  const all = knowledgeSources(
    [],
    [
      row,
      {
        ...row,
        id: "second",
        documentId: "secondDoc",
        content: "The campus has a cafeteria.",
      },
    ],
    "student",
  );
  const result = validateKnowledgeAnswer(JSON.stringify(payload), all);
  assert.equal(result.kind, "answer");
  if (result.kind === "answer")
    assert.deepEqual(result.sourceReferences, [sources[0].reference]);
});
test("fabricated quotes and reference indices are rejected", () => {
  for (const citation of [
    { source: 1, quote: "8am" },
    { source: 2, quote: "9:00" },
    { source: 1, quote: " " },
  ])
    assert.throws(() =>
      validateKnowledgeAnswer(
        JSON.stringify({ ...payload, citations: [citation] }),
        sources,
      ),
    );
});
test("AI receives the full eligible KB even when lexical retrieval misses", async () => {
  const result = await answer(
    "janeman kitabon wali jagah kab khulti hai?",
    [],
    [row],
    "student",
    settings,
    forbidden,
    forbidden,
    async (q, e) => {
      assert.equal(e[0].content, row.content);
      return validateKnowledgeAnswer(JSON.stringify(payload), e);
    },
  );
  assert.equal(result.text, payload.answer);
  assert.ok("answerMode" in result);
  assert.equal(result.answerMode, "generated");
});
test("missing campus answers and provider outages never reach general fallback", async () => {
  for (const failed of [false, true]) {
    const r = await answer(
      "library hours",
      [],
      [row],
      "student",
      settings,
      forbidden,
      forbidden,
      async () => {
        if (failed) throw new Error("outage");
        return { kind: "missing" };
      },
    );
    assert.equal(r.text, failed ? groundedUnavailable : missing);
  }
});
test("explicit general classification can use existing educational fallback", async () => {
  const r = await answer(
    "Explain binary search",
    [],
    [row],
    "student",
    settings,
    async () => ({
      text: "General answer",
      sourceType: "GEMINI",
      sourceReferences: [],
      confidence: null,
    }),
    forbidden,
    async () => ({ kind: "general" }),
  );
  assert.equal(r.text, "General answer");
  assert.equal(r.fallbackUsed, true);
});
test("Gemini failure invokes OpenRouter and validates its citations", async () => {
  const saved = { ...process.env };
  try {
    process.env.GEMINI_API_KEY = "test";
    process.env.RAG_MODEL = "gemini-2.5-flash";
    process.env.OPENROUTER_API_KEY = "backup-test";
    process.env.OPENROUTER_MODEL = "openrouter/free";
    const calls: string[] = [];
    const result = await generateKnowledgeAnswer(
      "library hours",
      sources,
      async (url, init) => {
        calls.push(String(url));
        const body = JSON.parse(String(init?.body));
        if (calls.length === 1) {
          assert.equal(body.generationConfig.thinkingConfig.thinkingBudget, 0);
          return new Response("", { status: 429 });
        }
        assert.equal(body.response_format.type, "json_schema");
        return new Response(
          JSON.stringify({
            choices: [
              {
                finish_reason: "stop",
                message: { content: JSON.stringify(payload) },
              },
            ],
          }),
        );
      },
    );
    assert.equal(result.kind, "answer");
    assert.equal(calls.length, 2);
    assert.match(calls[1], /openrouter.ai/);
  } finally {
    process.env = saved;
  }
});
test("oversized KB fails explicitly instead of silently dropping sources", async () => {
  await assert.rejects(
    generateKnowledgeAnswer(
      "hours",
      [{ ...sources[0], content: "x".repeat(MAX_KB_CHARACTERS) }],
      forbidden,
    ),
    /knowledge_context_limit/,
  );
});

test("existing quote cannot justify invented numeric claims or meridiem", () => {
  for (const text of [
    "Library hours are 8:00 to 5:00.",
    "Library hours are 9:00 AM to 5:00 PM.",
  ])
    assert.throws(
      () =>
        validateKnowledgeAnswer(
          JSON.stringify({ ...payload, answer: text }),
          sources,
        ),
      /invalid_/,
    );
});
