import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { ApiAuthError, requireUser } from "@/lib/api/auth";
import { enforceRateLimit } from "@/lib/api/rateLimit";

const bodySchema = z.object({
  message: z.string().trim().min(1).max(2000),
});

const CLOSED_STATUSES = ["selesai", "ditolak", "dikembalikan", "dieskalasikan"];

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireUser(req);
    if (user.role !== "admin" && user.role !== "petugas") {
      throw new ApiAuthError("Hanya admin dan petugas yang dapat mengirim pesan.", 403);
    }

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Pesan wajib diisi dan maksimal 2000 karakter." },
        { status: 400 }
      );
    }

    const complaintRef = adminDb.collection("complaints").doc(params.id);
    const complaintSnap = await complaintRef.get();
    if (!complaintSnap.exists) {
      return NextResponse.json({ error: "Laporan tidak ditemukan." }, { status: 404 });
    }
    const complaint = complaintSnap.data()!;

    if (user.role === "petugas" && complaint.currentOfficerId !== user.uid) {
      throw new ApiAuthError("Chat ini hanya dapat diakses petugas yang ditugaskan.", 403);
    }
    if (!complaint.currentOfficerId) {
      throw new ApiAuthError("Chat tersedia setelah laporan diteruskan ke petugas.", 409);
    }
    if (CLOSED_STATUSES.includes(String(complaint.status))) {
      throw new ApiAuthError("Chat laporan ini sudah ditutup untuk pesan baru.", 409);
    }

    await enforceRateLimit(user.uid, "complaint_chat_message", 60, 3600);

    const profileSnap = await adminDb.collection("users").doc(user.uid).get();
    const profile = profileSnap.data();
    if (!profileSnap.exists || profile?.isActive !== true) {
      throw new ApiAuthError("Akun tidak aktif.", 403);
    }

    const messageRef = complaintRef.collection("chat_messages").doc();
    const createdAt = new Date().toISOString();
    await messageRef.create({
      id: messageRef.id,
      authorUid: user.uid,
      authorRole: user.role,
      authorName: String(profile.name ?? (user.role === "admin" ? "Admin" : "Petugas")),
      message: parsed.data.message,
      createdAt,
    });

    return NextResponse.json({ id: messageRef.id }, { status: 201 });
  } catch (err) {
    if (err instanceof ApiAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[POST /api/complaints/[id]/messages]", err);
    return NextResponse.json({ error: "Pesan gagal dikirim." }, { status: 500 });
  }
}
