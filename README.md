# SPSMKN2 — Sistem Pengaduan Sekolah

Proyek berdiri sendiri (tidak terhubung ke sistem lain). Fase 1 dari roadmap
5 fase — berisi fondasi: setup project, autentikasi, skema data, security
rules, dan landing page.

## Status Fase 5 (penghalusan akhir) — baru ditambahkan

- **Pengingat SLA otomatis** — `GET /api/cron/sla-check`, dijadwalkan lewat
  `vercel.json` (tiap jam). Menandai laporan aktif yang jatuh tempo dalam
  24 jam (notifikasi ke petugas & admin) dan yang sudah melewati batas
  waktu (notifikasi ke admin & petugas, sesuai spek §10). Setiap laporan
  hanya diberi tahu sekali per ambang batas (`deadlineWarnedAt` /
  `deadlineOverdueNotifiedAt`), dan penanda ini otomatis direset setiap
  kali admin melakukan disposisi ulang dengan deadline baru.
  Endpoint ini dilindungi `CRON_SECRET` — bukan lewat role Firebase, karena
  dipanggil oleh scheduler, bukan pengguna.
- **Rate limiting ringan** berbasis Firestore (`lib/api/rateLimit.ts`),
  diterapkan ke pembuatan pengaduan (maks 10/jam per siswa) dan
  penambahan tanggapan/catatan (maks 30/jam) — cukup untuk skala sekolah,
  menahan penyalahgunaan otomatis tanpa infrastruktur tambahan.
- **HTTP security headers** (`X-Frame-Options`, `X-Content-Type-Options`,
  `Referrer-Policy`, `Permissions-Policy`) lewat `next.config.mjs`.
- `firestore.rules` diperjelas: koleksi internal (`counters`,
  `rate_limits`) sekarang eksplisit ditolak untuk semua akses client, dan
  aturan untuk sub-koleksi `escalations` (dibaca admin/petugas) sudah ada.
- Halaman `not-found.tsx` dan `global-error.tsx` untuk pengalaman gagal
  yang rapi, plus komponen `Skeleton`/`CardListSkeleton` untuk status
  memuat yang lebih halus (diterapkan di daftar pengaduan siswa sebagai
  contoh pola yang bisa diikuti di daftar lain).

### Menyalakan pengingat SLA di Vercel

1. Tambahkan env var `CRON_SECRET` (nilai acak apa saja) di **Project
   Settings → Environment Variables**.
2. `vercel.json` di repo ini sudah mendaftarkan jadwalnya (tiap jam) —
   Vercel otomatis mengirim header `Authorization: Bearer $CRON_SECRET`
   saat memanggilnya, jadi tidak perlu konfigurasi tambahan.
3. Jika dijalankan di luar Vercel, panggil endpoint itu sendiri dari cron
   apa pun dengan header yang sama.

## Status Fase 4 (alur Petugas) — baru ditambahkan

- `/petugas` — dashboard ringkas: tugas aktif, prioritas tinggi, terlambat
- `/petugas/tugas` — daftar tugas aktif (filter status)
- `/petugas/tugas/[id]` — pusat kerja petugas, dengan status dijaga ketat
  di server (`assertStatus` menolak aksi yang tidak sesuai urutan status):
  - **Terima Tugas** (`.../accept`, hanya dari status `diteruskan`)
  - **Mulai Penanganan** (`.../start`)
  - **Unggah Bukti Hasil** ke Storage (`.../attachments`, pakai `arrayUnion`)
  - **Selesaikan Tugas** (`.../complete`) — otomatis membuat tanggapan untuk
    pelapor + menotifikasi siswa & semua admin bahwa laporan menunggu
    konfirmasi/penutupan
  - **Kembalikan Laporan** (`.../return`) dengan alasan wajib, menotifikasi
    admin untuk redisposisi
  - **Ajukan Eskalasi** (`.../escalate`) — tercatat di sub-koleksi
    `escalations` sesuai field spesifikasi (dari/kepada/alasan/waktu/catatan)
  - Tanggapan & catatan internal (endpoint sama dengan admin, kini juga
    menerima role `petugas`)
- `/petugas/riwayat` — laporan yang sudah lepas dari antrean (selesai,
  dikembalikan, dieskalasikan)
- `/petugas/profil` — info unit & posisi, ubah nama & kata sandi
- Setiap aksi memverifikasi ulang di server bahwa `currentOfficerId`
  laporan memang petugas yang meminta (`loadOwnedComplaint`) — tidak
  mengandalkan apa yang ditampilkan di client

Dengan ini, seluruh alur inti spesifikasi (siswa → admin verifikasi &
disposisi → petugas tangani → admin pantau & tutup) sudah berfungsi end
to end.

## Status Fase 3 (alur Admin) — baru ditambahkan

- `/admin/pengaduan` — daftar semua laporan (real-time, filter status/prioritas, pencarian)
- `/admin/pengaduan/[id]` — pusat kendali laporan:
  - **Verifikasi / Tolak** (`POST /api/admin/complaints/[id]/verify`)
  - **Teruskan Laporan** — modal disposisi sesuai spesifikasi persis (unit →
    petugas → prioritas → batas waktu → instruksi) via
    `POST /api/admin/complaints/[id]/forward`; bisa dipakai ulang untuk
    mengubah disposisi
  - **Tanggapan untuk Pelapor** & **Catatan Internal** (dipisah, catatan
    internal tidak pernah dikirim ke siswa) via `.../comment`
  - **Tutup Laporan** dengan hasil akhir via `.../close`
  - Timeline riwayat lengkap, lampiran bukti, identitas pelapor
    (disamarkan untuk laporan anonim kecuali admin berwenang)
- `/admin` — dashboard statistik asli: total/menunggu verifikasi/diproses/
  terlambat/selesai, grafik per bulan/kategori/unit (recharts), laporan
  prioritas tinggi, laporan lewat deadline
- `/admin/siswa`, `/admin/petugas` — kelola akun: tambah, edit, reset
  password (kata sandi sementara ditampilkan sekali ke admin), aktif/
  nonaktifkan — via `POST/PATCH /api/admin/users`
- `/admin/unit`, `/admin/kategori` — kelola unit & kategori
- `/admin/audit-log` — log aktivitas admin (read-only, tidak bisa diubah)
- `/admin/pengaturan` — akun admin & ubah kata sandi

Semua aksi admin di atas ditulis lewat API route ber-Admin SDK (bukan
write langsung dari client), sehingga riwayat, notifikasi, dan audit log
selalu tercatat bersamaan dengan setiap perubahan status.

## Status Fase 2 (alur Siswa)

- `POST /api/complaints` — server action (Admin SDK) yang membuat laporan:
  generate nomor `PGD-YYYYMMDD-NNN` (transaksi atomik), simpan dokumen,
  tulis entri riwayat pertama, kirim notifikasi ke siswa & semua admin
  aktif, dan mencatat audit log — semua dalam satu alur, tidak ada laporan
  yang bisa "setengah tersimpan"
- `/dashboard/buat` — form buat pengaduan (kategori, lokasi, tanggal,
  deskripsi, unggah bukti ke Storage, opsi kirim anonim)
- `/dashboard/pengaduan` — daftar pengaduan milik siswa (real-time)
- `/dashboard/pengaduan/[id]` — detail laporan: info, penanganan (setelah
  didisposisikan), timeline riwayat, tanggapan untuk pelapor, lampiran bukti
- `/dashboard/notifikasi` — notifikasi real-time, klik menandai terbaca
- `/dashboard/profil` — ubah nama & ubah kata sandi (dengan re-autentikasi)
- Overview dashboard siswa sekarang menampilkan statistik & pengaduan
  terbaru yang sesungguhnya (bukan placeholder)
- `firestore.indexes.json` — index komposit yang dibutuhkan query di atas

Firestore rules diperketat: `complaints` sekarang **tidak bisa ditulis
langsung dari client sama sekali** (create/update/delete semua `false`) —
pembuatan laporan wajib lewat `/api/complaints` supaya nomor, riwayat, dan
notifikasi selalu konsisten.

## Status Fase 1 (fondasi)

- Struktur Next.js 14 (App Router) + TypeScript + Tailwind + primitif ala shadcn/ui
- Landing page
- Login (NIS/Username + password → di-resolve ke email Firebase Auth)
- `AuthContext` (profil + role real-time dari Firestore)
- Shell dashboard per role (Siswa/Admin/Petugas) dengan sidebar desktop +
  bottom nav mobile, dan route guard client-side
- Skema data lengkap (`src/lib/types.ts`) sesuai spesifikasi: users, units,
  categories, complaints, assignments, history, comments, notifications,
  audit logs
- `firestore.rules` & `storage.rules` — RBAC berbasis **custom claim**
  (`request.auth.token.role`), bukan field yang dikirim dari client
- `scripts/seed.ts` — membuat akun admin pertama + unit & kategori default

Semua 5 fase dari rencana awal sudah selesai. Kemungkinan pengembangan
lanjutan yang wajar di luar cakupan awal: pengujian otomatis (unit/e2e),
i18n jika diperlukan bahasa lain, dan audit keamanan pihak ketiga sebelum
dipakai untuk data siswa yang sensitif dalam skala besar.

## Menjalankan secara lokal

```bash
npm install
cp .env.local.example .env.local   # lalu isi sesuai langkah di bawah
npm run dev
```

## 1. Membuat project Firebase

Tetap 100% gratis (paket Spark) selama Storage tidak diaktifkan — lihat
catatan "Soal Storage" di bawah.

1. Buka [Firebase Console](https://console.firebase.google.com) → **Add project**.
2. Aktifkan **Authentication** → sign-in method **Email/Password** saja
   (matikan "Email link").
3. Aktifkan **Firestore Database** (mode production).
4. Di **Project settings → General → Your apps**, tambahkan Web App, lalu
   salin konfigurasinya ke `NEXT_PUBLIC_FIREBASE_*` di `.env.local`.
5. Di **Project settings → Service accounts**, klik **Generate new private
   key** (file JSON). Salin `project_id`, `client_email`, dan `private_key`
   ke `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`,
   `FIREBASE_PRIVATE_KEY` di `.env.local`. **Jangan pernah commit file JSON
   ini ke Git.**

### Soal Storage (opsional, perlu paket Blaze)

Sejak akhir 2024, Cloud Storage for Firebase mengharuskan project ada di
paket **Blaze** (pay-as-you-go, tetap ada kuota gratis di dalamnya) — tidak
lagi tersedia di paket Spark gratis untuk project baru. Karena itu fitur
unggah bukti/lampiran (siswa & petugas) **dinonaktifkan secara default**
lewat `STORAGE_ENABLED` di `src/lib/config.ts`, supaya seluruh sistem bisa
dipakai penuh tanpa kartu kredit sama sekali.

Kalau nanti sudah siap upgrade ke Blaze:
1. Upgrade project ke paket Blaze di Firebase Console.
2. Aktifkan **Storage** di console, isi `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`.
3. Ubah `STORAGE_ENABLED` di `src/lib/config.ts` menjadi `true`.
4. Deploy `storage.rules` (lihat langkah 2 di bawah).

Tidak ada perubahan kode lain yang diperlukan — UI unggah bukti otomatis
muncul kembali.

## 2. Deploy security rules

Install Firebase CLI lalu deploy `firestore.rules` (dan `storage.rules`
kalau Storage sudah diaktifkan):

```bash
npm install -g firebase-tools
firebase login
firebase init   # pilih Firestore (+ Storage kalau sudah Blaze), gunakan project yang sudah dibuat
firebase deploy --only firestore:rules,firestore:indexes
# jika Storage sudah aktif: tambahkan ,storage:rules di akhir perintah di atas
```

## 3. Seed data awal (unit, kategori, akun admin pertama)

```bash
npm run seed
```

Ini membuat:
- 6 unit default (Sarpras, BK, Kesiswaan, Kurikulum, Keamanan, Kebersihan)
- 7 kategori default
- 1 akun admin (`admin` / password dari `SEED_ADMIN_EMAIL` +
  `SEED_ADMIN_PASSWORD`, wajib ganti password saat login pertama)

## 4. Login

Buka `/login`, masuk dengan username `admin` dan password dari `.env.local`.

## Prinsip keamanan yang dipegang di fondasi ini

- **Role tidak pernah dipercaya dari client.** Role asli disimpan sebagai
  *custom claim* pada Firebase Auth ID token, diset lewat Admin SDK
  (`scripts/seed.ts`, dan nanti API route admin). Dokumen `users/{uid}.role`
  di Firestore hanya untuk tampilan.
- **Firestore rules menolak semua write ke koleksi sensitif** (`complaints`
  setelah dibuat, `assignments`, `history`, `audit_logs`, `usernames`) —
  transisi status, disposisi, dan audit log hanya bisa lewat server action
  yang memakai `firebase-admin`, supaya riwayat & audit selalu konsisten.
- **Password tidak pernah disimpan/dibaca sebagai plain text** — sepenuhnya
  ditangani Firebase Authentication.

## Deploy ke Vercel

1. Push project ini ke repo Git.
2. Import ke [Vercel](https://vercel.com/new).
3. Tambahkan semua variabel dari `.env.local` di **Project Settings →
   Environment Variables** (untuk `FIREBASE_PRIVATE_KEY`, tempel apa adanya
   termasuk `\n`).
4. Deploy.
