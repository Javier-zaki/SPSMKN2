"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/lib/auth/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { formatDateID, formatDateTimeShortID } from "@/lib/utils";
import { STATUS_LABEL } from "@/lib/types";
import { ClipboardList, Clock, CheckCircle2, Plus, Sparkles, ArrowRight, Check } from "lucide-react";
import type { Complaint, ComplaintHistoryEntry, ComplaintStatus } from "@/lib/types";

const IN_PROGRESS: ComplaintStatus[] = [
  "diverifikasi",
  "diteruskan",
  "diterima_petugas",
  "sedang_ditangani",
  "menunggu_konfirmasi",
];

const STEP_ORDER: ComplaintStatus[] = [
  "diajukan",
  "diverifikasi",
  "diteruskan",
  "diterima_petugas",
  "sedang_ditangani",
  "menunggu_konfirmasi",
  "selesai",
];

const STEP_SHORT_LABEL: Partial<Record<ComplaintStatus, string>> = {
  diterima_petugas: "Diterima Petugas",
  menunggu_konfirmasi: "Menunggu Konfirmasi",
  sedang_ditangani: "Sedang Ditangani",
};

export default function SiswaOverviewPage() {
  const { profile, firebaseUser } = useAuth();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [history, setHistory] = useState<ComplaintHistoryEntry[]>([]);

  useEffect(() => {
    if (!firebaseUser) return;
    const q = query(
      collection(db, "complaints"),
      where("studentUid", "==", firebaseUser.uid),
      orderBy("createdAt", "desc")
    );
    return onSnapshot(q, (snap) => {
      setComplaints(snap.docs.map((d) => d.data() as Complaint));
    });
  }, [firebaseUser]);

  const featured = useMemo(() => {
    const active = complaints.filter((c) => IN_PROGRESS.includes(c.status));
    return active.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null;
  }, [complaints]);

  useEffect(() => {
    if (!featured) {
      setHistory([]);
      return;
    }
    const q = query(
      collection(db, "complaints", featured.id, "history"),
      orderBy("createdAt", "asc")
    );
    return onSnapshot(q, (snap) => {
      setHistory(snap.docs.map((d) => ({ ...(d.data() as ComplaintHistoryEntry), id: d.id })));
    });
  }, [featured?.id]);

  const stats = useMemo(
    () => ({
      total: complaints.length,
      diproses: complaints.filter((c) => IN_PROGRESS.includes(c.status)).length,
      selesai: complaints.filter((c) => c.status === "selesai").length,
    }),
    [complaints]
  );

  const firstName = profile?.name?.split(" ")[0] ?? "";
  const stepIndex = featured ? STEP_ORDER.indexOf(featured.status) : -1;
  const progressPct =
    stepIndex >= 0 ? Math.round((stepIndex / (STEP_ORDER.length - 1)) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-cta-strong">
          <span className="h-1.5 w-1.5 rounded-full bg-cta-strong" />
          Selamat datang kembali, {firstName}
        </p>
        <h1 className="mt-1 font-display text-3xl font-bold leading-tight text-ink">
          Suaramu membuat sekolah jadi lebih baik.
        </h1>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-muted">
          Pantau laporanmu, lihat progresnya, dan tetap terhubung dengan tim
          sekolah.
        </p>
      </div>

      <Link href="/dashboard/buat">
        <Button variant="cta" size="lg" className="w-full sm:w-auto">
          <Plus className="h-4 w-4" />
          Buat pengaduan baru
        </Button>
      </Link>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard icon={ClipboardList} value={stats.total} label="Total pengaduan" tag="Sejak awal" />
        <StatCard icon={Clock} value={stats.diproses} label="Sedang ditangani" tag="Perlu perhatian" tone="cta" />
        <StatCard icon={CheckCircle2} value={stats.selesai} label="Selesai" tag="Terima kasih!" />
      </div>

      {featured && stepIndex >= 0 && (
        <div className="relative overflow-hidden rounded-2xl bg-brand p-5 text-white">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full border border-white/10" />
          <div className="pointer-events-none absolute -right-2 top-6 h-24 w-24 rounded-full border border-white/10" />

          <p className="relative flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-cta">
            <Sparkles className="h-3.5 w-3.5" />
            Sedang berjalan
          </p>
          <h2 className="relative mt-2 font-display text-xl font-bold leading-snug">
            {featured.title}
          </h2>
          <p className="relative mt-1 text-xs text-white/70">
            {featured.complaintNumber} · {featured.categoryName} · {featured.location}
          </p>

          <span className="relative mt-3 inline-block rounded-full bg-white px-3 py-1 text-xs font-semibold text-cta-strong">
            {STATUS_LABEL[featured.status]}
          </span>

          <div className="relative mt-5">
            <div className="flex items-center justify-between text-xs text-white/80">
              <span>Progres penanganan</span>
              <span className="font-semibold text-white">{progressPct}%</span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-white/15">
              <div
                className="h-2 rounded-full bg-cta"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          <div className="relative mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-4">
            {STEP_ORDER.map((s, i) => (
              <div key={s} className="flex items-center gap-1.5">
                {i <= stepIndex ? (
                  <Check className="h-3.5 w-3.5 shrink-0 text-cta" />
                ) : (
                  <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-white/30" />
                )}
                <span className={`text-xs ${i <= stepIndex ? "text-white" : "text-white/50"}`}>
                  {STEP_SHORT_LABEL[s] ?? STATUS_LABEL[s]}
                </span>
              </div>
            ))}
          </div>

          <div className="relative mt-5 flex items-center justify-between border-t border-white/10 pt-4 text-xs">
            <span className="flex items-center gap-1.5 text-white/70">
              <Clock className="h-3.5 w-3.5" />
              Batas pembaruan:{" "}
              <span className="font-semibold text-white">
                {featured.deadline ? formatDateID(featured.deadline) : "Belum ditentukan"}
              </span>
            </span>
            <Link
              href={`/dashboard/pengaduan/${featured.id}`}
              className="flex items-center gap-1 font-semibold text-cta"
            >
              Lihat detail <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      )}

      {featured && history.length > 0 && (
        <Card>
          <CardContent>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-ink">Jejak laporan</p>
                <p className="text-xs text-ink-muted">Tidak ada yang terlewat.</p>
              </div>
            </div>
            <div className="space-y-4">
              {history.map((h, i) => (
                <div key={h.id ?? i} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                        i === history.length - 1 ? "bg-status-ditangani-bg text-status-ditangani-text" : "bg-status-selesai-bg text-status-selesai-text"
                      }`}
                    >
                      {i === history.length - 1 ? <Clock className="h-3 w-3" /> : <Check className="h-3 w-3" />}
                    </span>
                    {i < history.length - 1 && <span className="h-6 w-px bg-border" />}
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                      {formatDateTimeShortID(h.createdAt)}
                    </p>
                    <p className="text-sm font-semibold text-ink">{h.action}</p>
                    {h.note && <p className="text-xs text-ink-muted">{h.note}</p>}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-ink">Pengaduan terbaru</p>
            <p className="text-xs text-ink-muted">Laporan yang kamu buat belakangan ini.</p>
          </div>
          {complaints.length > 0 && (
            <Link href="/dashboard/pengaduan" className="shrink-0 text-sm font-semibold text-brand">
              Lihat semua
            </Link>
          )}
        </div>
        {complaints.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-ink-muted">
              Belum ada pengaduan.{" "}
              <Link href="/dashboard/buat" className="font-medium text-brand hover:underline">
                Buat yang pertama
              </Link>
              .
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {complaints.slice(0, 5).map((c) => (
              <Link key={c.id} href={`/dashboard/pengaduan/${c.id}`}>
                <Card className="transition-all duration-200 hover:-translate-y-0.5 hover:border-brand hover:shadow-md">
                  <CardContent className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className="font-display text-xs font-semibold uppercase tracking-wide text-ink-muted">
                          {c.complaintNumber}
                        </span>
                        <StatusBadge status={c.status} />
                      </div>
                      <p className="truncate text-sm font-semibold text-ink">{c.title}</p>
                      <p className="mt-0.5 text-xs text-ink-muted">
                        {c.categoryName} · {c.location}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  value,
  label,
  tag,
  tone = "neutral",
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: number;
  label: string;
  tag: string;
  tone?: "neutral" | "cta";
}) {
  const iconBg = tone === "cta" ? "bg-cta/25 text-cta-strong" : "bg-brand-soft text-brand-strong";
  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-start justify-between">
          <span className={`flex h-9 w-9 items-center justify-center rounded-full ${iconBg}`}>
            <Icon className="h-4 w-4" />
          </span>
          <span className="text-xs text-ink-muted">{tag}</span>
        </div>
        <div>
          <p className="font-display text-3xl font-bold text-ink">
            {String(value).padStart(2, "0")}
          </p>
          <p className="mt-0.5 text-xs text-ink-muted">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
