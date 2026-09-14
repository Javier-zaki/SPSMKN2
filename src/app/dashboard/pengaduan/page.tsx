"use client";

import { useEffect, useState } from "react";
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
import { StatusBadge } from "@/components/ui/badge";
import { CardListSkeleton } from "@/components/ui/skeleton";
import { ChevronRight } from "lucide-react";
import type { Complaint } from "@/lib/types";

export default function PengaduanSayaPage() {
  const { firebaseUser } = useAuth();
  const [complaints, setComplaints] = useState<Complaint[] | null>(null);

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

  if (complaints === null) {
    return <CardListSkeleton />;
  }

  if (complaints.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-sm font-medium text-ink">Belum ada pengaduan</p>
          <p className="mt-1 text-sm text-ink-muted">
            Laporan yang Anda buat akan muncul di sini.
          </p>
          <Link
            href="/dashboard/buat"
            className="mt-4 inline-block text-sm font-medium text-brand hover:underline"
          >
            Buat pengaduan pertama →
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {complaints.map((c) => (
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
                <p className="truncate text-sm font-semibold text-ink">
                  {c.title}
                </p>
                <p className="mt-0.5 text-xs text-ink-muted">
                  {c.categoryName} · {c.location}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-ink-muted" />
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
