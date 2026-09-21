import { test, before, after } from "node:test";
import { readFileSync } from "node:fs";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, setDoc, getDoc, updateDoc } from "firebase/firestore";
let env: RulesTestEnvironment;
before(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-unibot",
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
  });
  await env.withSecurityRulesDisabled(async (c) => {
    const db = c.firestore();
    for (const [id, role, status] of [
      ["alice", "student", "active"],
      ["bob", "student", "active"],
      ["teacher", "faculty", "active"],
      ["admin", "admin", "active"],
      ["disabled", "student", "inactive"],
    ])
      await setDoc(doc(db, "users", id), {
        uid: id,
        role,
        status,
        name: id,
        department: "IT",
      });
    await setDoc(doc(db, "conversations", "private"), { userId: "alice" });
    await setDoc(doc(db, "conversations/private/messages", "answer"), {
      sender: "assistant",
      text: "Private",
    });
    await setDoc(doc(db, "faqs", "one"), { question: "test" });
  });
});
after(async () => {
  await env?.cleanup();
});
const db = (uid: string, verified = true) =>
  env.authenticatedContext(uid, { email_verified: verified }).firestore();
test("owner reads own conversation", async () => {
  await assertSucceeds(getDoc(doc(db("alice"), "conversations/private")));
});
test("another student cannot read chat", async () =>
  assertFails(getDoc(doc(db("bob"), "conversations/private"))));
test("faculty cannot read student chat", async () =>
  assertFails(
    getDoc(doc(db("teacher"), "conversations/private/messages/answer")),
  ));
test("admin direct client cannot read private chat", async () =>
  assertFails(getDoc(doc(db("admin"), "conversations/private"))));
test("unverified account denied", async () =>
  assertFails(getDoc(doc(db("alice", false), "conversations/private"))));
test("inactive account denied", async () =>
  assertFails(getDoc(doc(db("disabled"), "faqs/one"))));
test("student cannot promote role", async () =>
  assertFails(updateDoc(doc(db("alice"), "users/alice"), { role: "admin" })));
test("student can update allowed profile field", async () =>
  assertSucceeds(
    updateDoc(doc(db("alice"), "users/alice"), { name: "Alice Student" }),
  ));
test("faculty cannot edit FAQ", async () =>
  assertFails(setDoc(doc(db("teacher"), "faqs/one"), { question: "evil" })));
test("admin client cannot bypass server last-admin flow", async () =>
  assertFails(updateDoc(doc(db("admin"), "users/admin"), { role: "student" })));
test("unauthenticated reads denied", async () =>
  assertFails(
    getDoc(doc(env.unauthenticatedContext().firestore(), "faqs/one")),
  ));
