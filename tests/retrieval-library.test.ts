import { test } from "node:test";
import assert from "node:assert/strict";
import { answer, missing } from "../lib/chat";
import { defaultSettings, type Row } from "../lib/types";

// Reproduces the misspelling in the user's stored PDF, not an invented policy.
const stored: Row = {
  id: "library-chunk",
  documentId: "library-document",
  documentName: "Library timigs are 9.pdf",
  content: "Library timigs are 9:00 to 5:00\n\n-- 1 of 1 --",
  category: "Campus Life Queries",
  targetAudience: ["all"],
  active: true,
};
const settings = { ...defaultSettings, geminiEnabled: true };
for (const query of [
  "can you tell me about library timings?",
  "library",
  "What are the library opening hours?",
  "What time does the library open?",
  "When does the library open?",
  "library timing kya hai?",
  "library ka time kya hai?",
])
  test(`stored library typo: ${query}`, async () => {
    const result = await answer(
      query,
      [],
      [stored],
      "faculty",
      settings,
      async () => {
        throw new Error("Must not call AI");
      },
    );
    assert.equal(result.sourceType, "DOCUMENT");
    assert.equal(result.text, stored.content);
    assert.equal(result.sourceReferences[0].id, stored.documentId);
    assert.equal(result.fallbackUsed, false);
  });
test("clock range supports hours without the word timings", async () => {
  const row = {
    ...stored,
    documentName: "Library notice.pdf",
    content: "Library: 9:00 to 5:00",
  };
  const result = await answer(
    "can you tell me about library timings?",
    [],
    [row],
    "faculty",
    settings,
  );
  assert.equal(result.text, row.content);
  assert.equal(result.sourceType, "DOCUMENT");
});
for (const content of [
  "Library membership requires a student card.",
  "Library has 900 to 5000 books.",
  "The library is on floor 9 near room 5.",
])
  test(`unrelated library numbers are not timing evidence: ${content}`, async () => {
    const result = await answer(
      "can you tell me about library timings?",
      [],
      [{ ...stored, content }],
      "faculty",
      settings,
    );
    assert.equal(result.text, missing);
    assert.equal(result.sourceType, null);
  });
for (const query of [
  "What are the library timings on Sunday?",
  "What are the library timings during Ramadan?",
  "What are the cafeteria timings?",
])
  test(`unsupported timing qualifier: ${query}`, async () => {
    const result = await answer(query, [], [stored], "faculty", {
      ...settings,
      geminiEnabled: false,
    });
    assert.equal(result.sourceType, null);
  });

for (const query of [
  "janeman, tell me the time of libaray",
  "bhai can you tell me library timing?",
  "I want to know the library opening hours",
  "please give me information regarding libaray hours",
])
  test(`conversational library query: ${query}`, async () => {
    const result = await answer(
      query,
      [],
      [stored],
      "faculty",
      { ...settings, ragEnabled: true },
      async () => {
        throw new Error("Must not use general fallback");
      },
      async (_q, evidence) => {
        assert.equal(evidence[0].content, stored.content);
        return { text: "Library ka waqt 9:00 se 5:00 hai." };
      },
    );
    assert.equal(result.sourceType, "DOCUMENT");
    assert.equal(result.text, "Library ka waqt 9:00 se 5:00 hai.");
  });
test("unavailable misspelled library topic never reaches general Gemini", async () => {
  let called = false;
  const result = await answer(
    "janeman, tell me the time of libaray",
    [],
    [],
    "faculty",
    settings,
    async () => {
      called = true;
      throw new Error("Not permitted");
    },
  );
  assert.equal(called, false);
  assert.equal(result.text, missing);
});
