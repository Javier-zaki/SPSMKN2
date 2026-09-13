"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/lib/auth/AuthContext";
import { apiFetch } from "@/lib/api/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/form-fields";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/dialog";
import type { Unit } from "@/lib/types";

export default function UnitPage() {
  const { firebaseUser } = useAuth();
  const [units, setUnits] = useState<Unit[]>([]);
  const [editing, setEditing] = useState<Unit | null | "new">(null);

  useEffect(() => {
    return onSnapshot(query(collection(db, "units"), orderBy("name")), (snap) => {
      setUnits(snap.docs.map((d) => d.data() as Unit));
    });
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setEditing("new")}>
          + Tambah Unit
        </Button>
      </div>

      <div className="space-y-2">
        {units.map((u) => (
          <Card key={u.id}>
            <CardContent className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">{u.name}</p>
                {u.description && <p className="text-xs text-ink-muted">{u.description}</p>}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={u.isActive ? "success" : "danger"}>
                  {u.isActive ? "Aktif" : "Nonaktif"}
                </Badge>
                <Button variant="ghost" size="sm" onClick={() => setEditing(u)}>
                  Edit
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {editing && firebaseUser && (
        <UnitModal
          unit={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          firebaseUser={firebaseUser}
        />
      )}
    </div>
  );
}

function UnitModal({
  unit,
  onClose,
  firebaseUser,
}: {
  unit: Unit | null;
  onClose: () => void;
  firebaseUser: NonNullable<ReturnType<typeof useAuth>["firebaseUser"]>;
}) {
  const [name, setName] = useState(unit?.name ?? "");
  const [description, setDescription] = useState(unit?.description ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setBusy(true);
    setError(null);
    try {
      if (unit) {
        await apiFetch(firebaseUser, `/api/admin/units/${unit.id}`, {
          method: "PATCH",
          body: { name, description },
        });
      } else {
        await apiFetch(firebaseUser, "/api/admin/units", { body: { name, description } });
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan.");
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleActive() {
    if (!unit) return;
    setBusy(true);
    try {
      await apiFetch(firebaseUser, `/api/admin/units/${unit.id}`, {
        method: "PATCH",
        body: { isActive: !unit.isActive },
      });
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={unit ? "Edit Unit" : "Tambah Unit"}>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="unit-name">Nama unit</Label>
          <Input id="unit-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="unit-desc">Deskripsi</Label>
          <Textarea
            id="unit-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <Button disabled={busy || !name} onClick={handleSave}>
            {busy ? "Menyimpan..." : "Simpan"}
          </Button>
          {unit && (
            <Button variant="secondary" disabled={busy} onClick={handleToggleActive}>
              {unit.isActive ? "Nonaktifkan" : "Aktifkan"}
            </Button>
          )}
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Batal
          </Button>
        </div>
      </div>
    </Modal>
  );
}
