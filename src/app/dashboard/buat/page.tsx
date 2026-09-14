"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase/client";
import { STORAGE_ENABLED } from "@/lib/config";
import { useAuth } from "@/lib/auth/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea, Select } from "@/components/ui/form-fields";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Paperclip, ShieldCheck, Info, Send } from "lucide-react";
import type { Category } from "@/lib/types";

const MAX_FILES = 5;
const MAX_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

export default function BuatPengaduanPage() {
  const router = useRouter();
  const { firebaseUser } = useAuth();

  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [incidentDate, setIncidentDate] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [progressLabel, setProgressLabel] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, "categories"), where("isActive", "==", true));
    return onSnapshot(q, (snap) => {
      setCategories(
        snap.docs
          .map((d) => d.data() as Category)
          .sort((a, b) => a.name.localeCompare(b.name))
      );
    });
  }, []);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFileError(null);
    const chosen = Array.from(e.target.files ?? []);
    if (chosen.length > MAX_FILES) {
      setFileError(`Maksimal ${MAX_FILES} berkas.`);
      return;
    }
    for (const f of chosen) {
      if (f.size > MAX_SIZE) {
        setFileError(`${f.name} melebihi 10MB.`);
        return;
      }
      if (!ALLOWED_TYPES.includes(f.type)) {
        setFileError(`${f.name}: format tidak didukung (gunakan JPG/PNG/WEBP/PDF).`);
        return;
      }
    }
    setFiles(chosen);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!firebaseUser) return;
    if (!categoryId) {
      setError("Pilih kategori laporan.");
      return;
    }

    setSubmitting(true);
    try {
      const complaintId = doc(collection(db, "complaints")).id;

      const attachmentUrls: string[] = [];
      if (STORAGE_ENABLED) {
        for (let i = 0; i < files.length; i++) {
          setProgressLabel(`Mengunggah bukti ${i + 1}/${files.length}...`);
          const file = files[i];
          const path = `complaints/${complaintId}/${Date.now()}-${file.name}`;
          const ref = storageRef(storage, path);
          await uploadBytes(ref, file);
          attachmentUrls.push(await getDownloadURL(ref));
        }
      }

      setProgressLabel("Menyimpan laporan...");
      const idToken = await firebaseUser.getIdToken();
      const res = await fetch("/api/complaints", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          complaintId,
          categoryId,
          title,
          description,
          location,
          incidentDate,
          isAnonymous,
          attachmentUrls,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Gagal mengirim laporan.");
      }

      router.push(`/dashboard/pengaduan/${complaintId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengirim laporan.");
      setProgressLabel(null);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">
          Suara kamu penting
        </p>
        <h1 className="mt-1 font-display text-3xl font-bold leading-tight text-ink">
          Ceritakan apa yang terjadi.
        </h1>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-muted">
          Isi beberapa detail agar tim sekolah dapat memahami dan menindaklanjuti
          dengan tepat.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Card>
          <CardContent className="space-y-5">
            <SectionHeading
              icon={FileText}
              title="Rincian laporan"
              subtitle="Wajib diisi agar laporan bisa diproses."
            />

            <div className="space-y-1.5">
              <Label htmlFor="category">Kategori</Label>
              <Select
                id="category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                required
              >
                <option value="">Pilih kategori</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="location">Lokasi kejadian</Label>
              <Input
                id="location"
                placeholder="Contoh: Bengkel TKJ"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="incidentDate">Tanggal kejadian</Label>
              <Input
                id="incidentDate"
                type="date"
                value={incidentDate}
                onChange={(e) => setIncidentDate(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="title">Judul laporan</Label>
              <Input
                id="title"
                placeholder="Buat judul yang singkat dan jelas"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description">Deskripsi</Label>
              <Textarea
                id="description"
                placeholder="Menggambarkan situasi, waktu, dan dampaknya..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </div>
          </CardContent>
        </Card>

        {STORAGE_ENABLED && (
        <Card>
          <CardContent className="space-y-4">
            <SectionHeading
              icon={Paperclip}
              title="Bukti pendukung (opsional)"
              subtitle="Foto atau dokumen membantu petugas memahami masalah."
            />
            <label
              htmlFor="attachments"
              className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-brand/50 bg-brand-soft/60 px-4 py-6 text-center"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-surface text-brand">
                <Paperclip className="h-4 w-4" />
              </span>
              <span className="text-sm font-semibold text-brand-strong">
                Klik untuk mengunggah bukti
              </span>
              <span className="text-xs text-ink-muted">
                JPG, PNG, atau PDF · Maks. 10 MB
              </span>
              <input
                id="attachments"
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
            {files.length > 0 && (
              <p className="text-xs text-ink-muted">
                {files.length} berkas dipilih.
              </p>
            )}
            {fileError && <p className="text-xs text-danger">{fileError}</p>}
          </CardContent>
        </Card>
        )}

        <Card>
          <CardContent className="space-y-4">
            <SectionHeading
              icon={ShieldCheck}
              title="Pilihan privasi"
              subtitle="Kamu punya kendali atas identitasmu."
            />
            <label className="flex items-start gap-3 rounded-lg border border-border p-4 text-sm">
              <input
                type="checkbox"
                checked={isAnonymous}
                onChange={(e) => setIsAnonymous(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                <span className="font-semibold text-ink">Kirim sebagai anonim</span>
                <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">
                  Nama kamu tidak akan ditampilkan kepada pihak lain. Admin yang
                  berwenang tetap dapat melihat identitas bila diperlukan untuk
                  penanganan laporan.
                </p>
              </span>
            </label>
          </CardContent>
        </Card>

        <div className="flex items-start gap-3 rounded-lg bg-brand-soft p-4">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-strong" />
          <div>
            <p className="text-sm font-semibold text-brand-strong">
              Apa yang terjadi setelah dikirim?
            </p>
            <p className="mt-1 text-xs leading-relaxed text-brand-strong/80">
              Laporan akan <span className="font-semibold">Diajukan</span>, lalu
              ditindaklanjuti oleh tim sekolah. Kamu dapat memantau setiap
              langkahnya.
            </p>
          </div>
        </div>

        {error && (
          <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        <Button
          type="submit"
          variant="cta"
          size="lg"
          className="w-full"
          disabled={submitting}
        >
          <Send className="h-4 w-4" />
          {submitting ? progressLabel ?? "Mengirim..." : "Kirim pengaduan"}
        </Button>
        <p className="text-center text-xs text-ink-muted">
          Dengan mengirim, kamu menyetujui laporan ini ditinjau oleh petugas
          sekolah.
        </p>
      </form>
    </div>
  );
}

function SectionHeading({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-strong">
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <p className="text-sm font-semibold text-ink">{title}</p>
        <p className="text-xs text-ink-muted">{subtitle}</p>
      </div>
    </div>
  );
}
