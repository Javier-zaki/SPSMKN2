import Link from "next/link";
import { Button } from "@/components/ui/button";

const FEATURES = [
  {
    title: "Mudah",
    body: "Buat laporan hanya dalam beberapa langkah, lengkap dengan kategori dan lokasi kejadian.",
  },
  {
    title: "Terpantau",
    body: "Pantau proses laporan dari diajukan sampai selesai, kapan pun lewat dashboard pribadi.",
  },
  {
    title: "Terarah",
    body: "Laporan diteruskan langsung ke unit dan petugas yang berwenang menanganinya.",
  },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-bg">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <span className="font-display text-lg font-bold text-ink">
          SPSMKN2
        </span>
        <Link href="/login">
          <Button variant="secondary" size="sm">
            Masuk ke Sistem
          </Button>
        </Link>
      </header>

      <section className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-6 py-12 md:grid-cols-[1.1fr,0.9fr] md:py-20">
        <div>
          <h1 className="font-display text-4xl font-bold leading-[1.1] text-ink md:text-5xl">
            Sampaikan laporan.
            <br />
            Pantau prosesnya.
            <br />
            Wujudkan perubahan.
          </h1>
          <p className="mt-6 max-w-md text-base leading-relaxed text-ink-muted">
            Platform digital sekolah untuk menyampaikan pengaduan, kritik, dan
            saran secara mudah, aman, dan transparan — dari ruang kelas
            sampai ke pihak yang berwenang menanganinya.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/login">
              <Button size="lg">Masuk ke Sistem</Button>
            </Link>
            <a href="#cara-kerja">
              <Button variant="ghost" size="lg">
                Pelajari cara kerja
              </Button>
            </a>
          </div>
        </div>

        <TicketIllustration />
      </section>

      <section
        id="cara-kerja"
        className="border-t border-border bg-surface py-16"
      >
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title}>
                <h2 className="font-display text-lg font-semibold text-ink">
                  {f.title}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                  {f.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="py-8 text-center text-xs text-ink-muted">
        SPSMKN2 — Sistem Pengaduan Sekolah
      </footer>
    </main>
  );
}

/** A stylized complaint ticket with a status timeline — the hero is built
 *  from the actual subject matter (a report card) rather than a stock
 *  illustration or gradient blob. */
function TicketIllustration() {
  return (
    <div className="relative rounded-lg border border-border bg-surface p-6 shadow-card">
      <div className="flex items-center justify-between">
        <span className="font-display text-sm font-semibold text-ink">
          PGD-20260908-001
        </span>
        <span className="rounded-md bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
          Sedang Ditangani
        </span>
      </div>
      <p className="mt-3 text-sm font-medium text-ink">
        AC ruang kelas tidak berfungsi
      </p>
      <p className="text-xs text-ink-muted">Fasilitas · Ruang Kelas IX.1</p>

      <div className="mt-6 space-y-4 border-t border-border pt-5">
        {[
          { label: "Laporan dibuat", done: true },
          { label: "Diverifikasi admin", done: true },
          { label: "Diteruskan ke Sarpras", done: true },
          { label: "Sedang ditangani", done: false },
        ].map((step, i, arr) => (
          <div key={step.label} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  step.done ? "bg-brand" : "border-2 border-brand bg-surface"
                }`}
              />
              {i < arr.length - 1 && (
                <span className="h-6 w-px bg-border" />
              )}
            </div>
            <span
              className={`text-xs ${
                step.done ? "text-ink" : "font-medium text-ink"
              }`}
            >
              {step.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
