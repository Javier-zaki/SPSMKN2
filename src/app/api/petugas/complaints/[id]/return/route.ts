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
    assertStatus(data.status, ["diteruskan", "diterima_petugas", "sedang_ditangani"]);

    const now = new Date().toISOString();
    await ref.update({
      status: "dikembalikan",
      updatedAt: now,
      // currentOfficerId/unitId are intentionally left as-is: they still
      // identify who last handled it (so it shows in that petugas's
      // riwayat) until admin re-disposisi overwrites them with a new
      // assignment via /api/admin/complaints/[id]/forward.
    });

    const assignmentRef = await latestAssignmentRef(params.id);
    if (assignmentRef) {
      await assignmentRef.update({ status: "dikembalikan" });
    }

    await ref.collection("history").add({
      complaintId: params.id,
      action: "Laporan dikembalikan ke admin",
      fromStatus: data.status,
      toStatus: "dikembalikan",
      fromUserId: user.uid,
      toUserId: null,
      note: `${parsed.data.reason}${parsed.data.note ? " — " + parsed.data.note : ""}`,
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
          title: "Laporan dikembalikan",
          message: `Laporan ${data.complaintNumber} dikembalikan: ${parsed.data.reason}`,
          complaintId: params.id,
          isRead: false,
          createdAt: now,
        })
      )
    );

    await writeAuditLog({
      userId: user.uid,
      role: "petugas",
      action: "kembalikan_laporan",
      targetType: "complaint",
      targetId: params.id,
      metadata: { reason: parsed.data.reason },
    });

    return NextResponse.json({ status: "dikembalikan" });
  } catch (err) {
    if (err instanceof ApiAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[POST /api/petugas/complaints/[id]/return]", err);
    return NextResponse.json({ error: "Terjadi kesalahan pada server" }, { status: 500 });
  }
}
