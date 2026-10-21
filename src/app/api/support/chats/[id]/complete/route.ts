import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireUser, ApiAuthError } from "@/lib/api/auth";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser(req);
    if (user.role !== "admin" && user.role !== "petugas") {
      throw new ApiAuthError("Hanya admin atau petugas yang dapat menutup chat.", 403);
    }
    const profileSnap = await adminDb.collection("users").doc(user.uid).get();
    if (!profileSnap.exists || profileSnap.data()?.isActive !== true) {
      throw new ApiAuthError("Akun tidak aktif.", 403);
    }
    const ref = adminDb.collection("support_chats").doc(params.id);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: "Chat tidak ditemukan." }, { status: 404 });
    const chat = snap.data()!;
    if (chat.status === "selesai") {
      throw new ApiAuthError("Chat sudah ditutup.", 409);
    }
    if (user.role === "petugas" && chat.assignedOfficerUid !== user.uid) {
      throw new ApiAuthError("Chat ini bukan tugas Anda.", 403);
    }
    if (user.role === "admin" && chat.conversationType === "officer") {
      throw new ApiAuthError("Admin hanya dapat memantau chat yang diteruskan.", 403);
    }
    const now = new Date().toISOString();
    const batch = adminDb.batch();
    batch.update(ref, { status: "selesai", updatedAt: now });
    batch.set(adminDb.collection("notifications").doc(), {
      userId: chat.studentUid,
      role: "siswa",
      title: "Chat bantuan selesai",
      message: `Percakapan “${chat.subject}” telah ditandai selesai.`,
      complaintId: null,
      supportChatId: params.id,
      isRead: false,
      createdAt: now,
    });
    await batch.commit();
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ApiAuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[POST /api/support/chats/[id]/complete]", err);
    return NextResponse.json({ error: "Gagal menyelesaikan chat." }, { status: 500 });
  }
}