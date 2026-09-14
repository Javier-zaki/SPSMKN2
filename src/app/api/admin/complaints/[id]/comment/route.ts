import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { requireUser, ApiAuthError } from "@/lib/api/auth";
import { enforceRateLimit } from "@/lib/api/rateLimit";

const bodySchema = z.object({
  message: z.string().min(2).max(2000),
  visibility: z.enum(["pelapor", "internal"]),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireUser(req);
    if (user.role !== "admin" && user.role !== "petugas") {
      throw new ApiAuthError("Tidak diizinkan", 403);
    }
    await enforceRateLimit(user.uid, "add_comment", 30, 3600);

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
    }
    const { message, visibility } = parsed.data;

    const complaintRef = adminDb.collection("complaints").doc(params.id);
    const snap = await complaintRef.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Laporan tidak ditemukan" }, { status: 404 });
    }
    const complaint = snap.data()!;

    if (
      user.role === "petugas" &&
      complaint.currentOfficerId !== user.uid &&
      complaint.currentUnitId !== user.unitId
    ) {
      throw new ApiAuthError("Laporan ini bukan tugas Anda", 403);
    }

    const now = new Date().toISOString();

    await complaintRef.collection("comments").add({
      complaintId: params.id,
      authorUid: user.uid,
      authorRole: user.role,
      visibility,
      message,
      createdAt: now,
    });

    if (visibility === "pelapor") {
      await complaintRef.update({ publicResponse: message, updatedAt: now });
      await complaintRef.collection("history").add({
        complaintId: params.id,
        action: "Tanggapan baru untuk pelapor",
        fromStatus: null,
        toStatus: null,
        fromUserId: user.uid,
        toUserId: null,
        note: message,
        createdAt: now,
      });
      await adminDb.collection("notifications").add({
        userId: complaint.studentUid,
        role: "siswa",
        title: "Ada tanggapan baru",
        message: `Ada tanggapan baru pada laporan ${complaint.complaintNumber}.`,
        complaintId: params.id,
        isRead: false,
        createdAt: now,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ApiAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[POST /api/admin/complaints/[id]/comment]", err);
    return NextResponse.json({ error: "Terjadi kesalahan pada server" }, { status: 500 });
  }
}
