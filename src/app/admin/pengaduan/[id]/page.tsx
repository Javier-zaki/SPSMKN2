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
import { useAuth } from "@/lib/auth/AuthContext";
import { apiFetch } from "@/lib/api/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea, Select } from "@/components/ui/form-fields";
import { Modal } from "@/components/ui/dialog";
import { StatusBadge, PriorityDot } from "@/components/ui/badge";
import { PRIORITY_LABEL } from "@/lib/types";
import { formatDateID, formatDateTimeShortID } from "@/lib/utils";
import type {
  AdminUser,
  Complaint,
  ComplaintComment,
  ComplaintHistoryEntry,
  ComplaintPriority,
  OfficerUser,
  Unit,
} from "@/lib/types";

export default function AdminComplaintDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { firebaseUser, profile } = useAuth();

  const [complaint, setComplaint] = useState<Complaint | null | "not-found">(null);
  const [history, setHistory] = useState<ComplaintHistoryEntry[]>([]);
  const [comments, setComments] = useState<ComplaintComment[]>([]);
  const [studentName, setStudentName] = useState<string | null>(null);

  const [showVerify, setShowVerify] = useState<null | "approve" | "reject">(null);
  const [showForward, setShowForward] = useState(false);
  const [showComment, setShowComment] = useState<null | "pelapor" | "internal">(null);
  const [showClose, setShowClose] = useState(false);
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

  useEffect(() => {
    if (complaint === null || complaint === "not-found") return;
    const admin = profile as AdminUser;
    if (complaint.isAnonymous && !admin?.canViewAnonymousIdentity) {
      setStudentName(null);
      return;
    }
    const unsub = onSnapshot(doc(db, "users", complaint.studentUid), (snap) => {
      setStudentName(snap.exists() ? (snap.data().name as string) : null);
    });
    return () => unsub();
  }, [complaint, profile]);

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

  async function refreshOnError(fn: () => Promise<void>) {
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

  const publicComments = comments.filter((c) => c.visibility === "pelapor");
  const internalComments = comments.filter((c) => c.visibility === "internal");

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
            value={
              complaint.isAnonymous
                ? studentName
                  ? `${studentName} (anonim untuk petugas)`
                  : "Anonim"
                : studentName ?? "-"
            }
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

      {(complaint.currentUnitName || complaint.currentOfficerName) && (
        <Card>
          <CardContent className="grid grid-cols-2 gap-4 text-sm">
            <Info label="Unit" value={complaint.currentUnitName ?? "-"} />
            <Info label="Petugas" value={complaint.currentOfficerName ?? "-"} />
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <Card>
        <CardContent className="flex flex-wrap gap-2">
          {complaint.status === "diajukan" && (
            <>
              <Button onClick={() => setShowVerify("approve")}>Verifikasi</Button>
              <Button variant="danger" onClick={() => setShowVerify("reject")}>
                Tolak
              </Button>
            </>
          )}
          {["diverifikasi", "dikembalikan", "dieskalasikan"].includes(complaint.status) && (
            <Button onClick={() => setShowForward(true)}>Teruskan Laporan</Button>
          )}
          {!["ditolak", "selesai"].includes(complaint.status) && (
            <>
              <Button variant="secondary" onClick={() => setShowComment("pelapor")}>
                Tambah Tanggapan
              </Button>
              <Button variant="secondary" onClick={() => setShowComment("internal")}>
                Catatan Internal
              </Button>
              <Button variant="ghost" onClick={() => setShowClose(true)}>
                Tutup Laporan
              </Button>
            </>
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
              Catatan Internal (tidak terlihat oleh siswa)
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

      <Button variant="ghost" onClick={() => router.push("/admin/pengaduan")}>
        ← Kembali
      </Button>

      {/* Modals */}
      {showVerify && (
        <VerifyModal
          action={showVerify}
          busy={busy}
          onClose={() => setShowVerify(null)}
          onSubmit={(reason) =>
            refreshOnError(async () => {
              if (!firebaseUser) return;
              await apiFetch(firebaseUser, `/api/admin/complaints/${id}/verify`, {
                body: { action: showVerify, reason },
              });
              setShowVerify(null);
            })
          }
        />
      )}

      {showForward && (
        <ForwardModal
          complaintNumber={complaint.complaintNumber}
          busy={busy}
          onClose={() => setShowForward(false)}
          onSubmit={(data) =>
            refreshOnError(async () => {
              if (!firebaseUser) return;
              await apiFetch(firebaseUser, `/api/admin/complaints/${id}/forward`, { body: data });
              setShowForward(false);
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
            refreshOnError(async () => {
              if (!firebaseUser) return;
              await apiFetch(firebaseUser, `/api/admin/complaints/${id}/comment`, {
                body: { message, visibility: showComment },
              });
              setShowComment(null);
            })
          }
        />
      )}

      {showClose && (
        <CloseModal
          busy={busy}
          onClose={() => setShowClose(false)}
          onSubmit={(publicResponse) =>
            refreshOnError(async () => {
              if (!firebaseUser) return;
              await apiFetch(firebaseUser, `/api/admin/complaints/${id}/close`, {
                body: { publicResponse },
              });
              setShowClose(false);
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

function VerifyModal({
  action,
  busy,
  onClose,
  onSubmit,
}: {
  action: "approve" | "reject";
  busy: boolean;
  onClose: () => void;
  onSubmit: (reason?: string) => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <Modal open onClose={onClose} title={action === "approve" ? "Verifikasi Laporan" : "Tolak Laporan"}>
      <div className="space-y-4">
        {action === "reject" && (
          <div className="space-y-1.5">
            <Label htmlFor="reason">Alasan penolakan</Label>
            <Textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        )}
        {action === "approve" && (
          <p className="text-sm text-ink-muted">
            Laporan ini akan ditandai terverifikasi dan siap diteruskan ke unit terkait.
          </p>
        )}
        <div className="flex gap-2">
          <Button
            variant={action === "reject" ? "danger" : "primary"}
            disabled={busy}
            onClick={() => onSubmit(reason || undefined)}
          >
            {busy ? "Memproses..." : action === "approve" ? "Verifikasi" : "Tolak Laporan"}
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Batal
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function ForwardModal({
  complaintNumber,
  busy,
  onClose,
  onSubmit,
}: {
  complaintNumber: string;
  busy: boolean;
  onClose: () => void;
  onSubmit: (data: {
    unitId: string;
    officerUid: string;
    priority: ComplaintPriority;
    deadline: string | null;
    instruction: string;
  }) => void;
}) {
  const [units, setUnits] = useState<Unit[]>([]);
  const [officers, setOfficers] = useState<OfficerUser[]>([]);
  const [unitId, setUnitId] = useState("");
  const [officerUid, setOfficerUid] = useState("");
  const [priority, setPriority] = useState<ComplaintPriority>("normal");
  const [deadline, setDeadline] = useState("");
  const [instruction, setInstruction] = useState("");

  useEffect(() => {
    const q = query(collection(db, "units"), where("isActive", "==", true));
    return onSnapshot(q, (snap) => setUnits(snap.docs.map((d) => d.data() as Unit)));
  }, []);

  useEffect(() => {
    if (!unitId) {
      setOfficers([]);
      return;
    }
    const q = query(
      collection(db, "users"),
      where("role", "==", "petugas"),
      where("unitId", "==", unitId),
      where("isActive", "==", true)
    );
    return onSnapshot(q, (snap) => setOfficers(snap.docs.map((d) => d.data() as OfficerUser)));
  }, [unitId]);

  return (
    <Modal open onClose={onClose} title="Teruskan Laporan">
      <div className="space-y-4">
        <p className="text-xs text-ink-muted">Nomor: {complaintNumber}</p>

        <div className="space-y-1.5">
          <Label>Tujuan</Label>
          <Select value={unitId} onChange={(e) => { setUnitId(e.target.value); setOfficerUid(""); }}>
            <option value="">Pilih unit</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Petugas</Label>
          <Select value={officerUid} onChange={(e) => setOfficerUid(e.target.value)} disabled={!unitId}>
            <option value="">Pilih petugas</option>
            {officers.map((o) => (
              <option key={o.uid} value={o.uid}>
                {o.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Prioritas</Label>
            <Select value={priority} onChange={(e) => setPriority(e.target.value as ComplaintPriority)}>
              <option value="rendah">Rendah</option>
              <option value="normal">Normal</option>
              <option value="tinggi">Tinggi</option>
              <option value="mendesak">Mendesak</option>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Batas waktu</Label>
            <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Instruksi</Label>
          <Textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="Mohon dilakukan pengecekan dan perbaikan fasilitas tersebut."
          />
        </div>

        <div className="flex gap-2">
          <Button
            disabled={busy || !unitId || !officerUid || !instruction}
            onClick={() =>
              onSubmit({ unitId, officerUid, priority, deadline: deadline || null, instruction })
            }
          >
            {busy ? "Meneruskan..." : "Teruskan"}
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
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={
            visibility === "pelapor"
              ? "Laporan sudah diteruskan ke bagian Sarana & Prasarana dan sedang ditangani."
              : "Kemungkinan kerusakan berasal dari kabel utama."
          }
        />
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

function CloseModal({
  busy,
  onClose,
  onSubmit,
}: {
  busy: boolean;
  onClose: () => void;
  onSubmit: (publicResponse: string) => void;
}) {
  const [message, setMessage] = useState("");
  return (
    <Modal open onClose={onClose} title="Tutup Laporan">
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>Hasil akhir untuk pelapor</Label>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="AC sudah diperbaiki dan berfungsi normal."
          />
        </div>
        <div className="flex gap-2">
          <Button disabled={busy || message.length < 3} onClick={() => onSubmit(message)}>
            {busy ? "Menutup..." : "Tutup Laporan"}
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Batal
          </Button>
        </div>
      </div>
    </Modal>
  );
}
