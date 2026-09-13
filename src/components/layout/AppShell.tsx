"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { useAuth } from "@/lib/auth/AuthContext";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FilePlus2,
  FileText,
  Bell,
  User,
  Users,
  Building2,
  Tags,
  ScrollText,
  Settings,
  ClipboardList,
  History,
  LogOut,
  Menu,
  X,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const NAV_BY_ROLE: Record<"siswa" | "admin" | "petugas", NavItem[]> = {
  siswa: [
    { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
    { href: "/dashboard/buat", label: "Buat Pengaduan", icon: FilePlus2 },
    { href: "/dashboard/pengaduan", label: "Pengaduan Saya", icon: FileText },
    { href: "/dashboard/notifikasi", label: "Notifikasi", icon: Bell },
    { href: "/dashboard/profil", label: "Profil", icon: User },
  ],
  admin: [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/pengaduan", label: "Pengaduan", icon: FileText },
    { href: "/admin/siswa", label: "Siswa", icon: Users },
    { href: "/admin/petugas", label: "Petugas", icon: Users },
    { href: "/admin/unit", label: "Unit", icon: Building2 },
    { href: "/admin/kategori", label: "Kategori", icon: Tags },
    { href: "/admin/audit-log", label: "Audit Log", icon: ScrollText },
    { href: "/admin/pengaturan", label: "Pengaturan", icon: Settings },
  ],
  petugas: [
    { href: "/petugas", label: "Dashboard", icon: LayoutDashboard },
    { href: "/petugas/tugas", label: "Tugas Saya", icon: ClipboardList },
    { href: "/petugas/riwayat", label: "Riwayat", icon: History },
    { href: "/petugas/profil", label: "Profil", icon: User },
  ],
};

const NOTIF_HREF: Record<"siswa" | "admin" | "petugas", string> = {
  siswa: "/dashboard/notifikasi",
  admin: "/admin",
  petugas: "/petugas",
};

const PROFILE_HREF: Record<"siswa" | "admin" | "petugas", string> = {
  siswa: "/dashboard/profil",
  admin: "/admin/pengaturan",
  petugas: "/petugas/profil",
};

function initials(name: string | undefined) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function AppShell({
  role,
  title,
  children,
}: {
  role: "siswa" | "admin" | "petugas";
  title: string;
  children: React.ReactNode;
}) {
  const items = NAV_BY_ROLE[role];
  const pathname = usePathname();
  const { profile } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-bg md:flex">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 border-r border-border bg-surface md:flex md:flex-col">
        <div className="px-5 py-5">
          <span className="font-display text-base font-bold text-ink">
            SPSMKN2
          </span>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {items.map((item) => (
            <NavLink key={item.href} item={item} active={pathname === item.href} />
          ))}
        </nav>
        <div className="border-t border-border p-3">
          <p className="truncate px-2 text-xs text-ink-muted">
            {profile?.name ?? ""}
          </p>
          <button
            onClick={() => signOut(auth)}
            className="focus-ring mt-1 flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-ink-muted hover:bg-brand-soft hover:text-ink"
          >
            <LogOut className="h-4 w-4" />
            Keluar
          </button>
        </div>
      </aside>

      <div className="flex-1">
        {/* Mobile top bar: hamburger + title, bell, avatar */}
        <header className="flex items-center justify-between border-b border-border bg-bg px-4 py-4 md:hidden">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMenuOpen(true)}
              aria-label="Buka menu"
              className="focus-ring text-brand-strong"
            >
              <Menu className="h-6 w-6" />
            </button>
            <span className="font-display text-lg font-bold text-ink">
              {title === "Dashboard Siswa" || title === "Dashboard Admin" || title === "Dashboard Petugas"
                ? "SPSMKN2"
                : title}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link href={NOTIF_HREF[role]} aria-label="Notifikasi" className="focus-ring relative text-ink-muted">
              <Bell className="h-5 w-5" />
              <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-cta-strong" />
            </Link>
            <Link
              href={PROFILE_HREF[role]}
              aria-label="Profil"
              className="focus-ring flex h-8 w-8 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand-strong"
            >
              {initials(profile?.name)}
            </Link>
          </div>
        </header>

        {/* Desktop header */}
        <header className="hidden items-center justify-between border-b border-border bg-surface px-8 py-4 md:flex">
          <h1 className="font-display text-lg font-semibold text-ink">
            {title}
          </h1>
        </header>

        <main className="p-5 pb-20 md:p-8 md:pb-8">{children}</main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t border-border bg-surface md:hidden">
        {items.slice(0, 5).map((item) => (
          <BottomNavLink
            key={item.href}
            item={item}
            active={pathname === item.href}
          />
        ))}
      </nav>

      {/* Mobile slide-in menu (hamburger) */}
      {menuOpen && (
        <div className="fixed inset-0 z-20 md:hidden">
          <div
            className="absolute inset-0 bg-ink/40"
            onClick={() => setMenuOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-y-0 left-0 w-64 bg-surface p-4 shadow-card">
            <div className="mb-6 flex items-center justify-between">
              <span className="font-display text-base font-bold text-ink">
                SPSMKN2
              </span>
              <button
                onClick={() => setMenuOpen(false)}
                aria-label="Tutup menu"
                className="focus-ring text-ink-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="space-y-1">
              {items.map((item) => (
                <div key={item.href} onClick={() => setMenuOpen(false)}>
                  <NavLink item={item} active={pathname === item.href} />
                </div>
              ))}
            </nav>
            <button
              onClick={() => signOut(auth)}
              className="focus-ring mt-6 flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm text-ink-muted hover:bg-brand-soft hover:text-ink"
            >
              <LogOut className="h-4 w-4" />
              Keluar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        "focus-ring flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-brand-soft text-brand-strong"
          : "text-ink-muted hover:bg-brand-soft hover:text-ink"
      )}
    >
      <Icon className="h-4 w-4" />
      {item.label}
    </Link>
  );
}

function BottomNavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        "flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px]",
        active ? "text-brand-strong" : "text-ink-muted"
      )}
    >
      <Icon className="h-5 w-5" />
      {item.label}
    </Link>
  );
}
