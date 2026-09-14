import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { requireUser, requireRole, ApiAuthError } from "@/lib/api/auth";
import { writeAuditLog } from "@/lib/api/auditLog";
import {
  loadOwnedComplaint,
  assertStatus,
  latestAssignmentRef,
} from "@/lib/api/petugasComplaint";

const bodySchema = z.object({
  reason: z.string().min(3).max(200),
  note: z.string().max(1000).optional(),
});

/**
 * Escalation always routes to the admin pool (spec §7's "Wakasek" is, in
 * this system, simply an admin re-disposisi with higher authority — admins
 * see the escalation flag on the report and re-route it from there).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireUser(req);
    requireRole(user, "petugas");

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
    }

    const { ref, data } = await loadOwnedComplaint(params.id, user.uid);
    assertStatus(data.status, ["diterima_petugas", "sedang_ditangani"]);

    const now = new Date().toISOString();
    await ref.update({ status: "dieskalasikan", updatedAt: now });

    const assignmentRef = await latestAssignmentRef(params.id);
    if (assignmentRef) {
      await assignmentRef.update({ status: "dieskalasikan" });
    }

    await ref.collection("escalations").add({
      complaintId: params.id,
      fromUserId: user.uid,
      toUserId: null, // resolved to a specific admin when re-disposisi happens
      reason: parsed.data.reason,
      note: parsed.data.note ?? null,
      createdAt: now,
    });

    await ref.collection("history").add({
      complaintId: params.id,
      action: "Laporan dieskalasikan",
      fromStatus: data.status,
      toStatus: "dieskalasikan",
      fromUserId: user.uid,
      toUserId: null,
      note: `${parsed.data.reason}${parsed.data.note ? " — " + parsed.data.note : ""}`,
      createdAt: now,
    });

    await adminDb.collection("notifications").add({
      userId: data.studentUid,
      role: "siswa",
      title: "Laporan dieskalasikan",
      message: `Laporan ${data.complaintNumber} memerlukan penanganan lebih lanjut dan sedang dieskalasikan.`,
      complaintId: params.id,
      isRead: false,
      createdAt: now,
    });

    const admins = await adminDb
      .collection("users")
      .where("role", "==", "admin")
      .where("isActive", "==", true)
      .get();
    await Promise.all(
      admins.docs.map((a) =>
        adminDb.collection("notifications").add({
          userId: a.id,
          role: "admin",
          title: "Laporan dieskalasikan",
          message: `Laporan ${data.complaintNumber} dieskalasikan oleh petugas: ${parsed.data.reason}`,
          complaintId: params.id,
          isRead: false,
          createdAt: now,
        })
      )
    );

    await writeAuditLog({
      userId: user.uid,
      role: "petugas",
      action: "eskalasi_laporan",
      targetType: "complaint",
      targetId: params.id,
      metadata: { reason: parsed.data.reason },
    });

    return NextResponse.json({ status: "dieskalasikan" });
  } catch (err) {
    if (err instanceof ApiAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[POST /api/petugas/complaints/[id]/escalate]", err);
    return NextResponse.json({ error: "Terjadi kesalahan pada server" }, { status: 500 });
  }
}
