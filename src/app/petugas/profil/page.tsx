"use client";

import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  updateProfile,
} from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "@/lib/firebase/client";
import { useAuth } from "@/lib/auth/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { OfficerUser } from "@/lib/types";

function initials(name: string | undefined) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

export default function PetugasProfilPage() {
  const { firebaseUser, profile } = useAuth();
  const officer = profile as OfficerUser | null;
  const [unitName, setUnitName] = useState<string>("-");

  useEffect(() => {
    if (!officer?.unitId) return;
    getDoc(doc(db, "units", officer.unitId)).then((snap) => {
      if (snap.exists()) setUnitName(snap.data().name as string);
    });
  }, [officer?.unitId]);

  const [name, setName] = useState(officer?.name ?? "");
  const [savingName, setSavingName] = useState(false);
  const [nameMsg, setNameMsg] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoMsg, setPhotoMsg] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);

  async function handlePhotoUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !firebaseUser) return;
    if (!file.type.startsWith("image/")) {
      setPhotoError("Format foto harus berupa gambar.");
      e.target.value = "";
      return;
    }

    setUploadingPhoto(true);
    setPhotoError(null);
    setPhotoMsg(null);

    try {
      const photoRef = ref(storage, `users/${firebaseUser.uid}/profile-picture`);
      await uploadBytes(photoRef, file);
      const photoURL = await getDownloadURL(photoRef);

      await updateProfile(firebaseUser, { photoURL });
      await updateDoc(doc(db, "users", firebaseUser.uid), {
        photoURL,
        updatedAt: new Date().toISOString(),
      });

      setPhotoMsg("Foto profil berhasil diperbarui.");
    } catch {
      setPhotoError("Gagal mengunggah foto profil. Coba lagi.");
    } finally {
      setUploadingPhoto(false);
      e.target.value = "";
    }
  }

  async function handleSaveName(e: FormEvent) {
    e.preventDefault();
    if (!firebaseUser) return;
    setSavingName(true);
    setNameMsg(null);
    try {
      await updateDoc(doc(db, "users", firebaseUser.uid), {
        name,
        updatedAt: new Date().toISOString(),
      });
      setNameMsg("Nama berhasil diperbarui.");
    } finally {
      setSavingName(false);
    }
  }

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault();
    setPasswordError(null);
    setPasswordMsg(null);
    if (!firebaseUser?.email) return;
    if (newPassword.length < 8) {
      setPasswordError("Kata sandi baru minimal 8 karakter.");
      return;
    }
    setSavingPassword(true);
    try {
      const credential = EmailAuthProvider.credential(firebaseUser.email, currentPassword);
      await reauthenticateWithCredential(firebaseUser, credential);
      await updatePassword(firebaseUser, newPassword);
      setPasswordMsg("Kata sandi berhasil diubah.");
      setCurrentPassword("");
      setNewPassword("");
    } catch {
      setPasswordError("Kata sandi saat ini salah, atau terjadi kesalahan.");
    } finally {
      setSavingPassword(false);
    }
  }

  if (!officer) return null;

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>Foto Profil</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-border bg-brand-soft text-lg font-bold text-brand-strong">
              {officer.photoURL ? (
                <img src={officer.photoURL} alt={officer.name} className="h-full w-full object-cover" />
              ) : (
                initials(officer.name)
              )}
            </div>
            <div className="flex-1">
              <p className="font-medium text-ink">{officer.name}</p>
              <label className="mt-2 inline-flex cursor-pointer items-center rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-strong">
                {uploadingPhoto ? "Mengunggah..." : "Ubah foto"}
                <Input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={uploadingPhoto} />
              </label>
            </div>
          </div>
          {photoError && <p className="text-sm text-danger">{photoError}</p>}
          {photoMsg && <p className="text-sm text-success">{photoMsg}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Informasi Akun</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-ink-muted">Unit</p>
            <p className="mt-0.5 font-medium text-ink">{unitName}</p>
          </div>
          <div>
            <p className="text-xs text-ink-muted">Posisi</p>
            <p className="mt-0.5 font-medium text-ink">{officer.position ?? "-"}</p>
          </div>
          <div className="col-span-2">
            <p className="text-xs text-ink-muted">Email</p>
            <p className="mt-0.5 font-medium text-ink">{officer.email}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ubah Nama</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveName} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="name">Nama lengkap</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            {nameMsg && <p className="text-sm text-success">{nameMsg}</p>}
            <Button type="submit" size="sm" disabled={savingName}>
              {savingName ? "Menyimpan..." : "Simpan"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ubah Kata Sandi</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="current">Kata sandi saat ini</Label>
              <Input
                id="current"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new">Kata sandi baru</Label>
              <Input
                id="new"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>
            {passwordError && <p className="text-sm text-danger">{passwordError}</p>}
            {passwordMsg && <p className="text-sm text-success">{passwordMsg}</p>}
            <Button type="submit" size="sm" disabled={savingPassword}>
              {savingPassword ? "Menyimpan..." : "Ubah Kata Sandi"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
