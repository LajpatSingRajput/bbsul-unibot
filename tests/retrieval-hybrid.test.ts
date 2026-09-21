import { test } from "node:test";
import assert from "node:assert/strict";
import { retrieve, tokens } from "../lib/retrieval";
import { answer, missing } from "../lib/chat";
import { defaultSettings, type Row } from "../lib/types";

// Synthetic fixtures: these are NOT actual BBSUL facts.
const chunk = (
  id: string,
  documentName: string,
  content: string,
  extra = {},
): Row => ({
  id,
  documentId: id,
  documentName,
  content,
  category: "Academic Queries",
  active: true,
  targetAudience: ["all"],
  ...extra,
});
const chunks = [
  chunk(
    "admission",
    "Admission handbook.txt",
    "Applicants must submit CNIC, photographs, intermediate certificate and domicile.",
  ),
  chunk(
    "fee",
    "Tuition notice.txt",
    "The semester tuition is PKR 42,000 in this test fixture.",
  ),
  chunk(
    "exam",
    "Assessment calendar.txt",
    "Examinations commence on 12 December 2026 in this test fixture.",
  ),
  chunk(
    "department",
    "Degree directory.txt",
    "The Department of Computing offers BS Computer Science.",
  ),
  chunk(
    "irrelevant",
    "Admission handbook.txt",
    "The cafeteria serves lunch at noon.",
  ),
  chunk(
    "other-fee",
    "Library charges.txt",
    "A replacement library card costs PKR 500.",
  ),
  chunk(
    "other-exam",
    "Exam handbook.txt",
    "Candidates must carry an identity card into the examination hall.",
  ),
];
const cases = [
  ["What are the admission requirements?", "admission"],
  ["admission ke liye kya chahiye?", "admission"],
  ["What documents do I need for admission?", "admission"],
  ["semester fee kitni hai?", "fee"],
  ["What is the semester fee?", "fee"],
  ["When do exams start?", "exam"],
  ["exam kab hain?", "exam"],
  ["Which departments offer BS Computer Science?", "department"],
  ["dakhla ke liye documents chahiye", "admission"],
  ["What paperwork is necessary for admission?", "admission"],
  ["semester ke akhrajat kitne hain?", "fee"],
  ["imtihan kab hain?", "exam"],
];
for (const [query, id] of cases)
  test(`grounded retrieval: ${query}`, async () => {
    const result = await answer(
      query,
      [],
      chunks,
      "student",
      { ...defaultSettings, geminiEnabled: true },
      async () => {
        throw new Error("Retrieval must not call Gemini");
      },
    );
    assert.equal(result.sourceType, "DOCUMENT");
    assert.deepEqual(
      result.sourceReferences.map((r) => r.id),
      [id],
    );
    assert.equal(result.text, chunks.find((c) => c.id === id)!.content);
    assert.equal(result.fallbackUsed, false);
  });
for (const query of [
  "What are the admission requirements for medicine?",
  "What is the hostel fee?",
  "exam results kab hain?",
  "What is the admission deadline?",
  "semester refund policy",
  "quantum entanglement",
])
  test(`reject unrelated or missing evidence: ${query}`, () => {
    assert.equal(retrieve(query, [], chunks, "student", defaultSettings), null);
  });
for (const query of [
  "exam kab hain?",
  "dakhla ke liye kya chahiye?",
  "semester fee kitni hai?",
  "Which departments offer BS Computer Science?",
])
  test(`missing campus facts never use fallback: ${query}`, async () => {
    let calls = 0;
    const result = await answer(
      query,
      [],
      [],
      "student",
      { ...defaultSettings, geminiEnabled: true, webSearchEnabled: true },
      async () => {
        calls++;
        throw new Error("Not permitted");
      },
    );
    assert.equal(calls, 0);
    assert.equal(result.text, missing);
  });
test("metadata alone cannot answer a question even at a zero threshold", () => {
  assert.equal(
    retrieve(
      "What are the admission requirements?",
      [],
      [chunk("a", "Admission requirements.txt", "The cafeteria serves lunch.")],
      "student",
      { ...defaultSettings, documentThreshold: 0 },
    ),
    null,
  );
});
test("legacy content-only chunks and optional keyword strings work", () => {
  const r = retrieve(
    "admission requirements",
    [],
    [
      chunk("legacy", "", chunks[0].content, {
        tags: "admission",
        keywords: ["requirements"],
      }),
    ],
    "student",
    defaultSettings,
  );
  assert.equal(r?.sourceReferences[0].id, "legacy");
});
test("restricted/inactive chunks never appear", () => {
  for (const extra of [{ active: false }, { targetAudience: ["faculty"] }])
    assert.equal(
      retrieve(
        "admission requirements",
        [],
        [chunk("private", "Admission", chunks[0].content, extra)],
        "student",
        defaultSettings,
      ),
      null,
    );
});
test("top evidence is bounded, deduplicated and carries chunk provenance", () => {
  const rows = Array.from({ length: 5 }, (_, i) =>
    chunk(
      `chunk${i}`,
      "Admission",
      `Applicants must submit certificate number ${i}.`,
      { documentId: "doc", chunkIndex: i },
    ),
  );
  const result = retrieve(
    "admission requirements",
    [],
    [rows[0], { ...rows[0], id: "duplicate" }, ...rows.slice(1)],
    "student",
    defaultSettings,
  );
  assert.equal(result?.sourceReferences.length, 3);
  assert.ok(result?.sourceReferences.every((r) => "chunkId" in r));
});
test("campus wording normalization", () => {
  assert.deepEqual(tokens("class timing"), ["class", "schedule"]);
  assert.deepEqual(tokens("ustad teacher departments fees"), [
    "faculty",
    "faculty",
    "department",
    "fee",
  ]);
});

test("fee amount without currency prefix", () => {
  assert.equal(
    retrieve(
      "What is the semester fee?",
      [],
      [chunk("fee", "Fees", "Semester fee: 42000")],
      "student",
      defaultSettings,
    )?.sourceType,
    "DOCUMENT",
  );
});
test("class timing matches a weekday and time", () => {
  assert.equal(
    retrieve(
      "class timing",
      [],
      [chunk("schedule", "Classes", "Monday at 10 AM.")],
      "student",
      defaultSettings,
    )?.sourceType,
    "DOCUMENT",
  );
});
test("a missing program qualifier is not ignored in a longer query", () => {
  assert.equal(
    retrieve(
      "Which departments offer BS Computer Science online?",
      [],
      chunks,
      "student",
      defaultSettings,
    ),
    null,
  );
});

test("title supplies topic while content supplies the answer", () => {
  const row = chunk(
    "metadata",
    "Admission requirements",
    "Submit CNIC and photographs.",
  );
  assert.equal(
    retrieve("admission requirements", [], [row], "student", defaultSettings)
      ?.sourceReferences[0].id,
    "metadata",
  );
  assert.equal(
    retrieve(
      "admission requirements",
      [],
      [{ ...row, documentName: "Notice" }],
      "student",
      defaultSettings,
    ),
    null,
  );
});
test("category, title alias and tags are searchable on older rows", () => {
  for (const extra of [
    { category: "Admission" },
    { title: "Admission" },
    { tags: ["Admission"] },
    { keywords: "Admission" },
  ]) {
    const row = chunk("metadata", "", "Submit CNIC and photographs.", extra);
    assert.equal(
      retrieve("admission requirements", [], [row], "student", defaultSettings)
        ?.sourceReferences[0].id,
      "metadata",
    );
  }
});

test("general application programming retains Gemini fallback", async () => {
  let calls = 0;
  const result = await answer(
    "Explain application programming",
    [],
    [],
    "student",
    { ...defaultSettings, geminiEnabled: true },
    async () => {
      calls++;
      return {
        text: "General educational explanation",
        sourceType: "GEMINI",
        sourceReferences: [],
        confidence: null,
      };
    },
  );
  assert.equal(calls, 1);
  assert.equal(result.sourceType, "GEMINI");
});
