import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { requireUser, requireRole, ApiAuthError } from "@/lib/api/auth";
import { enforceRateLimit } from "@/lib/api/rateLimit";

const bodySchema = z.object({
  subject: z.string().trim().min(3).max(100),
  message: z.string().trim().min(2).max(2000),
});

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    requireRole(user, "siswa");
    await enforceRateLimit(user.uid, "support_chat_create", 5, 3600);
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Isi topik dan pesan dengan benar." }, { status: 400 });
    }

    const profileSnap = await adminDb.collection("users").doc(user.uid).get();
    if (!profileSnap.exists || profileSnap.data()?.isActive !== true) {
      throw new ApiAuthError("Akun tidak aktif.", 403);
    }
    const profile = profileSnap.data()!;
    const now = new Date().toISOString();
    const chatRef = adminDb.collection("support_chats").doc();
    const messageRef = chatRef.collection("messages").doc();
    const batch = adminDb.batch();
    batch.set(chatRef, {
      id: chatRef.id,
      studentUid: user.uid,
      studentName: String(profile.name ?? "Siswa"),
      subject: parsed.data.subject,
      status: "menunggu_admin",
      assignedUnitId: null,
      assignedUnitName: null,
      assignedOfficerUid: null,
      assignedOfficerName: null,
      lastMessage: parsed.data.message,
      createdAt: now,
      updatedAt: now,
    });
    batch.set(messageRef, {
      id: messageRef.id,
      authorUid: user.uid,
      authorRole: "siswa",
      authorName: String(profile.name ?? "Siswa"),
      message: parsed.data.message,
      createdAt: now,
    });
    const admins = await adminDb.collection("users").where("role", "==", "admin").get();
    for (const admin of admins.docs) {
      batch.set(adminDb.collection("notifications").doc(), {
        userId: admin.id,
        role: "admin",
        title: "Chat bantuan baru",
        message: `${String(profile.name ?? "Siswa")} menghubungi admin: ${parsed.data.subject}`,
        complaintId: null,
        supportChatId: chatRef.id,
        isRead: false,
        createdAt: now,
      });
    }
    await batch.commit();
    return NextResponse.json({ id: chatRef.id }, { status: 201 });
  } catch (err) {
    if (err instanceof ApiAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[POST /api/support/chats]", err);
    return NextResponse.json({ error: "Gagal membuat chat." }, { status: 500 });
  }
}
