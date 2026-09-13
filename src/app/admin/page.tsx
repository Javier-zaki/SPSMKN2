"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, onSnapshot } from "firebase/firestore";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { db } from "@/lib/firebase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge, PriorityDot } from "@/components/ui/badge";
import { formatDateID } from "@/lib/utils";
import type { Complaint } from "@/lib/types";

const CLOSED: Complaint["status"][] = ["selesai", "ditolak"];
const IN_PROGRESS: Complaint["status"][] = [
  "diverifikasi",
  "diteruskan",
  "diterima_petugas",
  "sedang_ditangani",
  "menunggu_konfirmasi",
  "dieskalasikan",
  "ditunda",
];

export default function AdminOverviewPage() {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // NOTE: fetches all complaints for dashboard aggregation. Fine at
    // school scale; if volume grows, replace with pre-aggregated counters
    // written alongside each status transition in the API routes.
    return onSnapshot(collection(db, "complaints"), (snap) => {
      setComplaints(snap.docs.map((d) => d.data() as Complaint));
      setLoading(false);
    });
  }, []);

  const now = Date.now();

  const stats = useMemo(
    () => ({
      total: complaints.length,
      menungguVerifikasi: complaints.filter((c) => c.status === "diajukan").length,
      diproses: complaints.filter((c) => IN_PROGRESS.includes(c.status)).length,
      terlambat: complaints.filter(
        (c) => c.deadline && new Date(c.deadline).getTime() < now && !CLOSED.includes(c.status)
      ).length,
      selesai: complaints.filter((c) => c.status === "selesai").length,
    }),
    [complaints, now]
  );

  const byMonth = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of complaints) {
      const d = new Date(c.createdAt);
      const key = new Intl.DateTimeFormat("id-ID", { month: "short", year: "2-digit" }).format(d);
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return Array.from(map, ([name, jumlah]) => ({ name, jumlah })).slice(-6);
  }, [complaints]);

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of complaints) map.set(c.categoryName, (map.get(c.categoryName) ?? 0) + 1);
    return Array.from(map, ([name, jumlah]) => ({ name, jumlah }));
  }, [complaints]);

  const byUnit = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of complaints) {
      if (!c.currentUnitName) continue;
      map.set(c.currentUnitName, (map.get(c.currentUnitName) ?? 0) + 1);
    }
    return Array.from(map, ([name, jumlah]) => ({ name, jumlah }));
  }, [complaints]);

  const highPriority = complaints
    .filter((c) => ["tinggi", "mendesak"].includes(c.priority) && !CLOSED.includes(c.status))
    .slice(0, 5);

  const overdue = complaints
    .filter((c) => c.deadline && new Date(c.deadline).getTime() < now && !CLOSED.includes(c.status))
    .slice(0, 5);

  const recent = [...complaints]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);

  if (loading) return <p className="text-sm text-ink-muted">Memuat...</p>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {[
          { label: "Total Pengaduan", value: stats.total },
          { label: "Menunggu Verifikasi", value: stats.menungguVerifikasi },
          { label: "Sedang Diproses", value: stats.diproses },
          { label: "Terlambat", value: stats.terlambat, danger: stats.terlambat > 0 },
          { label: "Selesai", value: stats.selesai },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent>
              <p className={`text-2xl font-semibold ${s.danger ? "text-danger" : "text-ink"}`}>
                {s.value}
              </p>
              <p className="mt-1 text-xs text-ink-muted">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <ChartCard title="Pengaduan per Bulan" data={byMonth} />
        <ChartCard title="Pengaduan per Kategori" data={byCategory} />
        <ChartCard title="Pengaduan per Unit" data={byUnit} />
        <Card>
          <CardHeader>
            <CardTitle>Laporan Prioritas Tinggi</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {highPriority.length === 0 ? (
              <p className="text-sm text-ink-muted">Tidak ada saat ini.</p>
            ) : (
              highPriority.map((c) => <MiniRow key={c.id} c={c} />)
            )}
          </CardContent>
        </Card>
      </div>

      {overdue.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>⚠️ Melebihi Batas Waktu</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {overdue.map((c) => (
              <MiniRow key={c.id} c={c} />
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Laporan Terbaru</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {recent.map((c) => (
            <MiniRow key={c.id} c={c} />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function ChartCard({ title, data }: { title: string; data: { name: string; jumlah: number }[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="h-56">
        {data.length === 0 ? (
          <p className="text-sm text-ink-muted">Belum ada data.</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--ink-muted))" />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--ink-muted))" />
              <Tooltip />
              <Bar dataKey="jumlah" fill="hsl(var(--brand))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

function MiniRow({ c }: { c: Complaint }) {
  return (
    <Link
      href={`/admin/pengaduan/${c.id}`}
      className="flex items-center justify-between gap-3 rounded-md px-2 py-2 hover:bg-brand-soft"
    >
      <div className="flex min-w-0 items-center gap-2">
        <PriorityDot priority={c.priority} />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">
            {c.complaintNumber} · {c.title}
          </p>
          <p className="text-xs text-ink-muted">
            {c.categoryName} · {formatDateID(c.updatedAt)}
          </p>
        </div>
      </div>
      <StatusBadge status={c.status} />
    </Link>
  );
}
