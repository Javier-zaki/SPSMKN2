"use client";

import { useEffect, useMemo, useState } from "react";
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
import { TaskCard } from "@/components/petugas/TaskCard";
import { PETUGAS_ACTIVE_STATUS } from "@/lib/petugasStatus";
import type { Complaint } from "@/lib/types";

export default function PetugasOverviewPage() {
  const { firebaseUser, profile } = useAuth();
  const [complaints, setComplaints] = useState<Complaint[]>([]);

  useEffect(() => {
    if (!firebaseUser) return;
    const q = query(
      collection(db, "complaints"),
      where("currentOfficerId", "==", firebaseUser.uid),
      orderBy("createdAt", "desc")
    );
    return onSnapshot(q, (snap) => {
      setComplaints(snap.docs.map((d) => d.data() as Complaint));
    });
  }, [firebaseUser]);

  const active = useMemo(
    () => complaints.filter((c) => PETUGAS_ACTIVE_STATUS.includes(c.status)),
    [complaints]
  );

  const overdue = useMemo(
    () =>
      active.filter(
        (c) => c.deadline && new Date(c.deadline).getTime() < Date.now()
      ),
    [active]
  );

  const stats = {
    aktif: active.length,
    mendesak: active.filter((c) => c.priority === "mendesak" || c.priority === "tinggi").length,
    terlambat: overdue.length,
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-ink-muted">
        Selamat datang, {profile?.name ?? "Petugas"}
      </p>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent>
            <p className="text-2xl font-semibold text-ink">{stats.aktif}</p>
            <p className="mt-1 text-xs text-ink-muted">Tugas Aktif</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-2xl font-semibold text-ink">{stats.mendesak}</p>
            <p className="mt-1 text-xs text-ink-muted">Prioritas Tinggi</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-2xl font-semibold text-danger">{stats.terlambat}</p>
            <p className="mt-1 text-xs text-ink-muted">Terlambat</p>
          </CardContent>
        </Card>
      </div>

      <div>
        <p className="mb-3 text-sm font-semibold text-ink">Laporan Saya</p>
        {active.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-ink-muted">
              Tidak ada tugas aktif saat ini.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {active.slice(0, 6).map((c) => (
              <TaskCard key={c.id} c={c} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
