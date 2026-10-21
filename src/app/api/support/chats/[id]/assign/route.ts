import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { requireUser, requireRole, ApiAuthError } from "@/lib/api/auth";

const bodySchema = z.object({ unitId: z.string().min(1), officerUid: z.string().min(1) });

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser(req);
    requireRole(user, "admin");
    const adminSnap = await adminDb.collection("users").doc(user.uid).get();
    if (!adminSnap.exists || adminSnap.data()?.isActive !== true) {
      throw new ApiAuthError("Akun tidak aktif.", 403);
    }
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Pilih unit dan petugas." }, { status: 400 });

    const [chatSnap, unitSnap, officerSnap] = await Promise.all([
      adminDb.collection("support_chats").doc(params.id).get(),
      adminDb.collection("units").doc(parsed.data.unitId).get(),
      adminDb.collection("users").doc(parsed.data.officerUid).get(),
    ]);
    if (!chatSnap.exists) return NextResponse.json({ error: "Chat tidak ditemukan." }, { status: 404 });
    const sourceChat = chatSnap.data()!;
    if (sourceChat.status === "selesai") {
      throw new ApiAuthError("Chat sudah ditutup.", 409);
    }
    if (sourceChat.conversationType === "officer") {
      throw new ApiAuthError("Chat petugas tidak dapat diteruskan dari sini.", 409);
    }
    if (sourceChat.forwardedChatId) {
      throw new ApiAuthError("Chat ini sudah diteruskan ke petugas.", 409);
    }
    if (!unitSnap.exists || unitSnap.data()?.isActive !== true) {
      return NextResponse.json({ error: "Unit tidak ditemukan atau nonaktif." }, { status: 400 });
    }
    const officer = officerSnap.data();
    if (!officerSnap.exists || officer?.role !== "petugas" || officer?.unitId !== parsed.data.unitId || officer?.isActive !== true) {
      return NextResponse.json({ error: "Petugas tidak valid untuk unit tersebut." }, { status: 400 });
    }

    const now = new Date().toISOString();
    const unitName = String(unitSnap.data()?.name ?? "Unit");
    const officerName = String(officer.name ?? "Petugas");
    const batch = adminDb.batch();
    const forwardedChatRef = adminDb.collection("support_chats").doc();
    const studentSnap = await adminDb.collection("users").doc(String(sourceChat.studentUid)).get();
    const studentName = String(studentSnap.data()?.name ?? sourceChat.studentName ?? "Siswa");
    const handoffNote = `Chat “${sourceChat.subject}” diteruskan oleh admin kepada ${unitName} — ${officerName}.`;

    batch.set(forwardedChatRef, {
      id: forwardedChatRef.id,
      conversationType: "officer",
      parentChatId: params.id,
      handoffNote,
      studentUid: sourceChat.studentUid,
      studentName,
      subject: sourceChat.subject,
      status: "diteruskan",
      assignedUnitId: parsed.data.unitId,
      assignedUnitName: unitName,
      assignedOfficerUid: parsed.data.officerUid,
      assignedOfficerName: officerName,
      lastMessage: handoffNote,
      createdAt: now,
      updatedAt: now,
    });
    batch.update(chatSnap.ref, {
      status: "diteruskan",
      forwardedChatId: forwardedChatRef.id,
      updatedAt: now,
    });
    for (const recipient of [
      { uid: parsed.data.officerUid, role: "petugas", title: "Chat bantuan diteruskan", message: `Chat “${sourceChat.subject}” ditugaskan kepada Anda.` },
      { uid: String(sourceChat.studentUid), role: "siswa", title: "Chat diteruskan ke petugas", message: `Chat bantuanmu diteruskan ke ${unitName} — ${officerName}.` },
    ]) {
      batch.set(adminDb.collection("notifications").doc(), {
        userId: recipient.uid,
        role: recipient.role,
        title: recipient.title,
        message: recipient.message,
        complaintId: null,
        supportChatId: forwardedChatRef.id,
        isRead: false,
        createdAt: now,
      });
    }
    await batch.commit();
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ApiAuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[POST /api/support/chats/[id]/assign]", err);
    return NextResponse.json({ error: "Gagal meneruskan chat." }, { status: 500 });
  }
}
