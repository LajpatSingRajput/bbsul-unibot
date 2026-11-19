import { test, expect } from "@playwright/test";
test("source upload → student chat → cited offline answer → persisted history", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "admin", exact: true }).click();
  await expect(page).toHaveURL("/admin/dashboard");
  const upload = await page.request.post("/api/documents", {
    multipart: {
      file: {
        name: "library-reliability-fixture.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("Library timings are 9:00 to 5:00"),
      },
      category: "Campus Life Queries",
      audience: "all",
    },
  });
  expect(upload.ok(), await upload.text()).toBeTruthy();
  expect(
    (await page.request.post("/api/demo", { data: { role: "student" } })).ok(),
  ).toBeTruthy();
  await page.goto("/student/chat");
  await page
    .getByRole("textbox", { name: "Your message" })
    .fill("Library timing");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(
    page.getByText("Library timings: 9:00 to 5:00.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("library-reliability-fixture.txt", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/library-offline.png",
    fullPage: true,
  });
  await page.goto("/student/history");
  await page
    .locator(".history-list")
    .getByRole("link")
    .filter({ hasText: "Library timing" })
    .click();
  await page.reload();
  await expect(
    page.getByText("Library timings: 9:00 to 5:00.", { exact: true }),
  ).toBeVisible();
});
test("student does not receive faculty-only document content", async ({
  request,
}) => {
  await request.post("/api/demo", { data: { role: "admin" } });
  const upload = await request.post("/api/documents", {
    multipart: {
      file: {
        name: "faculty-only.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("Library timings are 10:00 to 4:00"),
      },
      category: "Campus Life Queries",
      audience: "faculty",
    },
  });
  expect(upload.ok(), await upload.text()).toBeTruthy();
  await request.post("/api/demo", { data: { role: "student" } });
  const reply = await request.post("/api/chat", {
    data: { question: "Library timing" },
  });
  expect(reply.ok()).toBeTruthy();
  const data = await reply.json();
  expect(data.assistant.text).not.toContain("10:00");
  expect(data.assistant.resolution).toBe("unresolved");
});
