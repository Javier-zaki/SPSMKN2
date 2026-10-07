"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { MessageCircle, Send, UserRound, CheckCheck } from "lucide-react";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/lib/auth/AuthContext";
import { apiFetch } from "@/lib/api/client";
import type { SupportChat, SupportMessage, Unit, OfficerUser } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateTimeShortID } from "@/lib/utils";

type InboxRole = "siswa" | "admin" | "petugas";

export function SupportInbox({ role }: { role: InboxRole }) {
  const { firebaseUser } = useAuth();
  const [chats, setChats] = useState<SupportChat[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [officers, setOfficers] = useState<OfficerUser[]>([]);
  const [subject, setSubject] = useState("");
  const [draft, setDraft] = useState("");
  const [firstMessage, setFirstMessage] = useState("");
  const [unitId, setUnitId] = useState("");
  const [officerUid, setOfficerUid] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!firebaseUser) return;
    const chatsRef = collection(db, "support_chats");
    const q = role === "siswa"
      ? query(chatsRef, where("studentUid", "==", firebaseUser.uid), orderBy("updatedAt", "desc"))
      : role === "petugas"
        ? query(chatsRef, where("assignedOfficerUid", "==", firebaseUser.uid), orderBy("updatedAt", "desc"))
        : query(chatsRef, orderBy("updatedAt", "desc"));
    return onSnapshot(q, (snap) => {
      const next = snap.docs.map((d) => ({ ...d.data(), id: d.id } as SupportChat));
      setChats(next);
      setSelectedId((current) => current && next.some((chat) => chat.id === current) ? current : next[0]?.id ?? null);
    }, () => setError("Tidak dapat memuat daftar chat. Periksa aturan Firestore."));
  }, [firebaseUser, role]);

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }
    const q = query(collection(db, "support_chats", selectedId, "messages"), orderBy("createdAt", "asc"));
    return onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => ({ ...d.data(), id: d.id } as SupportMessage)));
    }, () => setError("Tidak dapat memuat pesan chat."));
  }, [selectedId]);

  useEffect(() => {
    if (role !== "admin") return;
    const unsubUnits = onSnapshot(query(collection(db, "units"), orderBy("name")), (snap) => {
      setUnits(snap.docs.map((d) => d.data() as Unit).filter((u) => u.isActive));
    });
    const unsubOfficers = onSnapshot(query(collection(db, "users"), where("role", "==", "petugas")), (snap) => {
      setOfficers(snap.docs.map((d) => d.data() as OfficerUser).filter((u) => u.isActive));
    });
    return () => { unsubUnits(); unsubOfficers(); };
  }, [role]);

  const selected = useMemo(() => chats.find((chat) => chat.id === selectedId) ?? null, [chats, selectedId]);
  const eligibleOfficers = officers.filter((officer) => officer.unitId === unitId);

  async function submitNewChat(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!firebaseUser) return;
    setBusy(true); setError(null);
    try {
      const result = await apiFetch<{ id: string }>(firebaseUser, "/api/support/chats", {
        body: { subject, message: firstMessage },
      });
      setSubject(""); setFirstMessage(""); setSelectedId(result.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chat gagal dibuat.");
    } finally { setBusy(false); }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!firebaseUser || !selected || !draft.trim()) return;
    setBusy(true); setError(null);
    try {
      await apiFetch(firebaseUser, `/api/support/chats/${selected.id}/messages`, { body: { message: draft } });
      setDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Pesan gagal dikirim.");
    } finally { setBusy(false); }
  }

  async function assignChat() {
    if (!firebaseUser || !selected) return;
    setBusy(true); setError(null);
    try {
      await apiFetch(firebaseUser, `/api/support/chats/${selected.id}/assign`, { body: { unitId, officerUid } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chat gagal diteruskan.");
    } finally { setBusy(false); }
  }

  async function completeChat() {
    if (!firebaseUser || !selected) return;
    setBusy(true); setError(null);
    try {
      await apiFetch(firebaseUser, `/api/support/chats/${selected.id}/complete`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chat gagal diselesaikan.");
    } finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">Pusat bantuan</p>
        <h2 className="mt-1 font-display text-3xl font-bold text-ink">Chat Bantuan</h2>
        <p className="mt-2 text-sm text-ink-muted">
          {role === "siswa" ? "Mulai percakapan dengan admin sekolah. Admin dapat meneruskan chat ke petugas yang sesuai." : "Tanggapi percakapan dan teruskan siswa ke unit yang tepat."}
        </p>
      </div>

      {error && <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>}

      <div className="grid min-h-[560px] overflow-hidden rounded-2xl border border-border bg-surface shadow-card md:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="border-b border-border md:border-b-0 md:border-r">
          {role === "siswa" && (
            <form onSubmit={submitNewChat} className="space-y-2 border-b border-border p-4">
              <p className="text-sm font-semibold text-ink">Mulai chat baru</p>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Topik, mis. Tanya beasiswa" maxLength={100} required />
              <textarea value={firstMessage} onChange={(e) => setFirstMessage(e.target.value)} placeholder="Ceritakan yang ingin ditanyakan..." maxLength={2000} required rows={3} className="focus-ring w-full resize-y rounded-xl border border-border bg-bg px-3 py-2 text-sm text-ink placeholder:text-ink-muted" />
              <Button type="submit" size="sm" disabled={busy || subject.trim().length < 3 || firstMessage.trim().length < 2} className="w-full">
                <MessageCircle className="h-4 w-4" /> {busy ? "Mengirim..." : "Hubungi admin"}
              </Button>
            </form>
          )}
          <div className="max-h-[360px] overflow-y-auto md:max-h-[520px]">
            {chats.length === 0 ? (
              <p className="p-5 text-sm text-ink-muted">{role === "siswa" ? "Belum ada percakapan. Mulai chat dengan admin di atas." : "Belum ada chat masuk."}</p>
            ) : chats.map((chat) => (
              <button key={chat.id} onClick={() => setSelectedId(chat.id)} className={`focus-ring w-full border-b border-border p-4 text-left transition-colors ${selectedId === chat.id ? "bg-brand-soft" : "hover:bg-bg"}`}>
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate text-sm font-semibold text-ink">{role === "siswa" ? chat.subject : chat.studentName}</p>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${chat.status === "selesai" ? "bg-status-selesai-bg text-status-selesai" : chat.status === "diteruskan" ? "bg-status-diteruskan-bg text-status-diteruskan" : "bg-status-diajukan-bg text-ink-muted"}`}>
                    {chat.status === "menunggu_admin" ? "Menunggu admin" : chat.status === "diteruskan" ? "Diteruskan" : "Selesai"}
                  </span>
                </div>
                <p className="mt-1 truncate text-xs text-ink-muted">{chat.lastMessage}</p>
                <p className="mt-2 text-[11px] text-ink-muted">{formatDateTimeShortID(chat.updatedAt)}</p>
              </button>
            ))}
          </div>
        </aside>

        <section className="flex min-h-[520px] flex-col">
          {!selected ? (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-ink-muted">
              <MessageCircle className="mb-3 h-10 w-10 opacity-30" />
              <p className="text-sm">Pilih percakapan untuk melihat pesan.</p>
            </div>
          ) : <>
            <header className="border-b border-border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-ink">{role === "siswa" ? selected.subject : selected.studentName}</p>
                  <p className="mt-1 text-xs text-ink-muted">{role !== "siswa" && selected.subject}{selected.assignedUnitName ? ` · ${selected.assignedUnitName}${selected.assignedOfficerName ? ` — ${selected.assignedOfficerName}` : ""}` : ""}</p>
                </div>
                {role !== "siswa" && selected.status !== "selesai" && (
                  <Button variant="secondary" size="sm" disabled={busy} onClick={completeChat}><CheckCheck className="h-4 w-4" /> Tandai selesai</Button>
                )}
              </div>
              {role === "admin" && selected.status !== "selesai" && (
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <select value={unitId} onChange={(e) => { setUnitId(e.target.value); setOfficerUid(""); }} className="focus-ring min-h-10 flex-1 rounded-xl border border-border bg-surface px-3 text-sm text-ink">
                    <option value="">Pilih unit...</option>
                    {units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
                  </select>
                  <select value={officerUid} onChange={(e) => setOfficerUid(e.target.value)} disabled={!unitId} className="focus-ring min-h-10 flex-1 rounded-xl border border-border bg-surface px-3 text-sm text-ink disabled:opacity-50">
                    <option value="">Pilih petugas...</option>
                    {eligibleOfficers.map((officer) => <option key={officer.uid} value={officer.uid}>{officer.name}</option>)}
                  </select>
                  <Button size="sm" disabled={busy || !officerUid} onClick={assignChat}>Teruskan</Button>
                </div>
              )}
            </header>
            <div className="flex-1 space-y-4 overflow-y-auto bg-bg/50 p-4">
              {messages.map((message) => {
                const mine = message.authorUid === firebaseUser?.uid;
                return <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${mine ? "rounded-br-md bg-brand text-white" : "rounded-bl-md border border-border bg-surface text-ink"}`}>
                    <p className={`mb-1 flex items-center gap-1.5 text-[11px] font-semibold ${mine ? "text-white/70" : "text-ink-muted"}`}><UserRound className="h-3 w-3" />{mine ? "Anda" : message.authorName}</p>
                    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.message}</p>
                    <p className={`mt-1.5 text-right text-[10px] ${mine ? "text-white/60" : "text-ink-muted"}`}>{formatDateTimeShortID(message.createdAt)}</p>
                  </div>
                </div>;
              })}
              {selected.status === "selesai" && <p className="py-2 text-center text-xs text-ink-muted">Percakapan ini telah selesai.</p>}
            </div>
            {selected.status !== "selesai" && (
              <form onSubmit={sendMessage} className="flex items-end gap-2 border-t border-border p-3 sm:p-4">
                <textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Tulis pesan..." maxLength={2000} rows={2} required className="focus-ring min-h-11 flex-1 resize-y rounded-xl border border-border bg-bg px-3 py-2 text-sm text-ink placeholder:text-ink-muted" />
                <Button type="submit" disabled={busy || !draft.trim()} aria-label="Kirim pesan"><Send className="h-4 w-4" /><span className="hidden sm:inline">Kirim</span></Button>
              </form>
            )}
          </>}
        </section>
      </div>
    </div>
  );
}