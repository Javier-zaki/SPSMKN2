import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { requireUser, requireRole, ApiAuthError } from "@/lib/api/auth";
import { writeAuditLog } from "@/lib/api/auditLog";
import {
  loadOwnedComplaint,
  assertStatus,
  latestAssignmentRef,
} from "@/lib/api/petugasComplaint";

const bodySchema = z.object({
  resultNote: z.string().min(3).max(2000),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireUser(req);
    requireRole(user, "petugas");

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
    }

    const { ref, data } = await loadOwnedComplaint(params.id, user.uid);
    assertStatus(data.status, ["sedang_ditangani"]);

    const now = new Date().toISOString();
    await ref.update({ status: "menunggu_konfirmasi", updatedAt: now });

    const assignmentRef = await latestAssignmentRef(params.id);
    if (assignmentRef) {
      await assignmentRef.update({ status: "selesai", completedAt: now });
    }

    await ref.collection("history").add({
      complaintId: params.id,
      action: "Penanganan selesai",
      fromStatus: "sedang_ditangani",
      toStatus: "menunggu_konfirmasi",
      fromUserId: user.uid,
      toUserId: null,
      note: parsed.data.resultNote,
      createdAt: now,
    });

    // Result note is also stored as a "pelapor"-visible comment so the
    // student sees what was done, matching spec §14's public-response idea.
    await ref.collection("comments").add({
      complaintId: params.id,
      authorUid: user.uid,
      authorRole: "petugas",
      visibility: "pelapor",
      message: parsed.data.resultNote,
      createdAt: now,
    });

    await adminDb.collection("notifications").add({
      userId: data.studentUid,
      role: "siswa",
      title: "Penanganan selesai",
      message: `Laporan ${data.complaintNumber}: ${parsed.data.resultNote}`,
      complaintId: params.id,
      isRead: false,
      createdAt: now,
    });

    const admins = await adminDb
      .collection("users")
      .where("role", "==", "admin")
      .where("isActive", "==", true)
      .get();
    await Promise.all(
      admins.docs.map((a) =>
        adminDb.collection("notifications").add({
          userId: a.id,
          role: "admin",
          title: "Menunggu konfirmasi penutupan",
          message: `Laporan ${data.complaintNumber} selesai ditangani dan menunggu konfirmasi/penutupan.`,
          complaintId: params.id,
          isRead: false,
          createdAt: now,
        })
      )
    );

    await writeAuditLog({
      userId: user.uid,
      role: "petugas",
      action: "selesaikan_penanganan",
      targetType: "complaint",
      targetId: params.id,
    });

    return NextResponse.json({ status: "menunggu_konfirmasi" });
  } catch (err) {
    if (err instanceof ApiAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[POST /api/petugas/complaints/[id]/complete]", err);
    return NextResponse.json({ error: "Terjadi kesalahan pada server" }, { status: 500 });
  }
}
