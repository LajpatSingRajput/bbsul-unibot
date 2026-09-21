import {
  createHmac,
  randomBytes,
  timingSafeEqual,
  randomUUID,
} from "node:crypto";
import { demoMode, firebase } from "./firebase-server";
import { Store } from "./store";
import { AppError } from "./validation";
import { now, type Profile } from "./types";
const secret = randomBytes(32);
export function demoCookie(role: string, previous?: string) {
  const session = previous || randomUUID();
  const payload = Buffer.from(
    JSON.stringify({ role, session, exp: Date.now() + 86400000 }),
  ).toString("base64url");
  return `${payload}.${createHmac("sha256", secret).update(payload).digest("base64url")}`;
}
export function readDemo(req: Request) {
  const token = req.headers
    .get("cookie")
    ?.split("; ")
    .find((s) => s.startsWith("unibot_demo="))
    ?.slice(12);
  if (!token) return null;
  try {
    const [p, s] = token.split(".");
    const a = Buffer.from(s),
      b = Buffer.from(
        createHmac("sha256", secret).update(p).digest("base64url"),
      );
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const data = JSON.parse(Buffer.from(p, "base64url").toString());
    return data.exp > Date.now() &&
      ["student", "faculty", "admin"].includes(data.role)
      ? data
      : null;
  } catch {
    return null;
  }
}
export async function authenticate(req: Request, allowUnverified = false) {
  if (demoMode()) {
    const d = readDemo(req);
    if (!d) throw new AppError(401, "Please sign in to continue.");
    const store = new Store(d.session);
    const user = (await store.get("users", `demo-${d.role}`)) as Profile;
    if (user?.status !== "active")
      throw new AppError(403, "This account is inactive.");
    return { user, store, demo: true, verified: true };
  }
  if (!process.env.FIREBASE_PROJECT_ID)
    throw new AppError(
      503,
      "Firebase is not configured. Follow the setup guide to connect your project.",
    );
  const token = req.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!token) throw new AppError(401, "Please sign in to continue.");
  let decoded;
  try {
    decoded = await firebase().auth.verifyIdToken(token, true);
  } catch {
    throw new AppError(401, "Your session has expired. Please sign in again.");
  }
  if (!decoded.email_verified && !allowUnverified)
    throw new AppError(403, "Verify your email before using UniBot.");
  const store = new Store();
  let user = (await store.get("users", decoded.uid)) as Profile | null;
  if (!user) {
    const row = {
      uid: decoded.uid,
      name: decoded.name || "University member",
      email: decoded.email || "",
      role: "student",
      status: "active",
      department: "",
      createdAt: now(),
      updatedAt: now(),
    };
    const ref = firebase().db.collection("users").doc(decoded.uid);
    await firebase().db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) tx.create(ref, row);
    });
    user = (await store.get("users", decoded.uid)) as Profile;
  }
  if (user.status !== "active")
    throw new AppError(
      403,
      "This account is inactive. Contact your administrator.",
    );
  return { user, store, demo: false, verified: !!decoded.email_verified };
}
export function checkOrigin(req: Request) {
  const origin = req.headers.get("origin");
  const expected = process.env.APP_ORIGIN || new URL(req.url).origin;
  if (origin && origin !== expected)
    throw new AppError(403, "Request origin is not allowed.");
}
export async function rateLimit(
  store: Store,
  uid: string,
  kind = "chat",
  max = 20,
) {
  const id = `${uid}-${kind}-${Math.floor(Date.now() / 60000)}`;
  if (store.demoId) {
    const r = await store.get("rateLimits", id);
    if ((r?.count || 0) >= max)
      throw new AppError(429, "Too many requests. Please wait a minute.");
    await store.put("rateLimits", { count: (r?.count || 0) + 1 }, id);
    return;
  }
  const ref = firebase().db.collection("rateLimits").doc(id);
  await firebase().db.runTransaction(async (tx) => {
    const r = await tx.get(ref);
    if ((r.data()?.count || 0) >= max)
      throw new AppError(429, "Too many requests. Please wait a minute.");
    tx.set(ref, {
      count: (r.data()?.count || 0) + 1,
      expiresAt: new Date(Date.now() + 3600000),
    });
  });
}
