import { NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import {
  authenticate,
  checkOrigin,
  demoCookie,
  readDemo,
  rateLimit,
} from "@/lib/auth";
import { firebase, demoMode } from "@/lib/firebase-server";
import {
  cloudinaryUpload,
  cloudinaryDownload,
  cloudinaryDelete,
} from "@/lib/cloudinary-storage";
import {
  AppError,
  assertAdmin,
  assertOwner,
  protectLastAdmin,
  faqSchema,
  profileSchema,
  settingsSchema,
  idSchema,
  questionSchema,
} from "@/lib/validation";
import { defaultSettings, now, categories } from "@/lib/types";
import { answer } from "@/lib/chat";
import { extractFile, validateFile, MAX_FILE } from "@/lib/documents";
export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";
const json = (data: any, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
async function body(req: Request) {
  const raw = await req.text();
  if (raw.length > 200000) throw new AppError(413, "Request is too large.");
  return JSON.parse(raw || "{}");
}
async function handler(
  req: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  try {
    const { path } = await params;
    const [section, id, action] = path;
    const method = req.method;
    if (method !== "GET") checkOrigin(req);
    if (section === "config" && method === "GET")
      return json({
        demo: demoMode(),
        configured: !!process.env.FIREBASE_PROJECT_ID,
        geminiConfigured: !!process.env.GEMINI_API_KEY,
        categories,
      });
    if (section === "demo" && method === "POST") {
      if (!demoMode()) throw new AppError(404, "Not found.");
      const { role } = z
        .object({ role: z.enum(["student", "faculty", "admin"]) })
        .parse(await body(req));
      const res = json({ ok: true });
      res.cookies.set("unibot_demo", demoCookie(role, readDemo(req)?.session), {
        httpOnly: true,
        sameSite: "lax",
        secure: new URL(req.url).protocol === "https:",
        maxAge: 86400,
        path: "/",
      });
      return res;
    }
    if (section === "logout" && method === "POST") {
      const res = json({ ok: true });
      res.cookies.delete("unibot_demo");
      return res;
    }
    const { user, store, demo, verified } = await authenticate(
      req,
      section === "profile",
    );
    const uid = user.uid;
    if (id) idSchema.parse(id);
    if (section === "profile") {
      if (method === "GET") return json({ ...user, verified, demo });
      if (method === "PATCH") {
        const input = profileSchema.parse(await body(req));
        return json(
          await store.patch("users", uid, { ...input, updatedAt: now() }),
        );
      }
      if (method === "POST") {
        const input = z
          .object({
            name: z.string().trim().min(2).max(100),
            department: z.string().max(100),
            requestedRole: z.enum(["student", "faculty"]),
          })
          .parse(await body(req));
        return json(
          await store.patch("users", uid, {
            name: input.name,
            department: input.department,
            requestedRole: input.requestedRole,
            updatedAt: now(),
          }),
        );
      }
    }
    const settings = {
      ...defaultSettings,
      ...(await store.get("systemSettings", "main")),
    };
    if (section === "chat-settings" && method === "GET")
      return json({
        displayName: settings.displayName,
        welcomeMessage: settings.welcomeMessage,
        maintenanceMode: settings.maintenanceMode,
      });
    if (section === "resources" && method === "GET") {
      return json(
        (await store.list("documents"))
          .filter(
            (d) =>
              d.active &&
              d.status === "ready" &&
              (d.targetAudience?.includes("all") ||
                d.targetAudience?.includes(user.role)),
          )
          .map(({ id, name, category, createdAt }: any) => ({
            id,
            name,
            category,
            createdAt,
          })),
      );
    }
    if (section === "conversations") {
      if (method === "GET" && !id)
        return json(
          (await store.list("conversations", "userId", uid)).sort((a, b) =>
            b.updatedAt.localeCompare(a.updatedAt),
          ),
        );
      if (id) {
        const c = await store.get("conversations", id);
        assertOwner(c, uid);
        if (method === "GET")
          return json({
            ...c,
            messages: (await store.list(`conversations/${id}/messages`)).sort(
              (a, b) => a.timestamp.localeCompare(b.timestamp),
            ),
          });
        if (method === "DELETE") {
          for (const f of await store.list("feedback", "conversationId", id))
            await store.remove("feedback", f.id);
          await store.remove("conversations", id);
          return json({ ok: true });
        }
      }
    }
    if (section === "chat" && method === "POST") {
      if (settings.maintenanceMode && user.role !== "admin")
        throw new AppError(
          503,
          "UniBot is temporarily under maintenance. Please try again later.",
        );
      const input = z
        .object({
          question: questionSchema,
          conversationId: idSchema.optional(),
        })
        .parse(await body(req));
      await rateLimit(store, uid);
      let c = input.conversationId
        ? await store.get("conversations", input.conversationId)
        : null;
      if (input.conversationId) assertOwner(c, uid);
      if (!c)
        c = await store.put("conversations", {
          userId: uid,
          userRole: user.role,
          title: input.question.slice(0, 65),
          createdAt: now(),
          updatedAt: now(),
          lastMessage: "",
        });
      const cid = c.id;
      const docs = await store.list("documents");
      const allowed = new Set(
        docs
          .filter((d) => d.active && d.status === "ready")
          .map((d) => `${d.id}:${d.generation}`),
      );
      const chunks = (await store.list("knowledgeChunks")).filter((r) =>
        allowed.has(`${r.documentId}:${r.generation}`),
      );
      const effective = {
        ...settings,
        geminiEnabled:
          settings.geminiEnabled &&
          process.env.GEMINI_ENABLED === "true" &&
          !demo,
        webSearchEnabled:
          settings.webSearchEnabled &&
          process.env.WEB_SEARCH_ENABLED === "true" &&
          !demo,
      };
      const result = await answer(
        input.question,
        await store.list("faqs"),
        chunks,
        user.role,
        effective,
      );
      const t = now();
      const userMessage = await store.put(`conversations/${cid}/messages`, {
        sender: "user",
        text: input.question,
        timestamp: t,
      });
      const assistant = await store.put(`conversations/${cid}/messages`, {
        sender: "assistant",
        ...result,
        timestamp: now(),
      });
      await store.patch("conversations", cid, {
        updatedAt: now(),
        lastMessage: result.text.slice(0, 160),
      });
      if (result.resolution !== "answered")
        await store.put("unresolvedQueries", {
          query: input.question,
          userRole: user.role,
          fallbackUsed: result.fallbackUsed,
          webSearchUsed: result.webSearchUsed,
          resolved: false,
          timestamp: now(),
          resolution: result.resolution,
        });
      return json({ conversationId: cid, userMessage, assistant });
    }
    if (section === "feedback" && method === "POST") {
      const x = z
        .object({
          conversationId: idSchema,
          messageId: idSchema,
          rating: z.enum(["helpful", "not-helpful"]),
        })
        .parse(await body(req));
      assertOwner(await store.get("conversations", x.conversationId), uid);
      const msg = await store.get(
        `conversations/${x.conversationId}/messages`,
        x.messageId,
      );
      if (msg?.sender !== "assistant")
        throw new AppError(404, "Answer not found.");
      return json(
        await store.put(
          "feedback",
          {
            ...x,
            userId: uid,
            sourceType: msg.sourceType,
            answer: msg.text,
            createdAt: now(),
          },
          `${uid}_${x.messageId}`,
        ),
      );
    }
    assertAdmin(user.role);
    const audit = async (event: string, target: string) =>
      store.put("auditLogs", { actor: uid, event, target, createdAt: now() });
    if (section === "analytics" && method === "GET") {
      const [users, faqs, docs, convs, feedback, unresolved] =
        await Promise.all(
          [
            "users",
            "faqs",
            "documents",
            "conversations",
            "feedback",
            "unresolvedQueries",
          ].map((k) => store.list(k)),
        );
      const counts: any = { FAQ: 0, DOCUMENT: 0, GEMINI: 0, WEB: 0 };
      let messages = 0;
      for (const c of convs) {
        for (const m of await store.list(`conversations/${c.id}/messages`)) {
          messages++;
          if (m.sender === "assistant" && m.sourceType)
            counts[m.sourceType] = (counts[m.sourceType] || 0) + 1;
        }
      }
      return json({
        users: users.length,
        students: users.filter((u) => u.role === "student").length,
        faculty: users.filter((u) => u.role === "faculty").length,
        admins: users.filter((u) => u.role === "admin").length,
        faqs: faqs.length,
        documents: docs.length,
        conversations: convs.length,
        messages,
        counts,
        unresolved: unresolved.filter((r) => !r.resolved).length,
        helpful: feedback.filter((f) => f.rating === "helpful").length,
        notHelpful: feedback.filter((f) => f.rating === "not-helpful").length,
      });
    }
    if (section === "settings") {
      if (method === "GET")
        return json({
          ...settings,
          geminiConfigured: !!process.env.GEMINI_API_KEY,
          geminiAllowed: process.env.GEMINI_ENABLED === "true",
          searchAllowed: process.env.WEB_SEARCH_ENABLED === "true",
          model: process.env.GEMINI_MODEL || "Not configured",
        });
      if (method === "PUT") {
        const input = settingsSchema.parse(await body(req));
        await store.put("systemSettings", input, "main");
        await audit("settings.updated", "main");
        return json(input);
      }
    }
    if (section === "users") {
      if (method === "GET") return json(await store.list("users"));
      if (method === "PATCH" && id) {
        const x = z
          .object({
            role: z.enum(["student", "faculty", "admin"]),
            status: z.enum(["active", "inactive"]),
          })
          .parse(await body(req));
        if (id === uid && x.role !== user.role)
          throw new AppError(
            403,
            "Ask another administrator to change your role.",
          );
        if (demo) {
          const target = await store.get("users", id);
          if (!target) throw new AppError(404, "User not found.");
          protectLastAdmin(
            target,
            x.role,
            x.status,
            (await store.list("users")).filter(
              (u) => u.role === "admin" && u.status === "active",
            ).length,
          );
          await store.patch("users", id, x);
        } else {
          const db = firebase().db;
          await db.runTransaction(async (tx) => {
            const ref = db.collection("users").doc(id);
            const lock = db.collection("systemSettings").doc("adminLock");
            const [target, admins] = await Promise.all([
              tx.get(ref),
              tx.get(db.collection("users").where("role", "==", "admin")),
            ]);
            await tx.get(lock);
            if (!target.exists) throw new AppError(404, "User not found.");
            protectLastAdmin(
              target.data(),
              x.role,
              x.status,
              admins.docs.filter((d) => d.data().status === "active").length,
            );
            tx.update(ref, { ...x, updatedAt: now() });
            tx.set(lock, { updatedAt: now() });
          });
        }
        await audit("user.updated", id);
        return json({ ok: true });
      }
    }
    if (section === "faqs") {
      if (method === "GET") return json(await store.list("faqs"));
      if (method === "POST" && id === "import") {
        const rows = z
          .array(faqSchema)
          .min(1)
          .max(250)
          .parse(await body(req));
        for (const row of rows)
          await store.put("faqs", {
            ...row,
            createdBy: uid,
            createdAt: now(),
            updatedAt: now(),
          });
        await audit("faqs.imported", String(rows.length));
        return json({ count: rows.length });
      }
      if (method === "POST" || (method === "PUT" && id)) {
        const x = faqSchema.parse(await body(req));
        const previous = id ? await store.get("faqs", id) : null;
        if (id && !previous) throw new AppError(404, "FAQ not found.");
        const r = await store.put(
          "faqs",
          {
            ...previous,
            ...x,
            createdBy: previous?.createdBy || uid,
            createdAt: previous?.createdAt || now(),
            updatedAt: now(),
          },
          id,
        );
        await audit("faq.saved", r.id);
        return json(r);
      }
      if (method === "DELETE" && id) {
        await store.remove("faqs", id);
        await audit("faq.deleted", id);
        return json({ ok: true });
      }
    }
    if (section === "documents") {
      if (method === "GET")
        return json(
          (await store.list("documents")).map(({ bytes, ...d }) => d),
        );
      if (method === "POST") {
        await rateLimit(store, uid, "upload", 5);
        let doc: any, bytes: Buffer;
        if (id && action === "reprocess") {
          doc = await store.get("documents", id);
          if (!doc) throw new AppError(404, "Document not found.");
          bytes = demo
            ? Buffer.from(doc.bytes, "base64")
            : await cloudinaryDownload(doc.storagePath);
        } else {
          if (
            Number(req.headers.get("content-length") || 0) >
            MAX_FILE + 100000
          )
            throw new AppError(413, "File is too large.");
          const form = await req.formData();
          const file = form.get("file");
          if (!(file instanceof File))
            throw new AppError(400, "Select a document.");
          const ext = validateFile(file.name, file.size);
          if (
            !settings.allowedDocumentTypes.includes(ext) ||
            file.size > settings.maxUploadMB * 1024 * 1024
          )
            throw new AppError(
              400,
              "This file exceeds the configured size or type policy.",
            );
          bytes = Buffer.from(await file.arrayBuffer());
          const category = z
            .enum(categories as [string, ...string[]])
            .parse(form.get("category"));
          const audience = z
            .enum(["all", "student", "faculty"])
            .parse(form.get("audience") || "all");
          const did = randomUUID();
          const name = file.name
            .replace(/[^\p{L}\p{N} ._-]/gu, "_")
            .slice(0, 150);
          doc = await store.put(
            "documents",
            {
              name,
              originalName: name,
              fileType: ext,
              size: bytes.length,
              category,
              targetAudience: [audience],
              status: "processing",
              active: false,
              uploadedBy: uid,
              createdAt: now(),
              updatedAt: now(),
              storagePath: `documents/${did}/source.${ext}`,
              ...(demo ? { bytes: bytes.toString("base64") } : {}),
            },
            did,
          );
        }
        // Disable first: previous chunks can never be served during a failed reprocess.
        await store.patch("documents", doc.id, {
          status: "processing",
          active: false,
          updatedAt: now(),
        });
        try {
          const chunks = await extractFile(doc.name, bytes);
          if (!demo && !(id && action === "reprocess"))
            await cloudinaryUpload(doc.storagePath, bytes);
          const generation = randomUUID();
          for (const old of await store.list(
            "knowledgeChunks",
            "documentId",
            doc.id,
          ))
            await store.remove("knowledgeChunks", old.id);
          for (let i = 0; i < chunks.length; i++)
            await store.put("knowledgeChunks", {
              documentId: doc.id,
              documentName: doc.name,
              content: chunks[i],
              category: doc.category,
              targetAudience: doc.targetAudience,
              active: true,
              generation,
              chunkIndex: i,
              createdAt: now(),
            });
          await store.patch("documents", doc.id, {
            status: "ready",
            active: true,
            generation,
            chunkCount: chunks.length,
            error: null,
            updatedAt: now(),
          });
          await audit("document.processed", doc.id);
          return json({ ok: true });
        } catch (e) {
          const message =
            e instanceof AppError
              ? e.message
              : "Text extraction failed. Check the file and try again.";
          await store.patch("documents", doc.id, {
            status: "failed",
            active: false,
            error: message,
            updatedAt: now(),
          });
          throw new AppError(400, message);
        }
      }
      if (id && method === "PATCH") {
        const { active } = z
          .object({ active: z.boolean() })
          .parse(await body(req));
        const d = await store.get("documents", id);
        if (!d || d.status !== "ready")
          throw new AppError(400, "Only processed documents can be enabled.");
        await store.patch("documents", id, { active, updatedAt: now() });
        await audit("document.toggled", id);
        return json({ ok: true });
      }
      if (id && method === "DELETE") {
        const d = await store.get("documents", id);
        if (d) {
          await store.patch("documents", id, {
            active: false,
            status: "deleting",
          });
          for (const c of await store.list("knowledgeChunks", "documentId", id))
            await store.remove("knowledgeChunks", c.id);
          if (!demo)
            await cloudinaryDelete(d.storagePath);
          await store.remove("documents", id);
        }
        await audit("document.deleted", id);
        return json({ ok: true });
      }
    }
    if (section === "knowledge-base" && method === "GET")
      return json(await store.list("knowledgeChunks"));
    if (section === "admin-conversations" && method === "GET") {
      if (!settings.adminConversationAccess)
        throw new AppError(
          403,
          "Conversation review is disabled. Enable it in Settings only with university approval.",
        );
      await audit("conversations.reviewed", id || "list");
      if (id)
        return json({
          ...(await store.get("conversations", id)),
          messages: await store.list(`conversations/${id}/messages`),
        });
      return json(await store.list("conversations"));
    }
    if (section === "feedback" && method === "GET")
      return json(await store.list("feedback"));
    if (section === "unresolved") {
      if (method === "GET") return json(await store.list("unresolvedQueries"));
      if (method === "PATCH" && id) {
        const { resolved } = z
          .object({ resolved: z.boolean() })
          .parse(await body(req));
        await store.patch("unresolvedQueries", id, { resolved });
        await audit("query.resolved", id);
        return json({ ok: true });
      }
    }
    throw new AppError(404, "Endpoint not found.");
  } catch (e) {
    if (e instanceof AppError) return json({ error: e.message }, e.status);
    if (e instanceof z.ZodError)
      return json(
        {
          error: e.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; "),
        },
        400,
      );
    if (e instanceof SyntaxError)
      return json({ error: "Invalid request data." }, 400);
    console.error(
      "UniBot request failed:",
      e instanceof Error ? e.name : "unknown",
    );
    return json(
      {
        error: "The service could not complete this request. Please try again.",
      },
      500,
    );
  }
}
export const GET = handler,
  POST = handler,
  PUT = handler,
  PATCH = handler,
  DELETE = handler;
