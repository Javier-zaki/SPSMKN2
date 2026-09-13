"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/form-fields";
import { StatusBadge, PriorityDot } from "@/components/ui/badge";
import { STATUS_LABEL, PRIORITY_LABEL, type Complaint } from "@/lib/types";
import { formatDateID } from "@/lib/utils";

export default function AdminComplaintsPage() {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    return onSnapshot(collection(db, "complaints"), (snap) => {
      setComplaints(
        snap.docs
          .map((d) => d.data() as Complaint)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      );
    });
  }, []);

  const filtered = useMemo(() => {
    return complaints.filter((c) => {
      if (statusFilter && c.status !== statusFilter) return false;
      if (priorityFilter && c.priority !== priorityFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !c.complaintNumber.toLowerCase().includes(q) &&
          !c.title.toLowerCase().includes(q) &&
          !c.categoryName.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [complaints, statusFilter, priorityFilter, search]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          placeholder="Cari nomor, judul, atau kategori..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-xs"
        />
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="sm:max-w-[200px]">
          <option value="">Semua status</option>
          {Object.entries(STATUS_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className="sm:max-w-[160px]">
          <option value="">Semua prioritas</option>
          {Object.entries(PRIORITY_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-ink-muted">
            Tidak ada laporan yang cocok.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => (
            <Link key={c.id} href={`/admin/pengaduan/${c.id}`}>
              <Card className="transition-colors hover:border-brand">
                <CardContent className="flex items-center justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <PriorityDot priority={c.priority} />
                    <div className="min-w-0">
                      <p className="font-display text-sm font-semibold text-ink">
                        {c.complaintNumber}
                      </p>
                      <p className="truncate text-sm text-ink">{c.title}</p>
                      <p className="text-xs text-ink-muted">
                        {c.categoryName}
                        {c.currentUnitName ? ` · ${c.currentUnitName}` : ""} ·{" "}
                        {formatDateID(c.updatedAt)}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={c.status} />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
