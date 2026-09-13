"use client";

import { useEffect, useState } from "react";
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
import { PETUGAS_HISTORY_STATUS } from "@/lib/petugasStatus";
import type { Complaint } from "@/lib/types";

export default function RiwayatPage() {
  const { firebaseUser, profile } = useAuth();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const unitId = profile?.role === "petugas" ? profile.unitId : undefined;

  useEffect(() => {
    if (!firebaseUser || !unitId) return;
    const q = query(
      collection(db, "complaints"),
      where("currentUnitId", "==", unitId),
      orderBy("createdAt", "desc")
    );
    return onSnapshot(
      q,
      (snap) => {
        setLoadError(null);
        setComplaints(
          snap.docs
            .map((d) => d.data() as Complaint)
            .filter(
              (c) =>
                c.currentOfficerId === firebaseUser.uid &&
                PETUGAS_HISTORY_STATUS.includes(c.status)
            )
        );
      },
      (error) => setLoadError(error.message)
    );
  }, [firebaseUser, unitId]);

  if (loadError) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-danger">
          Gagal memuat riwayat: {loadError}
        </CardContent>
      </Card>
    );
  }

  if (complaints.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-ink-muted">
          Belum ada riwayat laporan.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {complaints.map((c) => (
        <TaskCard key={c.id} c={c} />
      ))}
    </div>
  );
}
