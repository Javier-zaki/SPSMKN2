"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/lib/auth/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { formatDateTimeShortID, cn } from "@/lib/utils";
import { SlidersHorizontal, Clock, CheckCircle2, Check } from "lucide-react";
import type { Notification } from "@/lib/types";

function iconFor(title: string) {
  const t = title.toLowerCase();
  if (t.includes("batas waktu") || t.includes("deadline") || t.includes("konfirmasi"))
    return Clock;
  if (t.includes("selesai")) return CheckCircle2;
  return SlidersHorizontal;
}

export default function NotifikasiPage() {
  const { firebaseUser } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<Notification[]>([]);

  useEffect(() => {
    if (!firebaseUser) return;
    const q = query(
      collection(db, "notifications"),
      where("userId", "==", firebaseUser.uid),
      orderBy("createdAt", "desc")
    );
    return onSnapshot(q, (snap) => {
      setItems(
        snap.docs.map((d) => ({ ...(d.data() as Notification), id: d.id }))
      );
    });
  }, [firebaseUser]);

  async function handleClick(n: Notification) {
    if (!n.isRead) {
      await updateDoc(doc(db, "notifications", n.id), { isRead: true });
    }
    if (n.complaintId) {
      router.push(`/dashboard/pengaduan/${n.complaintId}`);
    }
  }

  async function markAllRead() {
    const unread = items.filter((n) => !n.isRead);
    if (unread.length === 0) return;
    const batch = writeBatch(db);
    unread.forEach((n) => batch.update(doc(db, "notifications", n.id), { isRead: true }));
    await batch.commit();
  }

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">
            Tetap terhubung
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold leading-tight text-ink">
            Notifikasi
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            Pembaruan penting tentang laporanmu.
          </p>
        </div>
        <button
          onClick={markAllRead}
          className="focus-ring shrink-0 text-right text-sm font-semibold text-brand"
        >
          Tandai semua dibaca
        </button>
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-ink-muted">
            Belum ada notifikasi.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((n) => {
            const Icon = iconFor(n.title);
            return (
              <button
                key={n.id}
                onClick={() => handleClick(n)}
                className={cn(
                  "focus-ring w-full rounded-2xl border p-4 text-left transition-colors",
                  n.isRead
                    ? "border-border bg-surface"
                    : "border-transparent bg-brand-soft"
                )}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                      n.isRead ? "bg-status-diajukan-bg text-ink-muted" : "bg-brand text-white"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-ink">{n.title}</p>
                      <div className="flex shrink-0 items-center gap-2">
                        {!n.isRead && <span className="h-2 w-2 rounded-full bg-cta-strong" />}
                        <Check className="h-4 w-4 text-ink-muted" />
                      </div>
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-ink-muted">
                      {n.message}
                    </p>
                    <p className="mt-2 text-xs font-medium text-ink-muted">
                      {formatDateTimeShortID(n.createdAt)}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
