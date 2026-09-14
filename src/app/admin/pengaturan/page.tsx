"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  updateProfile,
} from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "@/lib/firebase/client";
import { useAuth } from "@/lib/auth/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AdminUser } from "@/lib/types";

function initials(name: string | undefined) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

export default function PengaturanPage() {
  const { firebaseUser, profile } = useAuth();
  const admin = profile as AdminUser | null;

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoMsg, setPhotoMsg] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

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

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (!firebaseUser?.email) return;
    if (newPassword.length < 8) {
      setError("Kata sandi baru minimal 8 karakter.");
      return;
    }
    setBusy(true);
    try {
      const credential = EmailAuthProvider.credential(
        firebaseUser.email,
        currentPassword
      );
      await reauthenticateWithCredential(firebaseUser, credential);
      await updatePassword(firebaseUser, newPassword);
      setMessage("Kata sandi berhasil diubah.");
      setCurrentPassword("");
      setNewPassword("");
    } catch {
      setError("Kata sandi saat ini salah, atau terjadi kesalahan.");
    } finally {
      setBusy(false);
    }
  }

  if (!admin) return null;

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>Foto Profil</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-border bg-brand-soft text-lg font-bold text-brand-strong">
              {admin.photoURL ? (
                <img src={admin.photoURL} alt={admin.name} className="h-full w-full object-cover" />
              ) : (
                initials(admin.name)
              )}
            </div>
            <div className="flex-1">
              <p className="font-medium text-ink">{admin.name}</p>
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
          <CardTitle>Akun Admin</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p className="font-medium text-ink">{admin.name}</p>
          <p className="text-ink-muted">{admin.email}</p>
          <p className="text-xs text-ink-muted">
            {admin.canViewAnonymousIdentity
              ? "Berwenang melihat identitas pelapor anonim."
              : "Tidak berwenang melihat identitas pelapor anonim."}
          </p>
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
            {error && <p className="text-sm text-danger">{error}</p>}
            {message && <p className="text-sm text-success">{message}</p>}
            <Button type="submit" size="sm" disabled={busy}>
              {busy ? "Menyimpan..." : "Ubah Kata Sandi"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
