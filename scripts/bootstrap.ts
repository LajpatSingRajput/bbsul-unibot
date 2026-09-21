import { firebase } from "../lib/firebase-server";
import { now, defaultSettings } from "../lib/types";
const uid = process.env.BOOTSTRAP_ADMIN_UID;
if (!uid)
  throw new Error(
    "Set BOOTSTRAP_ADMIN_UID to an existing Firebase Authentication UID.",
  );
const { auth, db } = firebase();
const u = await auth.getUser(uid);
if (!u.emailVerified) throw new Error("Verify the administrator email first.");
await db.runTransaction(async (tx) => {
  const admins = await tx.get(
    db.collection("users").where("role", "==", "admin"),
  );
  if (!admins.empty)
    throw new Error(
      "An administrator already exists. Use the admin panel for further role changes.",
    );
  tx.set(db.collection("users").doc(uid), {
    uid,
    name: u.displayName || "University Administrator",
    email: u.email,
    role: "admin",
    status: "active",
    department: "Administration",
    createdAt: now(),
    updatedAt: now(),
  });
  tx.set(db.collection("systemSettings").doc("main"), defaultSettings);
});
console.log(
  "First administrator created. Sign in using Firebase Authentication.",
);
