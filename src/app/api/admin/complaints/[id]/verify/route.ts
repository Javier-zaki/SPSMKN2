import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { requireUser, requireRole, ApiAuthError } from "@/lib/api/auth";
import { writeAuditLog } from "@/lib/api/auditLog";

const bodySchema = z.object({
  action: z.enum(["approve", "reject"]),
  reason: z.string().max(1000).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireUser(req);
    requireRole(user, "admin");

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
    }
    const { action, reason } = parsed.data;

    const complaintRef = adminDb.collection("complaints").doc(params.id);
    const snap = await complaintRef.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Laporan tidak ditemukan" }, { status: 404 });
    }
    const complaint = snap.data()!;
    if (complaint.status !== "diajukan") {
      return NextResponse.json(
        { error: "Laporan ini sudah diproses sebelumnya." },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();
    const newStatus = action === "approve" ? "diverifikasi" : "ditolak";

    await complaintRef.update({
      status: newStatus,
      verifiedAt: now,
      verifiedBy: user.uid,
      updatedAt: now,
    });

    await complaintRef.collection("history").add({
      complaintId: params.id,
      action: action === "approve" ? "Laporan diverifikasi" : "Laporan ditolak",
      fromStatus: "diajukan",
      toStatus: newStatus,
      fromUserId: user.uid,
      toUserId: null,
      note: reason ?? null,
      createdAt: now,
    });

    await adminDb.collection("notifications").add({
      userId: complaint.studentUid,
      role: "siswa",
      title: action === "approve" ? "Pengaduan diverifikasi" : "Pengaduan ditolak",
      message:
        action === "approve"
          ? `Laporan ${complaint.complaintNumber} telah diverifikasi dan akan segera diteruskan.`
          : `Laporan ${complaint.complaintNumber} ditolak. ${reason ?? ""}`.trim(),
      complaintId: params.id,
      isRead: false,
      createdAt: now,
    });

    await writeAuditLog({
      userId: user.uid,
      role: "admin",
      action: action === "approve" ? "verifikasi_laporan" : "tolak_laporan",
      targetType: "complaint",
      targetId: params.id,
      metadata: { reason: reason ?? null },
    });

    return NextResponse.json({ status: newStatus });
  } catch (err) {
    if (err instanceof ApiAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[POST /api/admin/complaints/[id]/verify]", err);
    return NextResponse.json({ error: "Terjadi kesalahan pada server" }, { status: 500 });
  }
}
