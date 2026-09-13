"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "@/lib/firebase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AppUser } from "@/lib/types";

/**
 * Login accepts NIS (siswa) or a username (admin/petugas) rather than a raw
 * email, per spec §2/§20. Firebase Auth itself is still email/password
 * under the hood, so we resolve `usernames/{username}` -> email first.
 *
 *   usernames/{username}  { email: string }
 *
 * This doc is written server-side whenever an account is created (see
 * scripts/seed.ts) and is NOT writable by clients (see firestore.rules).
 */
export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      let email = identifier.trim();

      // If it doesn't look like an email, treat it as NIS/username and
      // resolve it to the account's real email first.
      if (!email.includes("@")) {
        const lookup = await getDoc(doc(db, "usernames", email));
        if (!lookup.exists()) {
          throw new Error("account-not-found");
        }
        email = (lookup.data() as { email: string }).email;
      }

      const cred = await signInWithEmailAndPassword(auth, email, password);

      const profileSnap = await getDoc(doc(db, "users", cred.user.uid));
      if (!profileSnap.exists()) {
        throw new Error("profile-not-found");
      }
      const profile = profileSnap.data() as AppUser;

      if (!profile.isActive) {
        await auth.signOut();
        throw new Error("account-disabled");
      }

      const destination =
        profile.mustChangePassword
          ? "/ganti-password"
          : profile.role === "admin"
            ? "/admin"
            : profile.role === "petugas"
              ? "/petugas"
              : "/dashboard";

      router.push(destination);
    } catch (err) {
      setError(mapAuthError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="font-display text-lg font-bold text-ink">SPSMKN2</p>
          <p className="mt-1 text-sm text-ink-muted">
            Masuk ke Sistem Pengaduan Sekolah
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-lg border border-border bg-surface p-6 shadow-card"
        >
          <div className="space-y-1.5">
            <Label htmlFor="identifier">NIS / Username</Label>
            <Input
              id="identifier"
              autoComplete="username"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Kata sandi</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Memeriksa..." : "Masuk"}
          </Button>
        </form>
      </div>
    </main>
  );
}

function mapAuthError(err: unknown): string {
  const code = err instanceof Error ? err.message : String(err);
  if (code === "account-not-found" || code.includes("user-not-found")) {
    return "NIS/Username atau kata sandi salah.";
  }
  if (code.includes("wrong-password") || code.includes("invalid-credential")) {
    return "NIS/Username atau kata sandi salah.";
  }
  if (code === "account-disabled") {
    return "Akun ini telah dinonaktifkan. Hubungi admin sekolah.";
  }
  if (code.includes("too-many-requests")) {
    return "Terlalu banyak percobaan. Coba lagi beberapa saat lagi.";
  }
  return "Gagal masuk. Periksa kembali NIS/Username dan kata sandi.";
}
