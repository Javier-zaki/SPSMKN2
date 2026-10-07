import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { requireUser, ApiAuthError } from "@/lib/api/auth";
import { enforceRateLimit } from "@/lib/api/rateLimit";

const bodySchema = z.object({ message: z.string().trim().min(1).max(2000) });

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser(req);
    if (!["siswa", "admin", "petugas"].includes(user.role ?? "")) {
      throw new ApiAuthError("Tidak diizinkan.", 403);
    }
    await enforceRateLimit(user.uid, "support_chat_message", 60, 3600);
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Pesan wajib diisi (maksimal 2000 karakter)." }, { status: 400 });
    }

    const chatRef = adminDb.collection("support_chats").doc(params.id);
    const chatSnap = await chatRef.get();
    if (!chatSnap.exists) return NextResponse.json({ error: "Chat tidak ditemukan." }, { status: 404 });
    const chat = chatSnap.data()!;
    const allowed = user.role === "admin" ||
      (user.role === "siswa" && chat.studentUid === user.uid) ||
      (user.role === "petugas" && chat.assignedOfficerUid === user.uid);
    if (!allowed) throw new ApiAuthError("Anda bukan peserta chat ini.", 403);
    if (chat.status === "selesai") throw new ApiAuthError("Chat sudah ditutup.", 409);

    const profileSnap = await adminDb.collection("users").doc(user.uid).get();
    const authorName = String(profileSnap.data()?.name ?? (user.role === "admin" ? "Admin" : "Petugas"));
    const now = new Date().toISOString();
    const messageRef = chatRef.collection("messages").doc();
    const batch = adminDb.batch();
    batch.set(messageRef, {
      id: messageRef.id,
      authorUid: user.uid,
      authorRole: user.role,
      authorName,
      message: parsed.data.message,
      createdAt: now,
    });
    batch.update(chatRef, { lastMessage: parsed.data.message, updatedAt: now });

    let recipients: { uid: string; role: string }[];
    if (user.role === "siswa") {
      if (chat.assignedOfficerUid) {
        recipients = [{ uid: String(chat.assignedOfficerUid), role: "petugas" }];
      } else {
        const admins = await adminDb.collection("users").where("role", "==", "admin").get();
        recipients = admins.docs.map((admin) => ({ uid: admin.id, role: "admin" }));
      }
    } else {
      recipients = [{ uid: String(chat.studentUid), role: "siswa" }];
    }
    for (const recipient of recipients) {
      batch.set(adminDb.collection("notifications").doc(), {
        userId: recipient.uid,
        role: recipient.role,
        title: "Pesan chat bantuan baru",
        message: `${authorName}: ${parsed.data.message.slice(0, 120)}`,
        complaintId: null,
        supportChatId: params.id,
        isRead: false,
        createdAt: now,
      });
    }
    await batch.commit();
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ApiAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[POST /api/support/chats/[id]/messages]", err);
    return NextResponse.json({ error: "Gagal mengirim pesan." }, { status: 500 });
  }
}
