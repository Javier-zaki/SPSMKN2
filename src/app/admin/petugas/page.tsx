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
import { Select } from "@/components/ui/form-fields";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/dialog";
import type { OfficerUser, Unit } from "@/lib/types";

export default function PetugasPage() {
  const { firebaseUser } = useAuth();
  const [officers, setOfficers] = useState<OfficerUser[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<OfficerUser | null>(null);

  useEffect(() => {
    const q = query(collection(db, "users"), where("role", "==", "petugas"));
    return onSnapshot(q, (snap) => {
      setOfficers(
        snap.docs.map((d) => d.data() as OfficerUser).sort((a, b) => a.name.localeCompare(b.name))
      );
    });
  }, []);

  useEffect(() => {
    return onSnapshot(collection(db, "units"), (snap) => setUnits(snap.docs.map((d) => d.data() as Unit)));
  }, []);

  const unitName = (id: string) => units.find((u) => u.id === id)?.name ?? "-";

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return officers;
    return officers.filter(
      (o) => o.name.toLowerCase().includes(q) || unitName(o.unitId).toLowerCase().includes(q)
    );
  }, [officers, search, units]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
        <Input
          placeholder="Cari nama atau unit..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-xs"
        />
        <Button size="sm" onClick={() => setShowAdd(true)}>
          + Tambah Petugas
        </Button>
      </div>

      <div className="space-y-2">
        {filtered.map((o) => (
          <Card key={o.uid}>
            <CardContent className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">{o.name}</p>
                <p className="text-xs text-ink-muted">
                  {unitName(o.unitId)}
                  {o.position ? ` · ${o.position}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={o.isActive ? "success" : "danger"}>
                  {o.isActive ? "Aktif" : "Nonaktif"}
                </Badge>
                <Button variant="ghost" size="sm" onClick={() => setEditing(o)}>
                  Kelola
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && (
          <Card>
            <CardContent className="py-10 text-center text-sm text-ink-muted">
              Tidak ada petugas yang cocok.
            </CardContent>
          </Card>
        )}
      </div>

      {showAdd && firebaseUser && (
        <AddOfficerModal units={units} onClose={() => setShowAdd(false)} firebaseUser={firebaseUser} />
      )}
      {editing && firebaseUser && (
        <ManageOfficerModal
          officer={editing}
          units={units}
          onClose={() => setEditing(null)}
          firebaseUser={firebaseUser}
        />
      )}
    </div>
  );
}

function AddOfficerModal({
  units,
  onClose,
  firebaseUser,
}: {
  units: Unit[];
  onClose: () => void;
  firebaseUser: NonNullable<ReturnType<typeof useAuth>["firebaseUser"]>;
}) {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [unitId, setUnitId] = useState("");
  const [position, setPosition] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(firebaseUser, "/api/admin/users", {
        body: { role: "petugas", username, email, name, password, unitId, position },
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membuat akun.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Tambah Petugas">
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>Nama lengkap</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Username</Label>
          <Input value={username} onChange={(e) => setUsername(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Email</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Unit</Label>
            <Select value={unitId} onChange={(e) => setUnitId(e.target.value)}>
              <option value="">Pilih unit</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Jabatan (opsional)</Label>
            <Input value={position} onChange={(e) => setPosition(e.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Kata sandi awal</Label>
          <Input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimal 8 karakter" />
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex gap-2">
          <Button
            disabled={busy || !name || !username || !email || !unitId || password.length < 8}
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

function ManageOfficerModal({
  officer,
  units,
  onClose,
  firebaseUser,
}: {
  officer: OfficerUser;
  units: Unit[];
  onClose: () => void;
  firebaseUser: NonNullable<ReturnType<typeof useAuth>["firebaseUser"]>;
}) {
  const [name, setName] = useState(officer.name);
  const [unitId, setUnitId] = useState(officer.unitId);
  const [position, setPosition] = useState(officer.position ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  async function handleSave() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(firebaseUser, `/api/admin/users/${officer.uid}`, {
        method: "PATCH",
        body: { name, unitId, position },
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
      await apiFetch(firebaseUser, `/api/admin/users/${officer.uid}`, {
        method: "PATCH",
        body: { isActive: !officer.isActive },
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
        `/api/admin/users/${officer.uid}`,
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
    <Modal open onClose={onClose} title={`Kelola: ${officer.name}`}>
      <div className="space-y-4">
        {tempPassword ? (
          <div className="rounded-md bg-brand-soft p-3 text-sm">
            <p className="font-medium text-ink">Kata sandi sementara baru:</p>
            <p className="mt-1 font-mono text-brand-strong">{tempPassword}</p>
            <p className="mt-1 text-xs text-ink-muted">
              Sampaikan ke petugas secara langsung. Wajib diganti saat login berikutnya.
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              <Label>Nama lengkap</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Unit</Label>
                <Select value={unitId} onChange={(e) => setUnitId(e.target.value)}>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Jabatan</Label>
                <Input value={position} onChange={(e) => setPosition(e.target.value)} />
              </div>
            </div>
            {error && <p className="text-sm text-danger">{error}</p>}
            <div className="flex flex-wrap gap-2">
              <Button disabled={busy} onClick={handleSave}>
                {busy ? "Menyimpan..." : "Simpan Perubahan"}
              </Button>
              <Button variant="secondary" disabled={busy} onClick={handleResetPassword}>
                Reset Kata Sandi
              </Button>
              <Button variant={officer.isActive ? "danger" : "secondary"} disabled={busy} onClick={handleToggleActive}>
                {officer.isActive ? "Nonaktifkan Akun" : "Aktifkan Akun"}
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
