"use client";

import { useState, type FormEvent } from "react";
import { doc, updateDoc } from "firebase/firestore";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from "firebase/auth";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/lib/auth/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { StudentUser } from "@/lib/types";

export default function ProfilPage() {
  const { firebaseUser, profile } = useAuth();
  const student = profile as StudentUser | null;

  const [name, setName] = useState(student?.name ?? "");
  const [savingName, setSavingName] = useState(false);
  const [nameMsg, setNameMsg] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);

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
      const credential = EmailAuthProvider.credential(
        firebaseUser.email,
        currentPassword
      );
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

  if (!student) return null;

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>Informasi Akun</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-ink-muted">NIS</p>
            <p className="mt-0.5 font-medium text-ink">{student.nis}</p>
          </div>
          <div>
            <p className="text-xs text-ink-muted">Kelas</p>
            <p className="mt-0.5 font-medium text-ink">{student.className}</p>
          </div>
          <div className="col-span-2">
            <p className="text-xs text-ink-muted">Email</p>
            <p className="mt-0.5 font-medium text-ink">{student.email}</p>
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
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
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
            {passwordError && (
              <p className="text-sm text-danger">{passwordError}</p>
            )}
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
