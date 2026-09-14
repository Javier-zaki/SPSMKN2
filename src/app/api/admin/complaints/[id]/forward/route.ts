import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { requireUser, requireRole, ApiAuthError } from "@/lib/api/auth";
import { writeAuditLog } from "@/lib/api/auditLog";

const bodySchema = z.object({
  unitId: z.string().min(1),
  officerUid: z.string().min(1),
  priority: z.enum(["rendah", "normal", "tinggi", "mendesak"]),
  deadline: z.string().nullable(),
  instruction: z.string().min(3).max(1000),
});

/** Handles both the first disposisi and any re-disposisi (admin changing
 *  the recipient) — spec §8 lets an admin fix routing after a petugas
 *  returns a report. */
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
    const input = parsed.data;

    const complaintRef = adminDb.collection("complaints").doc(params.id);
    const complaintSnap = await complaintRef.get();
    if (!complaintSnap.exists) {
      return NextResponse.json({ error: "Laporan tidak ditemukan" }, { status: 404 });
    }
    const complaint = complaintSnap.data()!;

    const unitSnap = await adminDb.collection("units").doc(input.unitId).get();
    if (!unitSnap.exists) {
      return NextResponse.json({ error: "Unit tidak ditemukan" }, { status: 400 });
    }

    const officerSnap = await adminDb.collection("users").doc(input.officerUid).get();
    if (
      !officerSnap.exists ||
      officerSnap.data()?.role !== "petugas" ||
      officerSnap.data()?.unitId !== input.unitId
    ) {
      return NextResponse.json(
        { error: "Petugas tidak valid untuk unit ini" },
        { status: 400 }
      );
    }

    const unitName = unitSnap.data()?.name as string;
    const officerName = officerSnap.data()?.name as string;
    const now = new Date().toISOString();

    await complaintRef.collection("assignments").add({
      complaintId: params.id,
      fromUserId: user.uid,
      toUserId: input.officerUid,
      unitId: input.unitId,
      instruction: input.instruction,
      priority: input.priority,
      deadline: input.deadline,
      assignedAt: now,
      acceptedAt: null,
      completedAt: null,
      status: "menunggu",
    });

    await complaintRef.update({
      currentUnitId: input.unitId,
      currentOfficerId: input.officerUid,
      currentUnitName: unitName,
      currentOfficerName: officerName,
      priority: input.priority,
      deadline: input.deadline,
      status: "diteruskan",
      updatedAt: now,
      // A new disposisi means a fresh deadline clock — clear any prior
      // SLA reminder flags so the cron job can warn again if needed.
      deadlineWarnedAt: null,
      deadlineOverdueNotifiedAt: null,
    });

    await complaintRef.collection("history").add({
      complaintId: params.id,
      action: "Laporan diteruskan",
      fromStatus: complaint.status,
      toStatus: "diteruskan",
      fromUserId: user.uid,
      toUserId: input.officerUid,
      note: `Ke ${unitName} — ${officerName}. ${input.instruction}`,
      createdAt: now,
    });

    await adminDb.collection("notifications").add({
      userId: input.officerUid,
      role: "petugas",
      title: "Mendapat tugas baru",
      message: `Laporan ${complaint.complaintNumber} diteruskan kepada Anda: ${input.instruction}`,
      complaintId: params.id,
      isRead: false,
      createdAt: now,
    });

    await adminDb.collection("notifications").add({
      userId: complaint.studentUid,
      role: "siswa",
      title: "Pengaduan diteruskan",
      message: `Laporan ${complaint.complaintNumber} telah diteruskan ke bagian ${unitName} dan akan segera ditangani.`,
      complaintId: params.id,
      isRead: false,
      createdAt: now,
    });

    await writeAuditLog({
      userId: user.uid,
      role: "admin",
      action: "teruskan_laporan",
      targetType: "complaint",
      targetId: params.id,
      metadata: { unitId: input.unitId, officerUid: input.officerUid, priority: input.priority },
    });

    return NextResponse.json({ status: "diteruskan" });
  } catch (err) {
    if (err instanceof ApiAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[POST /api/admin/complaints/[id]/forward]", err);
    return NextResponse.json({ error: "Terjadi kesalahan pada server" }, { status: 500 });
  }
}
