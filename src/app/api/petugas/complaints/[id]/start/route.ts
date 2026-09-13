import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireUser, requireRole, ApiAuthError } from "@/lib/api/auth";
import { writeAuditLog } from "@/lib/api/auditLog";
import { loadOwnedComplaint, assertStatus } from "@/lib/api/petugasComplaint";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireUser(req);
    requireRole(user, "petugas");

    const { ref, data } = await loadOwnedComplaint(params.id, user.uid);
    assertStatus(data.status, ["diterima_petugas"]);

    const now = new Date().toISOString();
    await ref.update({ status: "sedang_ditangani", updatedAt: now });

    await ref.collection("history").add({
      complaintId: params.id,
      action: "Penanganan dimulai",
      fromStatus: "diterima_petugas",
      toStatus: "sedang_ditangani",
      fromUserId: user.uid,
      toUserId: null,
      note: null,
      createdAt: now,
    });

    await adminDb.collection("notifications").add({
      userId: data.studentUid,
      role: "siswa",
      title: "Penanganan dimulai",
      message: `Laporan ${data.complaintNumber} sedang ditangani.`,
      complaintId: params.id,
      isRead: false,
      createdAt: now,
    });

    await writeAuditLog({
      userId: user.uid,
      role: "petugas",
      action: "mulai_penanganan",
      targetType: "complaint",
      targetId: params.id,
    });

    return NextResponse.json({ status: "sedang_ditangani" });
  } catch (err) {
    if (err instanceof ApiAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[POST /api/petugas/complaints/[id]/start]", err);
    return NextResponse.json({ error: "Terjadi kesalahan pada server" }, { status: 500 });
  }
}
