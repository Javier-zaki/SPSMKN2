import { adminDb } from "@/lib/firebase/admin";
import { ApiAuthError } from "@/lib/api/auth";

/**
 * Fixed-window rate limit keyed by uid + action. Cheap and good enough for
 * this app's scale (a school, not a public API) — not a substitute for a
 * dedicated limiter if traffic ever grows past a few hundred users.
 *
 * Throws ApiAuthError(429) when the caller has exceeded `limit` calls
 * within `windowSeconds`.
 */
export async function enforceRateLimit(
  uid: string,
  action: string,
  limit: number,
  windowSeconds: number
) {
  const windowId = Math.floor(Date.now() / (windowSeconds * 1000));
  const ref = adminDb.collection("rate_limits").doc(`${uid}_${action}_${windowId}`);

  const count = await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const current = snap.exists ? (snap.data()?.count as number) : 0;
    tx.set(
      ref,
      { count: current + 1, expiresAt: Date.now() + windowSeconds * 2 * 1000 },
      { merge: true }
    );
    return current + 1;
  });

  if (count > limit) {
    throw new ApiAuthError(
      "Terlalu banyak permintaan. Coba lagi beberapa saat lagi.",
      429
    );
  }
}
