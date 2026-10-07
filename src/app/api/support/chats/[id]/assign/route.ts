import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { requireUser, requireRole, ApiAuthError } from "@/lib/api/auth";

const bodySchema = z.object({ unitId: z.string().min(1), officerUid: z.string().min(1) });

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser(req);
    requireRole(user, "admin");
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Pilih unit dan petugas." }, { status: 400 });

    const [chatSnap, unitSnap, officerSnap] = await Promise.all([
      adminDb.collection("support_chats").doc(params.id).get(),
      adminDb.collection("units").doc(parsed.data.unitId).get(),
      adminDb.collection("users").doc(parsed.data.officerUid).get(),
    ]);
    if (!chatSnap.exists) return NextResponse.json({ error: "Chat tidak ditemukan." }, { status: 404 });
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
    batch.update(chatSnap.ref, {
      status: "diteruskan",
      assignedUnitId: parsed.data.unitId,
      assignedUnitName: unitName,
      assignedOfficerUid: parsed.data.officerUid,
      assignedOfficerName: officerName,
      updatedAt: now,
    });
    for (const recipient of [
      { uid: parsed.data.officerUid, role: "petugas", title: "Chat bantuan diteruskan", message: `Chat “${chatSnap.data()?.subject}” ditugaskan kepada Anda.` },
      { uid: String(chatSnap.data()?.studentUid), role: "siswa", title: "Chat diteruskan ke petugas", message: `Chat bantuanmu diteruskan ke ${unitName} — ${officerName}.` },
    ]) {
      batch.set(adminDb.collection("notifications").doc(), {
        userId: recipient.uid,
        role: recipient.role,
        title: recipient.title,
        message: recipient.message,
        complaintId: null,
        supportChatId: params.id,
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
