import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg px-6 text-center">
      <p className="font-display text-2xl font-bold text-ink">
        Halaman tidak ditemukan
      </p>
      <p className="max-w-sm text-sm text-ink-muted">
        Halaman yang Anda cari tidak ada atau sudah dipindahkan.
      </p>
      <Link href="/">
        <Button>Kembali ke beranda</Button>
      </Link>
    </main>
  );
}
