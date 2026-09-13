"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import type { Role } from "@/lib/types";

/**
 * Gates a route group to a single role for navigation/UX purposes.
 *
 * IMPORTANT: this is a UX guard only. It stops a signed-in siswa from
 * *seeing* /admin, but it grants no data access — every Firestore read and
 * every server action still enforces the role independently via
 * firestore.rules and lib/firebase/admin.ts. Removing or bypassing this
 * component would change what renders, not what data is reachable.
 */
export function RoleGuard({
  role,
  children,
}: {
  role: Role;
  children: React.ReactNode;
}) {
  const { firebaseUser, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!firebaseUser || !profile) {
      router.replace("/login");
      return;
    }
    if (profile.role !== role) {
      const home =
        profile.role === "admin"
          ? "/admin"
          : profile.role === "petugas"
            ? "/petugas"
            : "/dashboard";
      router.replace(home);
    }
  }, [loading, firebaseUser, profile, role, router]);

  if (loading || !profile || profile.role !== role) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <p className="text-sm text-ink-muted">Memuat...</p>
      </div>
    );
  }

  return <>{children}</>;
}
