import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { ApiAuthError, requireUser } from "@/lib/api/auth";
import { enforceRateLimit } from "@/lib/api/rateLimit";

const bodySchema = z.object({ message: z.string().trim().min(1).max(2000) });
const CLOSED_STATUSES = ["selesai", "ditolak"];

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireUser(req);
    if (!user.role || !["siswa", "admin", "petugas"].includes(user.role)) {
      throw new ApiAuthError("Tidak diizinkan.", 403);
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

    const isOwner = user.role === "siswa" && complaint.studentUid === user.uid;
    const isAssignedOfficer =
      user.role === "petugas" && complaint.currentOfficerId === user.uid;
    if (user.role !== "admin" && !isOwner && !isAssignedOfficer) {
      throw new ApiAuthError("Anda bukan peserta percakapan laporan ini.", 403);
    }
    if (CLOSED_STATUSES.includes(String(complaint.status))) {
      throw new ApiAuthError("Percakapan laporan ini sudah ditutup.", 409);
    }

    await enforceRateLimit(user.uid, "complaint_public_chat_message", 60, 3600);

    const profileSnap = await adminDb.collection("users").doc(user.uid).get();
    const profile = profileSnap.data();
    if (!profileSnap.exists || profile?.isActive !== true) {
      throw new ApiAuthError("Akun tidak aktif.", 403);
    }

    const messageRef = complaintRef.collection("public_chat_messages").doc();
    const createdAt = new Date().toISOString();
    const authorName =
      user.role === "siswa" && complaint.isAnonymous === true
        ? "Pelapor (anonim)"
        : String(
            profile.name ??
              (user.role === "admin" ? "Admin" : user.role === "petugas" ? "Petugas" : "Siswa")
          );
    await messageRef.create({
      id: messageRef.id,
      authorUid: user.uid,
      authorRole: user.role,
      authorName,
      message: parsed.data.message,
      createdAt,
    });

    return NextResponse.json({ id: messageRef.id }, { status: 201 });
  } catch (err) {
    if (err instanceof ApiAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[POST /api/complaints/[id]/public-messages]", err);
    return NextResponse.json({ error: "Pesan gagal dikirim." }, { status: 500 });
  }
}
