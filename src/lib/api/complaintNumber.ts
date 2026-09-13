import { adminDb } from "@/lib/firebase/admin";

/**
 * Generates the next sequential complaint number for today
 * (PGD-YYYYMMDD-NNN), using a Firestore transaction on a per-day counter
 * doc so concurrent submissions never collide.
 */
export async function nextComplaintNumber(): Promise<string> {
  const now = new Date();
  const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(
    2,
    "0"
  )}${String(now.getDate()).padStart(2, "0")}`;

  const counterRef = adminDb.collection("counters").doc(datePart);

  const seq = await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(counterRef);
    const current = snap.exists ? (snap.data()?.count as number) : 0;
    const next = current + 1;
    tx.set(counterRef, { count: next }, { merge: true });
    return next;
  });

  return `PGD-${datePart}-${String(seq).padStart(3, "0")}`;
}
