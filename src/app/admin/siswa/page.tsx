"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/lib/auth/AuthContext";
import { apiFetch } from "@/lib/api/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/dialog";
import { formatDateID } from "@/lib/utils";
import type { StudentUser } from "@/lib/types";

export default function SiswaPage() {
  const { firebaseUser } = useAuth();
  const [students, setStudents] = useState<StudentUser[]>([]);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<StudentUser | null>(null);

  useEffect(() => {
    const q = query(collection(db, "users"), where("role", "==", "siswa"));
    return onSnapshot(q, (snap) => {
      setStudents(
        snap.docs
          .map((d) => d.data() as StudentUser)
          .sort((a, b) => a.name.localeCompare(b.name))
      );
    });
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.nis.toLowerCase().includes(q) ||
        s.className.toLowerCase().includes(q)
    );
  }, [students, search]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
        <Input
          placeholder="Cari nama, NIS, atau kelas..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-xs"
        />
        <Button size="sm" onClick={() => setShowAdd(true)}>
          + Tambah Siswa
        </Button>
      </div>

      <div className="space-y-2">
        {filtered.map((s) => (
          <Card key={s.uid}>
            <CardContent className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">{s.name}</p>
                <p className="text-xs text-ink-muted">
                  NIS {s.nis} · Kelas {s.className} · Dibuat {formatDateID(s.createdAt)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={s.isActive ? "success" : "danger"}>
                  {s.isActive ? "Aktif" : "Nonaktif"}
                </Badge>
                <Button variant="ghost" size="sm" onClick={() => setEditing(s)}>
                  Kelola
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && (
          <Card>
            <CardContent className="py-10 text-center text-sm text-ink-muted">
              Tidak ada siswa yang cocok.
            </CardContent>
          </Card>
        )}
      </div>

      {showAdd && firebaseUser && (
        <AddStudentModal onClose={() => setShowAdd(false)} firebaseUser={firebaseUser} />
      )}
      {editing && firebaseUser && (
        <ManageStudentModal
          student={editing}
          onClose={() => setEditing(null)}
          firebaseUser={firebaseUser}
        />
      )}
    </div>
  );
}

function AddStudentModal({
  onClose,
  firebaseUser,
}: {
  onClose: () => void;
  firebaseUser: NonNullable<ReturnType<typeof useAuth>["firebaseUser"]>;
}) {
  const [name, setName] = useState("");
  const [nis, setNis] = useState("");
  const [className, setClassName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(firebaseUser, "/api/admin/users", {
        body: {
          role: "siswa",
          username: nis,
          email,
          name,
          password,
          nis,
          className,
        },
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membuat akun.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Tambah Siswa">
      <div className="space-y-4">
        <p className="text-xs text-ink-muted">
          NIS akan digunakan sebagai username login. Siswa wajib mengganti kata
          sandi pada login pertama.
        </p>
        <div className="space-y-1.5">
          <Label>Nama lengkap</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>NIS</Label>
            <Input value={nis} onChange={(e) => setNis(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Kelas</Label>
            <Input value={className} onChange={(e) => setClassName(e.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Email</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Kata sandi awal</Label>
          <Input
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Minimal 8 karakter"
          />
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex gap-2">
          <Button
            disabled={busy || !name || !nis || !className || !email || password.length < 8}
            onClick={handleSubmit}
          >
            {busy ? "Membuat..." : "Buat Akun"}
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Batal
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function ManageStudentModal({
  student,
  onClose,
  firebaseUser,
}: {
  student: StudentUser;
  onClose: () => void;
  firebaseUser: NonNullable<ReturnType<typeof useAuth>["firebaseUser"]>;
}) {
  const [name, setName] = useState(student.name);
  const [className, setClassName] = useState(student.className);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  async function handleSave() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(firebaseUser, `/api/admin/users/${student.uid}`, {
        method: "PATCH",
        body: { name, className },
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan.");
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleActive() {
    setBusy(true);
    try {
      await apiFetch(firebaseUser, `/api/admin/users/${student.uid}`, {
        method: "PATCH",
        body: { isActive: !student.isActive },
      });
      onClose();
    } finally {
      setBusy(false);
    }
  }

  async function handleResetPassword() {
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<{ tempPassword?: string }>(
        firebaseUser,
        `/api/admin/users/${student.uid}`,
        { method: "PATCH", body: { resetPassword: true } }
      );
      setTempPassword(res.tempPassword ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal reset kata sandi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`Kelola: ${student.name}`}>
      <div className="space-y-4">
        {tempPassword ? (
          <div className="rounded-md bg-brand-soft p-3 text-sm">
            <p className="font-medium text-ink">Kata sandi sementara baru:</p>
            <p className="mt-1 font-mono text-brand-strong">{tempPassword}</p>
            <p className="mt-1 text-xs text-ink-muted">
              Sampaikan ke siswa secara langsung. Kata sandi ini wajib diganti
              saat login berikutnya.
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              <Label>Nama lengkap</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Kelas</Label>
              <Input value={className} onChange={(e) => setClassName(e.target.value)} />
            </div>
            {error && <p className="text-sm text-danger">{error}</p>}
            <div className="flex flex-wrap gap-2">
              <Button disabled={busy} onClick={handleSave}>
                {busy ? "Menyimpan..." : "Simpan Perubahan"}
              </Button>
              <Button variant="secondary" disabled={busy} onClick={handleResetPassword}>
                Reset Kata Sandi
              </Button>
              <Button variant={student.isActive ? "danger" : "secondary"} disabled={busy} onClick={handleToggleActive}>
                {student.isActive ? "Nonaktifkan Akun" : "Aktifkan Akun"}
              </Button>
            </div>
          </>
        )}
        <Button variant="ghost" onClick={onClose} disabled={busy}>
          Tutup
        </Button>
      </div>
    </Modal>
  );
}
