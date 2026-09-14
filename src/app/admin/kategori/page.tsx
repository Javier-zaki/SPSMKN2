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
import { Textarea, Select } from "@/components/ui/form-fields";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/dialog";
import type { Category, Unit } from "@/lib/types";

export default function KategoriPage() {
  const { firebaseUser } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [editing, setEditing] = useState<Category | null | "new">(null);

  useEffect(() => {
    return onSnapshot(query(collection(db, "categories"), orderBy("name")), (snap) => {
      setCategories(snap.docs.map((d) => d.data() as Category));
    });
  }, []);

  useEffect(() => {
    return onSnapshot(collection(db, "units"), (snap) => {
      setUnits(snap.docs.map((d) => d.data() as Unit));
    });
  }, []);

  const unitName = (id?: string | null) => units.find((u) => u.id === id)?.name ?? "-";

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setEditing("new")}>
          + Tambah Kategori
        </Button>
      </div>

      <div className="space-y-2">
        {categories.map((c) => (
          <Card key={c.id}>
            <CardContent className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">{c.name}</p>
                <p className="text-xs text-ink-muted">
                  Unit tujuan default: {unitName(c.defaultUnitId)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={c.isActive ? "success" : "danger"}>
                  {c.isActive ? "Aktif" : "Nonaktif"}
                </Badge>
                <Button variant="ghost" size="sm" onClick={() => setEditing(c)}>
                  Edit
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {editing && firebaseUser && (
        <CategoryModal
          category={editing === "new" ? null : editing}
          units={units}
          onClose={() => setEditing(null)}
          firebaseUser={firebaseUser}
        />
      )}
    </div>
  );
}

function CategoryModal({
  category,
  units,
  onClose,
  firebaseUser,
}: {
  category: Category | null;
  units: Unit[];
  onClose: () => void;
  firebaseUser: NonNullable<ReturnType<typeof useAuth>["firebaseUser"]>;
}) {
  const [name, setName] = useState(category?.name ?? "");
  const [description, setDescription] = useState(category?.description ?? "");
  const [defaultUnitId, setDefaultUnitId] = useState(category?.defaultUnitId ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setBusy(true);
    setError(null);
    try {
      const body = { name, description, defaultUnitId: defaultUnitId || null };
      if (category) {
        await apiFetch(firebaseUser, `/api/admin/categories/${category.id}`, {
          method: "PATCH",
          body,
        });
      } else {
        await apiFetch(firebaseUser, "/api/admin/categories", { body });
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan.");
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleActive() {
    if (!category) return;
    setBusy(true);
    try {
      await apiFetch(firebaseUser, `/api/admin/categories/${category.id}`, {
        method: "PATCH",
        body: { isActive: !category.isActive },
      });
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={category ? "Edit Kategori" : "Tambah Kategori"}>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="cat-name">Nama kategori</Label>
          <Input id="cat-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cat-desc">Deskripsi</Label>
          <Textarea id="cat-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Unit tujuan default (opsional)</Label>
          <Select value={defaultUnitId} onChange={(e) => setDefaultUnitId(e.target.value)}>
            <option value="">Tidak ada</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <Button disabled={busy || !name} onClick={handleSave}>
            {busy ? "Menyimpan..." : "Simpan"}
          </Button>
          {category && (
            <Button variant="secondary" disabled={busy} onClick={handleToggleActive}>
              {category.isActive ? "Nonaktifkan" : "Aktifkan"}
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
