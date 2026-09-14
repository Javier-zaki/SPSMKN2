import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { requireUser, requireRole, ApiAuthError } from "@/lib/api/auth";
import { writeAuditLog } from "@/lib/api/auditLog";

const bodySchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  defaultUnitId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    requireRole(user, "admin");

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
    }

    const ref = adminDb.collection("categories").doc();
    await ref.set({
      id: ref.id,
      name: parsed.data.name,
      description: parsed.data.description ?? "",
      defaultUnitId: parsed.data.defaultUnitId ?? null,
      isActive: true,
    });

    await writeAuditLog({
      userId: user.uid,
      role: "admin",
      action: "buat_kategori",
      targetType: "category",
      targetId: ref.id,
      metadata: { name: parsed.data.name },
    });

    return NextResponse.json({ id: ref.id });
  } catch (err) {
    if (err instanceof ApiAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[POST /api/admin/categories]", err);
    return NextResponse.json({ error: "Terjadi kesalahan pada server" }, { status: 500 });
  }
}
