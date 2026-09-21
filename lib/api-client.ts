import { clientAuth } from "./firebase-client";
export async function api(path: string, method = "GET", data?: any) {
  const headers: Record<string, string> = {};
  try {
    const user = clientAuth().currentUser;
    if (user) headers.Authorization = `Bearer ${await user.getIdToken()}`;
  } catch {}
  if (data && !(data instanceof FormData))
    headers["Content-Type"] = "application/json";
  let res;
  try {
    res = await fetch("/api/" + path, {
      method,
      headers,
      body:
        data instanceof FormData
          ? data
          : data
            ? JSON.stringify(data)
            : undefined,
    });
  } catch {
    throw new Error(
      "Connection unavailable. Check your internet and try again.",
    );
  }
  const result = await res.json();
  if (!res.ok) throw new Error(result.error || "Request failed.");
  return result;
}
