import { test } from "node:test";
import assert from "node:assert/strict";
import { answer, missing, groundedUnavailable } from "../lib/chat";
import { generateGrounded } from "../lib/gemini";
import { defaultSettings } from "../lib/types";
const row = {
  id: "lib",
  documentId: "doc",
  documentName: "Library notice",
  content: "Library timings are 9:00 to 5:00.",
  active: true,
  targetAudience: ["all"],
};
const settings = { ...defaultSettings, geminiEnabled: true, ragEnabled: true };
const noFallback: any = async () => {
  throw new Error("Unexpected fallback");
};
test("RAG uses eligible context and preserves provenance without persisting evidence", async () => {
  let calls = 0;
  const result = await answer(
    "library timings",
    [],
    [
      row,
      {
        ...row,
        id: "private",
        content: "Private faculty library hours",
        targetAudience: ["faculty"],
      },
    ],
    "student",
    settings,
    noFallback,
    async (q, evidence) => {
      calls++;
      assert.equal(q, "library timings");
      assert.deepEqual(evidence, [
        { title: row.documentName, content: row.content },
      ]);
      return { text: "Library ka waqt 9:00 se 5:00 hai." };
    },
  );
  assert.equal(calls, 1);
  assert.equal(result.text, "Library ka waqt 9:00 se 5:00 hai.");
  assert.equal(result.sourceType, "DOCUMENT");
  assert.equal(result.sourceReferences[0].id, "doc");
  assert.equal(result.fallbackUsed, false);
  assert.equal(result.webSearchUsed, false);
  assert.equal("evidence" in result, false);
});
for (const enabled of [{ geminiEnabled: false }, { ragEnabled: false }])
  test(`RAG opt-out ${JSON.stringify(enabled)}`, async () => {
    const result = await answer(
      "library timings",
      [],
      [row],
      "student",
      { ...settings, ...enabled },
      noFallback,
      async () => {
        throw new Error("Must not call");
      },
    );
    assert.equal(result.text, row.content);
  });
for (const mode of ["error", "abstain"])
  test(`RAG ${mode} does not dump evidence`, async () => {
    const result = await answer(
      "library timings",
      [],
      [row],
      "student",
      settings,
      noFallback,
      async () => {
        if (mode === "error") throw new Error("quota");
        return null;
      },
    );
    assert.equal(result.text, mode === "error" ? groundedUnavailable : missing);
  });
test("missing university information never reaches either API", async () => {
  let calls = 0;
  const result = await answer(
    "semester fee kitni hai",
    [],
    [row],
    "student",
    settings,
    noFallback,
    async () => {
      calls++;
      return { text: "invented" };
    },
  );
  assert.equal(calls, 0);
  assert.equal(result.text, missing);
});
test("FAQ answer also supports grounded generation", async () => {
  const faq = { ...row, question: "library hours", answer: row.content };
  const result = await answer(
    "library hours",
    [faq],
    [],
    "student",
    settings,
    noFallback,
    async (_, e) => {
      assert.equal(e[0].content, row.content);
      return { text: "Grounded explanation" };
    },
  );
  assert.equal(result.sourceType, "FAQ");
  assert.equal(result.text, "Grounded explanation");
});
function response(payload: any, finishReason = "STOP") {
  return new Response(
    JSON.stringify({
      candidates: [
        {
          finishReason,
          content: { parts: [{ text: JSON.stringify(payload) }] },
        },
      ],
    }),
  );
}
const valid = {
  supported: true,
  answer: "Library ka waqt 9:00 se 5:00 hai.",
  citations: [{ source: 1, quote: "9:00 to 5:00" }],
};
test("Gemini request uses structured grounded context without search tools", async () => {
  process.env.GEMINI_API_KEY = "test-key";
  process.env.GEMINI_MODEL = "test-model";
  const result = await generateGrounded(
    "library ka time?",
    [{ title: row.documentName, content: row.content }],
    async (_, opts) => {
      const body = JSON.parse(opts!.body as string);
      assert.equal(body.tools, undefined);
      assert.equal(body.generationConfig.responseMimeType, "application/json");
      const input = JSON.parse(body.contents[0].parts[0].text);
      assert.equal(input.sources[0].content, row.content);
      assert.equal(input.question, "library ka time?");
      assert.match(body.systemInstruction.parts[0].text, /untrusted/);
      return response(valid);
    },
  );
  assert.equal(result?.text, valid.answer);
});
for (const invalid of [
  { ...valid, citations: [] },
  { ...valid, citations: [{ source: 9, quote: "9:00" }] },
  { ...valid, citations: [{ source: 1, quote: "Sunday 8 AM" }] },
  { ...valid, citations: [{ source: 1, quote: "" }] },
  { ...valid, answer: "" },
])
  test(`invalid grounding rejected ${JSON.stringify(invalid)}`, async () => {
    await assert.rejects(() =>
      generateGrounded(
        "library",
        [{ title: "Library", content: row.content }],
        async () => response(invalid),
      ),
    );
  });
test("model abstention and incomplete answers", async () => {
  assert.equal(
    await generateGrounded(
      "library",
      [{ title: "Library", content: row.content }],
      async () => response({ supported: false, answer: "", citations: [] }),
    ),
    null,
  );
  await assert.rejects(() =>
    generateGrounded(
      "library",
      [{ title: "Library", content: row.content }],
      async () => response(valid, "MAX_TOKENS"),
    ),
  );
  await assert.rejects(() =>
    generateGrounded(
      "library",
      [{ title: "Library", content: row.content }],
      async () => new Response("quota", { status: 429 }),
    ),
  );
});

test("broad admission question does not pick one program FAQ", async () => {
  const faq = {
    ...row,
    question: "What is the Admission eligibility for BS Commerce?",
    answer: "BS Commerce needs 45% HSC.",
  };
  const doc = {
    ...row,
    documentName: "Admissions",
    content:
      "Admission eligibility criteria depend on the chosen department. BS Commerce needs 45% HSC. Scholarships are also available.",
  };
  const result = await answer(
    "What is the admission criteria?",
    [faq],
    [doc],
    "student",
    settings,
    noFallback,
    async (_, e) => {
      assert.equal(e[0].title, "Admissions");
      return {
        text: "Admission criteria program ke mutabiq hain. Kis program ke liye pooch rahe hain?",
      };
    },
  );
  assert.equal(result.sourceType, "DOCUMENT");
  assert.doesNotMatch(result.text, /scholarship/i);
});
test("formatting-only whitespace in model quotes remains grounded", async () => {
  const result = await generateGrounded(
    "admission",
    [{ title: "Policy", content: "Eligibility requires\n\n50% HSC." }],
    async () =>
      response({
        ...valid,
        answer: "50% HSC is required.",
        citations: [{ source: 1, quote: "Eligibility requires 50% HSC." }],
      }),
  );
  assert.equal(result?.text, "50% HSC is required.");
});
