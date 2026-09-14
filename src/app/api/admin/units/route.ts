import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { requireUser, requireRole, ApiAuthError } from "@/lib/api/auth";
import { writeAuditLog } from "@/lib/api/auditLog";

const bodySchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    requireRole(user, "admin");

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
    }

    const ref = adminDb.collection("units").doc();
    await ref.set({
      id: ref.id,
      name: parsed.data.name,
      description: parsed.data.description ?? "",
      isActive: true,
      createdAt: new Date().toISOString(),
    });

    await writeAuditLog({
      userId: user.uid,
      role: "admin",
      action: "buat_unit",
      targetType: "unit",
      targetId: ref.id,
      metadata: { name: parsed.data.name },
    });

    return NextResponse.json({ id: ref.id });
  } catch (err) {
    if (err instanceof ApiAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[POST /api/admin/units]", err);
    return NextResponse.json({ error: "Terjadi kesalahan pada server" }, { status: 500 });
  }
}
