"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
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

function Avatar({
  name,
  photoURL,
  className,
}: {
  name?: string;
  photoURL?: string | null;
  className?: string;
}) {
  if (photoURL) {
    return (
      <img
        src={photoURL}
        alt={name ?? "Avatar pengguna"}
        className={cn(
          "h-full w-full rounded-full object-cover ring-2 ring-white/70",
          className
        )}
      />
    );
  }

  return (
    <span
      className={cn(
        "flex h-full w-full items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand-strong",
        className
      )}
    >
      {initials(name)}
    </span>
  );
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
      {/* Desktop sidebar — navy, part of the identity, not a generic admin menu */}
      <aside className="hidden w-64 shrink-0 bg-navy md:flex md:flex-col">
        <div className="flex items-center gap-2 px-6 py-6">
          <Image
            src="/pp.jpeg"
            alt="Logo SPSMKN2"
            width={32}
            height={32}
            className="h-8 w-8 rounded-lg object-cover"
          />
          <span className="font-display text-base font-bold text-white">
            SPSMKN2
          </span>
        </div>
        <nav className="flex-1 space-y-1 px-4">
          {items.map((item) => (
            <SidebarLink key={item.href} item={item} active={pathname === item.href} />
          ))}
        </nav>
        <div className="border-t border-white/10 p-4">
          <p className="truncate px-2 text-xs text-white/50">
            {profile?.name ?? ""}
          </p>
          <button
            onClick={() => signOut(auth)}
            className="focus-ring mt-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-white/70 hover:bg-white/5 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
            Keluar
          </button>
        </div>
      </aside>

      <div className="flex-1">
        {/* Sticky navbar — same on every breakpoint: hamburger (mobile only),
            page title, notification bell, avatar. Stays visible on scroll. */}
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-bg/80 px-4 py-4 backdrop-blur-md md:px-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMenuOpen(true)}
              aria-label="Buka menu"
              className="focus-ring text-navy md:hidden"
            >
              <Menu className="h-6 w-6" />
            </button>
            <h1 className="font-display text-lg font-semibold text-ink">
              {title}
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <Link href={NOTIF_HREF[role]} aria-label="Notifikasi" className="focus-ring relative text-ink-muted hover:text-ink">
              <Bell className="h-5 w-5" />
              <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-cta-strong" />
            </Link>
            <Link
              href={PROFILE_HREF[role]}
              aria-label="Profil"
              className="focus-ring flex items-center gap-2"
            >
              <span className="block h-8 w-8 overflow-hidden rounded-full">
                <Avatar name={profile?.name} photoURL={profile?.photoURL} className="h-8 w-8" />
              </span>
              <span className="hidden text-sm font-medium text-ink md:inline">
                {profile?.name ?? ""}
              </span>
            </Link>
          </div>
        </header>

        <main className="p-5 pb-20 md:p-8 md:pb-8">{children}</main>
      </div>

      {/* Mobile bottom nav — main actions stay thumb-reachable */}
      <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t border-border bg-surface md:hidden">
        {items.slice(0, 5).map((item) => (
          <BottomNavLink
            key={item.href}
            item={item}
            active={pathname === item.href}
          />
        ))}
      </nav>

      {/* Mobile slide-in menu — navy, matches the desktop sidebar's identity */}
      {menuOpen && (
        <div className="fixed inset-0 z-20 md:hidden">
          <div
            className="absolute inset-0 bg-black/40 transition-opacity"
            onClick={() => setMenuOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-y-0 left-0 w-64 bg-navy p-4 shadow-card transition-transform">
            <div className="mb-6 flex items-center justify-between">
              <span className="font-display text-base font-bold text-white">
                SPSMKN2
              </span>
              <button
                onClick={() => setMenuOpen(false)}
                aria-label="Tutup menu"
                className="focus-ring text-white/60 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="space-y-1">
              {items.map((item) => (
                <div key={item.href} onClick={() => setMenuOpen(false)}>
                  <SidebarLink item={item} active={pathname === item.href} />
                </div>
              ))}
            </nav>
            <button
              onClick={() => signOut(auth)}
              className="focus-ring mt-6 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-white/70 hover:bg-white/5 hover:text-white"
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

function SidebarLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        "focus-ring flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
        active
          ? "bg-white/10 text-white"
          : "text-white/60 hover:bg-white/5 hover:text-white"
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
