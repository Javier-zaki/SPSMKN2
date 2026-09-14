import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { requireUser, requireRole, ApiAuthError } from "@/lib/api/auth";
import { writeAuditLog } from "@/lib/api/auditLog";

const bodySchema = z.discriminatedUnion("role", [
  z.object({
    role: z.literal("siswa"),
    username: z.string().min(3).max(50),
    email: z.string().email(),
    name: z.string().min(2).max(100),
    password: z.string().min(8),
    nis: z.string().min(1).max(30),
    className: z.string().min(1).max(30),
  }),
  z.object({
    role: z.literal("petugas"),
    username: z.string().min(3).max(50),
    email: z.string().email(),
    name: z.string().min(2).max(100),
    password: z.string().min(8),
    unitId: z.string().min(1),
    position: z.string().max(50).optional(),
  }),
]);

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    requireRole(user, "admin");

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Data tidak valid", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const input = parsed.data;

    const usernameTaken = await adminDb.collection("usernames").doc(input.username).get();
    if (usernameTaken.exists) {
      return NextResponse.json({ error: "Username sudah digunakan" }, { status: 409 });
    }

    const authUser = await adminAuth.createUser({
      email: input.email,
      password: input.password,
      displayName: input.name,
    });

    await adminAuth.setCustomUserClaims(authUser.uid, {
      role: input.role,
      ...(input.role === "petugas" ? { unitId: input.unitId } : {}),
    });

    const now = new Date().toISOString();
    const profile =
      input.role === "siswa"
        ? {
            uid: authUser.uid,
            role: "siswa",
            name: input.name,
            email: input.email,
            nis: input.nis,
            className: input.className,
            isActive: true,
            mustChangePassword: true,
            createdAt: now,
            updatedAt: now,
          }
        : {
            uid: authUser.uid,
            role: "petugas",
            name: input.name,
            email: input.email,
            unitId: input.unitId,
            position: input.position ?? "",
            isActive: true,
            mustChangePassword: true,
            createdAt: now,
            updatedAt: now,
          };

    await adminDb.collection("users").doc(authUser.uid).set(profile);
    await adminDb
      .collection("usernames")
      .doc(input.username)
      .set({ email: input.email });

    await writeAuditLog({
      userId: user.uid,
      role: "admin",
      action: input.role === "siswa" ? "buat_akun_siswa" : "buat_akun_petugas",
      targetType: "user",
      targetId: authUser.uid,
      metadata: { username: input.username },
    });

    return NextResponse.json({ uid: authUser.uid });
  } catch (err) {
    if (err instanceof ApiAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[POST /api/admin/users]", err);
    return NextResponse.json({ error: "Terjadi kesalahan pada server" }, { status: 500 });
  }
}
