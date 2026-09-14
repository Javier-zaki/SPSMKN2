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
import { Select } from "@/components/ui/form-fields";
import { TaskCard } from "@/components/petugas/TaskCard";
import { PETUGAS_ACTIVE_STATUS } from "@/lib/petugasStatus";
import { STATUS_LABEL } from "@/lib/types";
import type { Complaint } from "@/lib/types";

export default function TugasSayaPage() {
  const { firebaseUser } = useAuth();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    if (!firebaseUser) return;
    const q = query(
      collection(db, "complaints"),
      where("currentOfficerId", "==", firebaseUser.uid),
      orderBy("createdAt", "desc")
    );
    return onSnapshot(q, (snap) => {
      setComplaints(
        snap.docs
          .map((d) => d.data() as Complaint)
          .filter((c) => PETUGAS_ACTIVE_STATUS.includes(c.status))
      );
    });
  }, [firebaseUser]);

  const filtered = useMemo(
    () =>
      statusFilter
        ? complaints.filter((c) => c.status === statusFilter)
        : complaints,
    [complaints, statusFilter]
  );

  return (
    <div className="space-y-4">
      <Select
        value={statusFilter}
        onChange={(e) => setStatusFilter(e.target.value)}
        className="sm:max-w-[220px]"
      >
        <option value="">Semua status aktif</option>
        {PETUGAS_ACTIVE_STATUS.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABEL[s]}
          </option>
        ))}
      </Select>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-ink-muted">
            Tidak ada tugas yang cocok.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((c) => (
            <TaskCard key={c.id} c={c} />
          ))}
        </div>
      )}
    </div>
  );
}
