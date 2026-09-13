"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <html lang="id">
      <body>
        <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg px-6 text-center">
          <p className="font-display text-2xl font-bold text-ink">
            Terjadi kesalahan
          </p>
          <p className="max-w-sm text-sm text-ink-muted">
            Maaf, ada yang tidak berjalan semestinya. Coba muat ulang
            halaman ini.
          </p>
          <Button onClick={() => reset()}>Muat ulang</Button>
        </main>
      </body>
    </html>
  );
}
