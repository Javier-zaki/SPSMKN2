import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { requireUser, requireRole, ApiAuthError } from "@/lib/api/auth";
import { writeAuditLog } from "@/lib/api/auditLog";
import { loadOwnedComplaint, assertStatus } from "@/lib/api/petugasComplaint";

const bodySchema = z.object({
  urls: z.array(z.string().url()).min(1).max(5),
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
    assertStatus(data.status, ["diterima_petugas", "sedang_ditangani"]);

    await ref.update({
      attachmentUrls: FieldValue.arrayUnion(...parsed.data.urls),
      updatedAt: new Date().toISOString(),
    });

    await writeAuditLog({
      userId: user.uid,
      role: "petugas",
      action: "unggah_bukti_hasil",
      targetType: "complaint",
      targetId: params.id,
      metadata: { count: parsed.data.urls.length },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ApiAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[POST /api/petugas/complaints/[id]/attachments]", err);
    return NextResponse.json({ error: "Terjadi kesalahan pada server" }, { status: 500 });
  }
}
