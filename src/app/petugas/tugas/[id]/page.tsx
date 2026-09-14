"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase/client";
import { STORAGE_ENABLED } from "@/lib/config";
import { useAuth } from "@/lib/auth/AuthContext";
import { apiFetch } from "@/lib/api/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/form-fields";
import { Modal } from "@/components/ui/dialog";
import { StatusBadge, PriorityDot } from "@/components/ui/badge";
import { PRIORITY_LABEL } from "@/lib/types";
import { formatDateID, formatDateTimeShortID } from "@/lib/utils";
import type {
  Complaint,
  ComplaintComment,
  ComplaintHistoryEntry,
} from "@/lib/types";

export default function TugasDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { firebaseUser } = useAuth();

  const [complaint, setComplaint] = useState<Complaint | null | "not-found">(null);
  const [history, setHistory] = useState<ComplaintHistoryEntry[]>([]);
  const [comments, setComments] = useState<ComplaintComment[]>([]);

  const [showComplete, setShowComplete] = useState(false);
  const [showReturn, setShowReturn] = useState(false);
  const [showEscalate, setShowEscalate] = useState(false);
  const [showComment, setShowComment] = useState<null | "pelapor" | "internal">(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    return onSnapshot(doc(db, "complaints", id), (snap) => {
      setComplaint(snap.exists() ? (snap.data() as Complaint) : "not-found");
    });
  }, [id]);

  useEffect(() => {
    const q = query(collection(db, "complaints", id, "history"), orderBy("createdAt", "asc"));
    return onSnapshot(q, (snap) => {
      setHistory(snap.docs.map((d) => ({ ...(d.data() as ComplaintHistoryEntry), id: d.id })));
    });
  }, [id]);

  useEffect(() => {
    const q = query(collection(db, "complaints", id, "comments"), orderBy("createdAt", "asc"));
    return onSnapshot(q, (snap) => {
      setComments(snap.docs.map((d) => ({ ...(d.data() as ComplaintComment), id: d.id })));
    });
  }, [id]);

  if (complaint === null) return <p className="text-sm text-ink-muted">Memuat...</p>;
  if (complaint === "not-found") {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-ink-muted">
          Laporan tidak ditemukan.
        </CardContent>
      </Card>
    );
  }

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setActionError(null);
    try {
      await fn();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Gagal memproses.");
    } finally {
      setBusy(false);
    }
  }

  async function handleUploadEvidence(files: FileList | null) {
    if (!files || files.length === 0 || !firebaseUser) return;
    setUploading(true);
    setActionError(null);
    try {
      const urls: string[] = [];
      for (const file of Array.from(files).slice(0, 5)) {
        const path = `complaints/${id}/hasil-${Date.now()}-${file.name}`;
        const ref = storageRef(storage, path);
        await uploadBytes(ref, file);
        urls.push(await getDownloadURL(ref));
      }
      await apiFetch(firebaseUser, `/api/petugas/complaints/${id}/attachments`, {
        body: { urls },
      });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Gagal mengunggah bukti.");
    } finally {
      setUploading(false);
    }
  }

  const publicComments = comments.filter((c) => c.visibility === "pelapor");
  const internalComments = comments.filter((c) => c.visibility === "internal");

  const canReturn = ["diteruskan", "diterima_petugas", "sedang_ditangani"].includes(
    complaint.status
  );
  const canEscalate = ["diterima_petugas", "sedang_ditangani"].includes(complaint.status);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <span className="font-display text-sm font-semibold text-ink-muted">
          {complaint.complaintNumber}
        </span>
        <h2 className="mt-1 font-display text-xl font-bold text-ink">{complaint.title}</h2>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <StatusBadge status={complaint.status} />
          <span className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
            <PriorityDot priority={complaint.priority} />
            {PRIORITY_LABEL[complaint.priority]}
          </span>
          {complaint.deadline && (
            <span className="text-xs text-ink-muted">
              Batas waktu: {formatDateID(complaint.deadline)}
            </span>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="grid grid-cols-2 gap-4 text-sm">
          <Info label="Kategori" value={complaint.categoryName} />
          <Info label="Lokasi" value={complaint.location} />
          <Info label="Tanggal kejadian" value={formatDateID(complaint.incidentDate)} />
          <Info
            label="Pelapor"
            value={complaint.isAnonymous ? "Anonim" : "Terlihat oleh admin"}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Deskripsi
          </p>
          <p className="whitespace-pre-line text-sm text-ink">{complaint.description}</p>
        </CardContent>
      </Card>

      {complaint.attachmentUrls.length > 0 && (
        <Card>
          <CardContent>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Lampiran ({complaint.attachmentUrls.length})
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

      {/* Actions */}
      <Card>
        <CardContent className="flex flex-wrap gap-2">
          {complaint.status === "diteruskan" && (
            <Button
              disabled={busy}
              onClick={() =>
                run(async () => {
                  if (!firebaseUser) return;
                  await apiFetch(firebaseUser, `/api/petugas/complaints/${id}/accept`);
                })
              }
            >
              {busy ? "Memproses..." : "Terima Tugas"}
            </Button>
          )}

          {complaint.status === "diterima_petugas" && (
            <Button
              disabled={busy}
              onClick={() =>
                run(async () => {
                  if (!firebaseUser) return;
                  await apiFetch(firebaseUser, `/api/petugas/complaints/${id}/start`);
                })
              }
            >
              {busy ? "Memproses..." : "Mulai Penanganan"}
            </Button>
          )}

          {complaint.status === "sedang_ditangani" && (
            <>
              {STORAGE_ENABLED && (
                <label className="focus-ring inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-border bg-surface px-4 text-sm font-medium text-ink hover:bg-brand-soft">
                  {uploading ? "Mengunggah..." : "Unggah Bukti Hasil"}
                  <input
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    className="hidden"
                    disabled={uploading}
                    onChange={(e) => handleUploadEvidence(e.target.files)}
                  />
                </label>
              )}
              <Button variant="secondary" onClick={() => setShowComment("pelapor")}>
                Tambah Tanggapan
              </Button>
              <Button variant="secondary" onClick={() => setShowComment("internal")}>
                Catatan Internal
              </Button>
              <Button onClick={() => setShowComplete(true)}>Selesaikan Tugas</Button>
            </>
          )}

          {complaint.status === "menunggu_konfirmasi" && (
            <p className="text-sm text-ink-muted">
              Menunggu konfirmasi/penutupan oleh admin.
            </p>
          )}

          {canReturn && (
            <Button variant="ghost" onClick={() => setShowReturn(true)}>
              Kembalikan Laporan
            </Button>
          )}
          {canEscalate && (
            <Button variant="danger" onClick={() => setShowEscalate(true)}>
              Eskalasi Laporan
            </Button>
          )}
        </CardContent>
      </Card>
      {actionError && (
        <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{actionError}</p>
      )}

      <Card>
        <CardContent>
          <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Timeline
          </p>
          <div className="space-y-4">
            {history.map((h, i) => (
              <div key={h.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span className="h-2.5 w-2.5 rounded-full bg-brand" />
                  {i < history.length - 1 && <span className="h-6 w-px bg-border" />}
                </div>
                <div>
                  <p className="text-sm font-medium text-ink">{h.action}</p>
                  <p className="text-xs text-ink-muted">{formatDateTimeShortID(h.createdAt)}</p>
                  {h.note && <p className="mt-0.5 text-xs text-ink-muted">{h.note}</p>}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {publicComments.length > 0 && (
        <Card>
          <CardContent>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Tanggapan untuk Pelapor
            </p>
            <div className="space-y-3">
              {publicComments.map((c) => (
                <div key={c.id} className="rounded-md bg-brand-soft p-3 text-sm">
                  <p className="text-ink">{c.message}</p>
                  <p className="mt-1 text-xs text-ink-muted">{formatDateTimeShortID(c.createdAt)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {internalComments.length > 0 && (
        <Card>
          <CardContent>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Catatan Internal
            </p>
            <div className="space-y-3">
              {internalComments.map((c) => (
                <div key={c.id} className="rounded-md bg-warning/10 p-3 text-sm">
                  <p className="text-ink">{c.message}</p>
                  <p className="mt-1 text-xs text-ink-muted">{formatDateTimeShortID(c.createdAt)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Button variant="ghost" onClick={() => router.push("/petugas/tugas")}>
        ← Kembali
      </Button>

      {showComplete && (
        <CompleteModal
          busy={busy}
          onClose={() => setShowComplete(false)}
          onSubmit={(resultNote) =>
            run(async () => {
              if (!firebaseUser) return;
              await apiFetch(firebaseUser, `/api/petugas/complaints/${id}/complete`, {
                body: { resultNote },
              });
              setShowComplete(false);
            })
          }
        />
      )}

      {showReturn && (
        <ReturnModal
          busy={busy}
          onClose={() => setShowReturn(false)}
          onSubmit={(reason, note) =>
            run(async () => {
              if (!firebaseUser) return;
              await apiFetch(firebaseUser, `/api/petugas/complaints/${id}/return`, {
                body: { reason, note },
              });
              setShowReturn(false);
              router.push("/petugas/tugas");
            })
          }
        />
      )}

      {showEscalate && (
        <EscalateModal
          busy={busy}
          onClose={() => setShowEscalate(false)}
          onSubmit={(reason, note) =>
            run(async () => {
              if (!firebaseUser) return;
              await apiFetch(firebaseUser, `/api/petugas/complaints/${id}/escalate`, {
                body: { reason, note },
              });
              setShowEscalate(false);
            })
          }
        />
      )}

      {showComment && (
        <CommentModal
          visibility={showComment}
          busy={busy}
          onClose={() => setShowComment(null)}
          onSubmit={(message) =>
            run(async () => {
              if (!firebaseUser) return;
              await apiFetch(firebaseUser, `/api/admin/complaints/${id}/comment`, {
                body: { message, visibility: showComment },
              });
              setShowComment(null);
            })
          }
        />
      )}
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

function CompleteModal({
  busy,
  onClose,
  onSubmit,
}: {
  busy: boolean;
  onClose: () => void;
  onSubmit: (resultNote: string) => void;
}) {
  const [message, setMessage] = useState("");
  return (
    <Modal open onClose={onClose} title="Selesaikan Tugas">
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>Hasil penanganan</Label>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="AC sudah diperbaiki dan berfungsi normal."
          />
        </div>
        <p className="text-xs text-ink-muted">
          Laporan akan menunggu konfirmasi/penutupan oleh admin. Hasil ini
          juga akan terlihat oleh siswa pelapor.
        </p>
        <div className="flex gap-2">
          <Button disabled={busy || message.length < 3} onClick={() => onSubmit(message)}>
            {busy ? "Menyimpan..." : "Selesaikan"}
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Batal
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function ReturnModal({
  busy,
  onClose,
  onSubmit,
}: {
  busy: boolean;
  onClose: () => void;
  onSubmit: (reason: string, note?: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  return (
    <Modal open onClose={onClose} title="Kembalikan Laporan">
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>Alasan</Label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Informasi lokasi tidak lengkap"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Catatan (opsional)</Label>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Mohon konfirmasi lokasi kejadian kepada pelapor."
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant="danger"
            disabled={busy || reason.length < 3}
            onClick={() => onSubmit(reason, note || undefined)}
          >
            {busy ? "Mengirim..." : "Kembalikan"}
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Batal
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function EscalateModal({
  busy,
  onClose,
  onSubmit,
}: {
  busy: boolean;
  onClose: () => void;
  onSubmit: (reason: string, note?: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  return (
    <Modal open onClose={onClose} title="Eskalasi Laporan">
      <div className="space-y-4">
        <p className="text-xs text-ink-muted">
          Gunakan ini jika laporan tidak dapat Anda selesaikan dan
          memerlukan penanganan lebih lanjut dari admin/pimpinan unit.
        </p>
        <div className="space-y-1.5">
          <Label>Alasan</Label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Memerlukan anggaran perbaikan di luar wewenang unit"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Catatan (opsional)</Label>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <Button
            variant="danger"
            disabled={busy || reason.length < 3}
            onClick={() => onSubmit(reason, note || undefined)}
          >
            {busy ? "Mengirim..." : "Ajukan Eskalasi"}
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Batal
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function CommentModal({
  visibility,
  busy,
  onClose,
  onSubmit,
}: {
  visibility: "pelapor" | "internal";
  busy: boolean;
  onClose: () => void;
  onSubmit: (message: string) => void;
}) {
  const [message, setMessage] = useState("");
  return (
    <Modal
      open
      onClose={onClose}
      title={visibility === "pelapor" ? "Tanggapan untuk Pelapor" : "Catatan Internal"}
    >
      <div className="space-y-4">
        <Textarea value={message} onChange={(e) => setMessage(e.target.value)} />
        {visibility === "pelapor" && (
          <p className="text-xs text-ink-muted">Tanggapan ini akan terlihat oleh siswa pelapor.</p>
        )}
        <div className="flex gap-2">
          <Button disabled={busy || message.length < 2} onClick={() => onSubmit(message)}>
            {busy ? "Menyimpan..." : "Kirim"}
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Batal
          </Button>
        </div>
      </div>
    </Modal>
  );
}
