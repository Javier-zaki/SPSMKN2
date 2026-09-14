import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireUser, requireRole, ApiAuthError } from "@/lib/api/auth";
import { writeAuditLog } from "@/lib/api/auditLog";
import {
  loadOwnedComplaint,
  assertStatus,
  latestAssignmentRef,
} from "@/lib/api/petugasComplaint";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireUser(req);
    requireRole(user, "petugas");

    const { ref, data } = await loadOwnedComplaint(params.id, user.uid);
    assertStatus(data.status, ["diteruskan"]);

    const now = new Date().toISOString();
    await ref.update({ status: "diterima_petugas", updatedAt: now });

    const assignmentRef = await latestAssignmentRef(params.id);
    if (assignmentRef) {
      await assignmentRef.update({ status: "diterima", acceptedAt: now });
    }

    await ref.collection("history").add({
      complaintId: params.id,
      action: "Laporan diterima petugas",
      fromStatus: "diteruskan",
      toStatus: "diterima_petugas",
      fromUserId: user.uid,
      toUserId: null,
      note: null,
      createdAt: now,
    });

    await adminDb.collection("notifications").add({
      userId: data.studentUid,
      role: "siswa",
      title: "Laporan diterima petugas",
      message: `Laporan ${data.complaintNumber} telah diterima dan akan segera ditangani.`,
      complaintId: params.id,
      isRead: false,
      createdAt: now,
    });

    await writeAuditLog({
      userId: user.uid,
      role: "petugas",
      action: "menerima_tugas",
      targetType: "complaint",
      targetId: params.id,
    });

    return NextResponse.json({ status: "diterima_petugas" });
  } catch (err) {
    if (err instanceof ApiAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[POST /api/petugas/complaints/[id]/accept]", err);
    return NextResponse.json({ error: "Terjadi kesalahan pada server" }, { status: 500 });
  }
}
