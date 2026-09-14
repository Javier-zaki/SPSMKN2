import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { requireUser, requireRole, ApiAuthError } from "@/lib/api/auth";
import { enforceRateLimit } from "@/lib/api/rateLimit";
import { nextComplaintNumber } from "@/lib/api/complaintNumber";

const bodySchema = z.object({
  // Generated client-side (doc().id) so attachments can be uploaded to
  // Storage under this id *before* the Firestore doc exists.
  complaintId: z.string().min(10),
  categoryId: z.string().min(1),
  title: z.string().min(5).max(150),
  description: z.string().min(10).max(4000),
  location: z.string().min(2).max(200),
  incidentDate: z.string().min(4),
  isAnonymous: z.boolean(),
  attachmentUrls: z.array(z.string().url()).max(5).default([]),
});

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    requireRole(user, "siswa");
    // Max 10 new complaints per student per hour — generous for real use,
    // tight enough to blunt automated/spam submission.
    await enforceRateLimit(user.uid, "create_complaint", 10, 3600);

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Data tidak valid", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const input = parsed.data;

    const categorySnap = await adminDb
      .collection("categories")
      .doc(input.categoryId)
      .get();
    if (!categorySnap.exists) {
      return NextResponse.json(
        { error: "Kategori tidak ditemukan" },
        { status: 400 }
      );
    }
    const categoryName = categorySnap.data()?.name as string;

    const complaintNumber = await nextComplaintNumber();
    const now = new Date().toISOString();
    const complaintRef = adminDb.collection("complaints").doc(input.complaintId);

    await complaintRef.set({
      id: input.complaintId,
      complaintNumber,
      studentUid: user.uid,
      categoryId: input.categoryId,
      categoryName,
      title: input.title,
      description: input.description,
      location: input.location,
      incidentDate: input.incidentDate,
      isAnonymous: input.isAnonymous,
      priority: "normal",
      status: "diajukan",
      currentUnitId: null,
      currentOfficerId: null,
      currentUnitName: null,
      currentOfficerName: null,
      deadline: null,
      deadlineWarnedAt: null,
      deadlineOverdueNotifiedAt: null,
      attachmentUrls: input.attachmentUrls,
      publicResponse: null,
      createdAt: now,
      updatedAt: now,
      closedAt: null,
      verifiedAt: null,
      verifiedBy: null,
    });

    await complaintRef.collection("history").add({
      complaintId: input.complaintId,
      action: "Pengaduan dibuat",
      fromStatus: null,
      toStatus: "diajukan",
      fromUserId: user.uid,
      toUserId: null,
      note: null,
      createdAt: now,
    });

    await adminDb.collection("notifications").add({
      userId: user.uid,
      role: "siswa",
      title: "Pengaduan berhasil dibuat",
      message: `Laporan ${complaintNumber} telah diterima sistem dan menunggu verifikasi admin.`,
      complaintId: input.complaintId,
      isRead: false,
      createdAt: now,
    });

    const admins = await adminDb
      .collection("users")
      .where("role", "==", "admin")
      .where("isActive", "==", true)
      .get();

    await Promise.all(
      admins.docs.map((adminDoc) =>
        adminDb.collection("notifications").add({
          userId: adminDoc.id,
          role: "admin",
          title: "Ada laporan baru",
          message: `Laporan baru ${complaintNumber} menunggu verifikasi.`,
          complaintId: input.complaintId,
          isRead: false,
          createdAt: now,
        })
      )
    );

    await adminDb.collection("audit_logs").add({
      userId: user.uid,
      role: "siswa",
      action: "membuat_laporan",
      targetType: "complaint",
      targetId: input.complaintId,
      metadata: { complaintNumber },
      createdAt: now,
    });

    return NextResponse.json({ id: input.complaintId, complaintNumber });
  } catch (err) {
    if (err instanceof ApiAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[POST /api/complaints]", err);
    return NextResponse.json(
      { error: "Terjadi kesalahan pada server" },
      { status: 500 }
    );
  }
}
