/**
 * One-time setup script: creates the first Admin account, default units,
 * and default categories. Run with `npm run seed` after configuring
 * .env.local with a Firebase service account (see README).
 *
 * Also the reference implementation for "account creation must set the
 * `role` custom claim + write users/{uid} + usernames/{username}" — the
 * same pattern any future admin API route (e.g. POST /api/admin/siswa)
 * should follow.
 */
import "dotenv/config";
import { adminAuth, adminDb } from "../src/lib/firebase/admin";

const DEFAULT_UNITS = [
  { id: "sarpras", name: "Sarana & Prasarana" },
  { id: "bk", name: "BK" },
  { id: "kesiswaan", name: "Kesiswaan" },
  { id: "kurikulum", name: "Kurikulum" },
  { id: "keamanan", name: "Keamanan" },
  { id: "kebersihan", name: "Kebersihan" },
];

const DEFAULT_CATEGORIES = [
  { id: "fasilitas", name: "Fasilitas", defaultUnitId: "sarpras" },
  { id: "bullying", name: "Bullying / Perundungan", defaultUnitId: "bk" },
  { id: "pembelajaran", name: "Masalah Pembelajaran", defaultUnitId: "kurikulum" },
  { id: "pelayanan", name: "Pelayanan Sekolah", defaultUnitId: "kesiswaan" },
  { id: "keamanan", name: "Laporan Keamanan", defaultUnitId: "keamanan" },
  { id: "lingkungan", name: "Lingkungan Sekolah", defaultUnitId: "kebersihan" },
  { id: "lainnya", name: "Kritik & Saran Lainnya" },
];

async function createAccount(opts: {
  username: string;
  email: string;
  password: string;
  role: "admin" | "petugas" | "siswa";
  name: string;
  extra?: Record<string, unknown>;
}) {
  const existing = await adminAuth
    .getUserByEmail(opts.email)
    .catch(() => null);

  const user =
    existing ??
    (await adminAuth.createUser({
      email: opts.email,
      password: opts.password,
      displayName: opts.name,
    }));

  await adminAuth.setCustomUserClaims(user.uid, {
    role: opts.role,
    ...(opts.extra?.unitId ? { unitId: opts.extra.unitId } : {}),
  });

  const now = new Date().toISOString();
  await adminDb
    .collection("users")
    .doc(user.uid)
    .set(
      {
        uid: user.uid,
        role: opts.role,
        name: opts.name,
        email: opts.email,
        isActive: true,
        mustChangePassword: true,
        createdAt: now,
        updatedAt: now,
        ...opts.extra,
      },
      { merge: true }
    );

  await adminDb
    .collection("usernames")
    .doc(opts.username)
    .set({ email: opts.email });

  console.log(`✔ ${opts.role} created: ${opts.username} (${opts.email})`);
}

async function main() {
  console.log("Seeding SPSMKN2...\n");

  for (const unit of DEFAULT_UNITS) {
    await adminDb
      .collection("units")
      .doc(unit.id)
      .set({ ...unit, isActive: true, createdAt: new Date().toISOString() });
  }
  console.log(`✔ ${DEFAULT_UNITS.length} unit dibuat`);

  for (const cat of DEFAULT_CATEGORIES) {
    await adminDb
      .collection("categories")
      .doc(cat.id)
      .set({ ...cat, isActive: true });
  }
  console.log(`✔ ${DEFAULT_CATEGORIES.length} kategori dibuat`);

  await createAccount({
    username: "admin",
    email: process.env.SEED_ADMIN_EMAIL ?? "admin@spsmkn2.sch.id",
    password: process.env.SEED_ADMIN_PASSWORD ?? "GantiSegera123!",
    role: "admin",
    name: "Administrator SPSMKN2",
    extra: { canViewAnonymousIdentity: true },
  });

  console.log("\nSelesai. Segera login dan ganti password admin default.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
