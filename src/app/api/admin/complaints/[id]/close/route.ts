import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { requireUser, requireRole, ApiAuthError } from "@/lib/api/auth";
import { writeAuditLog } from "@/lib/api/auditLog";

const bodySchema = z.object({
  publicResponse: z.string().min(3).max(2000),
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

    const complaintRef = adminDb.collection("complaints").doc(params.id);
    const snap = await complaintRef.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Laporan tidak ditemukan" }, { status: 404 });
    }
    const complaint = snap.data()!;
    const now = new Date().toISOString();

    await complaintRef.update({
      status: "selesai",
      closedAt: now,
      updatedAt: now,
      publicResponse: parsed.data.publicResponse,
    });

    await complaintRef.collection("history").add({
      complaintId: params.id,
      action: "Laporan ditutup",
      fromStatus: complaint.status,
      toStatus: "selesai",
      fromUserId: user.uid,
      toUserId: null,
      note: parsed.data.publicResponse,
      createdAt: now,
    });

    await adminDb.collection("notifications").add({
      userId: complaint.studentUid,
      role: "siswa",
      title: "Pengaduan selesai",
      message: `Laporan ${complaint.complaintNumber} telah selesai ditangani.`,
      complaintId: params.id,
      isRead: false,
      createdAt: now,
    });

    await writeAuditLog({
      userId: user.uid,
      role: "admin",
      action: "tutup_laporan",
      targetType: "complaint",
      targetId: params.id,
    });

    return NextResponse.json({ status: "selesai" });
  } catch (err) {
    if (err instanceof ApiAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[POST /api/admin/complaints/[id]/close]", err);
    return NextResponse.json({ error: "Terjadi kesalahan pada server" }, { status: 500 });
  }
}
