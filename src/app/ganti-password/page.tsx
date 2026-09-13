"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { updatePassword } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/client";
import { useAuth } from "@/lib/auth/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Shown once after first login for accounts created with a temporary
 * password (spec §20: akun dibuat → password sementara → login pertama →
 * wajib ganti password → password baru).
 */
export default function GantiPasswordPage() {
  const router = useRouter();
  const { firebaseUser, profile } = useAuth();
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError("Kata sandi minimal 8 karakter.");
      return;
    }
    if (newPassword !== confirm) {
      setError("Konfirmasi kata sandi tidak cocok.");
      return;
    }
    if (!firebaseUser) return;

    setSubmitting(true);
    try {
      await updatePassword(firebaseUser, newPassword);
      await updateDoc(doc(db, "users", firebaseUser.uid), {
        mustChangePassword: false,
        updatedAt: new Date().toISOString(),
      });

      const destination =
        profile?.role === "admin"
          ? "/admin"
          : profile?.role === "petugas"
            ? "/petugas"
            : "/dashboard";
      router.push(destination);
    } catch {
      setError(
        "Gagal mengubah kata sandi. Silakan login ulang lalu coba lagi."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-lg border border-border bg-surface p-6 shadow-card"
      >
        <div>
          <p className="font-display text-lg font-bold text-ink">
            Buat kata sandi baru
          </p>
          <p className="mt-1 text-sm text-ink-muted">
            Ini login pertama Anda. Ganti kata sandi sementara sebelum
            melanjutkan.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="new-password">Kata sandi baru</Label>
          <Input
            id="new-password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirm-password">Konfirmasi kata sandi</Label>
          <Input
            id="confirm-password"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </div>

        {error && (
          <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? "Menyimpan..." : "Simpan & Lanjutkan"}
        </Button>
      </form>
    </main>
  );
}
