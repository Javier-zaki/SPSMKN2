import { adminDb } from "@/lib/firebase/admin";
import { ApiAuthError } from "@/lib/api/auth";
import type { ComplaintStatus } from "@/lib/types";

/**
 * Loads a complaint and asserts the calling petugas is the one it's
 * currently assigned to. Every petugas action route calls this first —
 * ownership is re-checked server-side on every request, never inferred
 * from what the client claims.
 */
export async function loadOwnedComplaint(
  complaintId: string,
  officerUid: string
) {
  const ref = adminDb.collection("complaints").doc(complaintId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new ApiAuthError("Laporan tidak ditemukan", 404);
  }
  const data = snap.data()!;
  if (data.currentOfficerId !== officerUid) {
    throw new ApiAuthError("Laporan ini bukan tugas Anda", 403);
  }
  return { ref, data };
}

export function assertStatus(
  current: ComplaintStatus,
  allowed: ComplaintStatus[]
) {
  if (!allowed.includes(current)) {
    throw new ApiAuthError(
      `Tidak bisa dilakukan pada status "${current}" saat ini.`,
      409
    );
  }
}

/** Returns the most recently created assignment doc for a complaint. */
export async function latestAssignmentRef(complaintId: string) {
  const snap = await adminDb
    .collection("complaints")
    .doc(complaintId)
    .collection("assignments")
    .orderBy("assignedAt", "desc")
    .limit(1)
    .get();
  return snap.empty ? null : snap.docs[0].ref;
}
