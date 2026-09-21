import { test, expect } from "@playwright/test";
async function demo(page: any, role = "student") {
  await page.goto("/login");
  await page.getByRole("button", { name: role, exact: true }).click();
  await expect(page).toHaveURL(`/${role}/dashboard`);
}
test("student dashboard, chat, source, feedback and history", async ({
  page,
}) => {
  await demo(page);
  await page.getByRole("link", { name: "Ask UniBot AI" }).click();
  await page
    .getByRole("button", { name: "What can UniBot help me with?" })
    .click();
  await expect(
    page.getByText("University Knowledge Base", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Helpful", exact: true }).click();
  await expect(page.getByText("Feedback saved. Thank you.")).toBeVisible();
  await page.getByRole("link", { name: "Chat history", exact: true }).click();
  await expect(page).toHaveURL("/student/history");
  await expect(
    page
      .locator(".history-list")
      .getByText("What can UniBot help me with?", { exact: true }),
  ).toBeVisible();
});
test("faculty login remains separate from administration", async ({ page }) => {
  await demo(page, "faculty");
  await expect(
    page.getByText("Department resources", { exact: true }),
  ).toBeVisible();
  expect((await page.request.get("/api/users")).status()).toBe(403);
  await page.goto("/admin/dashboard");
  await expect(page).toHaveURL("/faculty/dashboard");
});
test("admin FAQ CRUD, source refresh and source precedence", async ({
  page,
}) => {
  await demo(page, "admin");
  await page.getByRole("link", { name: "FAQs", exact: true }).click();
  await page.getByRole("button", { name: "Add FAQ", exact: true }).click();
  await page
    .getByLabel("Question", { exact: true })
    .fill("What is the test robotics access code?");
  await page
    .getByLabel("Verified answer")
    .fill("TEST FIXTURE ONLY: Robotics access requires supervisor approval.");
  await page.getByRole("button", { name: "Save FAQ", exact: true }).click();
  await expect(
    page.getByText("What is the test robotics access code?", { exact: true }),
  ).toBeVisible();
  const r = await page.request.post("/api/chat", {
    data: { question: "What is the test robotics access code?" },
  });
  expect(r.ok()).toBeTruthy();
  expect((await r.json()).assistant.sourceType).toBe("FAQ");
});
test("server authorization, profile role tampering, IDOR, last-admin safety", async ({
  request,
}) => {
  expect((await request.get("/api/users")).status()).toBe(401);
  await request.post("/api/demo", { data: { role: "student" } });
  expect(
    (
      await request.patch("/api/profile", {
        data: { name: "Alice", department: "IT", role: "admin" },
      })
    ).status(),
  ).toBe(400);
  expect((await request.get("/api/users")).status()).toBe(403);
  const r = await request.post("/api/chat", {
    data: { question: "What can UniBot help me with?" },
  });
  const id = (await r.json()).conversationId;
  await request.post("/api/demo", { data: { role: "faculty" } });
  expect((await request.get(`/api/conversations/${id}`)).status()).toBe(404);
  await request.post("/api/demo", { data: { role: "admin" } });
  expect(
    (
      await request.patch("/api/users/demo-admin", {
        data: { role: "admin", status: "inactive" },
      })
    ).status(),
  ).toBe(409);
  expect((await request.get("/api/admin-conversations")).status()).toBe(403);
});
test("upload, retrieve, deactivate, reprocess and delete document", async ({
  request,
}) => {
  await request.post("/api/demo", { data: { role: "admin" } });
  const upload = await request.post("/api/documents", {
    multipart: {
      file: {
        name: "training.txt",
        mimeType: "text/plain",
        buffer: Buffer.from(
          "TEST FIXTURE ONLY: The robotics laboratory requires a blue training certificate for access.",
        ),
      },
      category: "Academic Queries",
      audience: "all",
    },
  });
  expect(upload.ok(), await upload.text()).toBeTruthy();
  const docs = await (await request.get("/api/documents")).json();
  const id = docs[0].id;
  let r = await (
    await request.post("/api/chat", {
      data: { question: "robotics laboratory blue training certificate" },
    })
  ).json();
  expect(r.assistant.sourceType).toBe("DOCUMENT");
  await request.patch(`/api/documents/${id}`, { data: { active: false } });
  r = await (
    await request.post("/api/chat", {
      data: { question: "robotics laboratory blue training certificate" },
    })
  ).json();
  expect(r.assistant.sourceType).toBeNull();
  expect(
    (await request.post(`/api/documents/${id}/reprocess`, { data: {} })).ok(),
  ).toBeTruthy();
  await request.delete(`/api/documents/${id}`);
  expect(await (await request.get("/api/knowledge-base")).json()).toHaveLength(
    0,
  );
});
test("invalid uploads, input, unresolved logging and XSS output safety", async ({
  page,
}) => {
  await demo(page, "admin");
  expect(
    (
      await page.request.post("/api/documents", {
        multipart: {
          file: {
            name: "attack.html",
            mimeType: "text/html",
            buffer: Buffer.from("<script>alert(1)</script>"),
          },
          category: "Academic Queries",
        },
      })
    ).status(),
  ).toBe(400);
  expect(
    (await page.request.post("/api/chat", { data: { question: "" } })).status(),
  ).toBe(400);
  expect(
    (
      await page.request.post("/api/chat", {
        data: { question: "x".repeat(2001) },
      })
    ).status(),
  ).toBe(400);
  const r = await (
    await page.request.post("/api/chat", {
      data: { question: "What is my BBSUL exam date?" },
    })
  ).json();
  expect(r.assistant.sourceType).toBeNull();
  expect(await (await page.request.get("/api/unresolved")).json()).toHaveLength(
    1,
  );
  await page.request.post("/api/demo", { data: { role: "student" } });
  await page.goto("/student/chat");
  await page
    .getByLabel("Your message")
    .fill('<img src=x onerror="window.__xss=true">');
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(
    page.getByText('<img src=x onerror="window.__xss=true">', { exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => (window as any).__xss)).toBeUndefined();
});
test("desktop and mobile layout with accessible navigation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "A whole campus. One conversation." }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/landing-desktop.png",
    fullPage: true,
  });
  await demo(page);
  await page.screenshot({
    path: "test-results/student-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("link", { name: "Ask UniBot AI" }).click();
  await expect(page.getByLabel("Your message")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: "test-results/chat-mobile.png",
    fullPage: true,
  });
});
