"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge, PriorityDot } from "@/components/ui/badge";
import { PRIORITY_LABEL, STATUS_LABEL } from "@/lib/types";
import { formatDateID, formatDateTimeShortID } from "@/lib/utils";
import type {
  Complaint,
  ComplaintHistoryEntry,
  ComplaintComment,
} from "@/lib/types";

export default function PengaduanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [complaint, setComplaint] = useState<Complaint | null | "not-found">(
    null
  );
  const [history, setHistory] = useState<ComplaintHistoryEntry[]>([]);
  const [comments, setComments] = useState<ComplaintComment[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "complaints", id), (snap) => {
      setComplaint(snap.exists() ? (snap.data() as Complaint) : "not-found");
    });
    return () => unsub();
  }, [id]);

  useEffect(() => {
    const q = query(
      collection(db, "complaints", id, "history"),
      orderBy("createdAt", "asc")
    );
    return onSnapshot(q, (snap) => {
      setHistory(
        snap.docs.map((d) => ({ ...(d.data() as ComplaintHistoryEntry), id: d.id }))
      );
    });
  }, [id]);

  useEffect(() => {
    const q = query(
      collection(db, "complaints", id, "comments"),
      where("visibility", "==", "pelapor"),
      orderBy("createdAt", "asc")
    );
    return onSnapshot(q, (snap) => {
      setComments(snap.docs.map((d) => d.data() as ComplaintComment));
    });
  }, [id]);

  if (complaint === null) {
    return <p className="text-sm text-ink-muted">Memuat...</p>;
  }
  if (complaint === "not-found") {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-ink-muted">
          Laporan tidak ditemukan.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <div className="flex items-center gap-2">
          <span className="font-display text-sm font-semibold text-ink-muted">
            {complaint.complaintNumber}
          </span>
        </div>
        <h2 className="mt-1 font-display text-xl font-bold text-ink">
          {complaint.title}
        </h2>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <StatusBadge status={complaint.status} />
          <span className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
            <PriorityDot priority={complaint.priority} />
            {PRIORITY_LABEL[complaint.priority]}
          </span>
        </div>
      </div>

      <Card>
        <CardContent className="grid grid-cols-2 gap-4 text-sm">
          <Info label="Kategori" value={complaint.categoryName} />
          <Info label="Lokasi" value={complaint.location} />
          <Info label="Tanggal kejadian" value={formatDateID(complaint.incidentDate)} />
          <Info
            label="Terakhir diperbarui"
            value={formatDateID(complaint.updatedAt)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Deskripsi
          </p>
          <p className="whitespace-pre-line text-sm text-ink">
            {complaint.description}
          </p>
        </CardContent>
      </Card>

      {(complaint.currentUnitName || complaint.currentOfficerName) && (
        <Card>
          <CardContent className="grid grid-cols-2 gap-4 text-sm">
            <Info label="Unit" value={complaint.currentUnitName ?? "-"} />
            <Info label="Petugas" value={complaint.currentOfficerName ?? "-"} />
            {complaint.deadline && (
              <Info label="Batas waktu" value={formatDateID(complaint.deadline)} />
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent>
          <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Timeline
          </p>
          <div className="space-y-4">
            {history.map((h, i) => (
              <div key={h.id ?? i} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span className="h-2.5 w-2.5 rounded-full bg-brand" />
                  {i < history.length - 1 && <span className="h-6 w-px bg-border" />}
                </div>
                <div>
                  <p className="text-sm font-medium text-ink">{h.action}</p>
                  <p className="text-xs text-ink-muted">
                    {formatDateTimeShortID(h.createdAt)}
                    {h.toStatus ? ` · ${STATUS_LABEL[h.toStatus]}` : ""}
                  </p>
                  {h.note && (
                    <p className="mt-0.5 text-xs text-ink-muted">{h.note}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {comments.length > 0 && (
        <Card>
          <CardContent>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Tanggapan
            </p>
            <div className="space-y-3">
              {comments.map((c) => (
                <div key={c.id} className="rounded-md bg-brand-soft p-3 text-sm">
                  <p className="text-ink">{c.message}</p>
                  <p className="mt-1 text-xs text-ink-muted">
                    {formatDateTimeShortID(c.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {complaint.attachmentUrls.length > 0 && (
        <Card>
          <CardContent>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Bukti terlampir
            </p>
            <div className="flex flex-wrap gap-2">
              {complaint.attachmentUrls.map((url) => (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-md border border-border px-3 py-1.5 text-xs text-brand-strong hover:bg-brand-soft"
                >
                  Lihat berkas
                </a>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Button variant="ghost" onClick={() => router.push("/dashboard/pengaduan")}>
        ← Kembali
      </Button>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-ink-muted">{label}</p>
      <p className="mt-0.5 font-medium text-ink">{value}</p>
    </div>
  );
}
