import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { requireUser, requireRole, ApiAuthError } from "@/lib/api/auth";
import { writeAuditLog } from "@/lib/api/auditLog";

const bodySchema = z.object({
  name: z.string().min(2).max(100).optional(),
  isActive: z.boolean().optional(),
  className: z.string().max(30).optional(),
  unitId: z.string().optional(),
  position: z.string().max(50).optional(),
  resetPassword: z.boolean().optional(),
});

function generateTempPassword() {
  return `Spsmkn2-${Math.random().toString(36).slice(-8)}`;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { uid: string } }
) {
  try {
    const admin = await requireUser(req);
    requireRole(admin, "admin");

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
    }
    const input = parsed.data;
    const now = new Date().toISOString();

    const firestoreUpdate: Record<string, unknown> = { updatedAt: now };
    if (input.name !== undefined) firestoreUpdate.name = input.name;
    if (input.isActive !== undefined) firestoreUpdate.isActive = input.isActive;
    if (input.className !== undefined) firestoreUpdate.className = input.className;
    if (input.unitId !== undefined) firestoreUpdate.unitId = input.unitId;
    if (input.position !== undefined) firestoreUpdate.position = input.position;

    if (input.isActive !== undefined) {
      await adminAuth.updateUser(params.uid, { disabled: !input.isActive });
    }

    if (input.unitId !== undefined) {
      const current = await adminAuth.getUser(params.uid);
      await adminAuth.setCustomUserClaims(params.uid, {
        ...current.customClaims,
        unitId: input.unitId,
      });
    }

    let tempPassword: string | undefined;
    if (input.resetPassword) {
      tempPassword = generateTempPassword();
      await adminAuth.updateUser(params.uid, { password: tempPassword });
      firestoreUpdate.mustChangePassword = true;
    }

    await adminDb.collection("users").doc(params.uid).update(firestoreUpdate);

    await writeAuditLog({
      userId: admin.uid,
      role: "admin",
      action: input.resetPassword
        ? "reset_password"
        : input.isActive === false
          ? "nonaktifkan_akun"
          : input.isActive === true
            ? "aktifkan_akun"
            : "ubah_akun",
      targetType: "user",
      targetId: params.uid,
    });

    return NextResponse.json({ ok: true, tempPassword });
  } catch (err) {
    if (err instanceof ApiAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[PATCH /api/admin/users/[uid]]", err);
    return NextResponse.json({ error: "Terjadi kesalahan pada server" }, { status: 500 });
  }
}
