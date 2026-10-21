"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useSearchParams } from "next/navigation";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { CheckCheck, MessageCircle, SendHorizontal, ShieldCheck, UserRound } from "lucide-react";
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
  const searchParams = useSearchParams();
  const [chats, setChats] = useState<SupportChat[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(true);
  const [units, setUnits] = useState<Unit[]>([]);
  const [officers, setOfficers] = useState<OfficerUser[]>([]);
  const [subject, setSubject] = useState("");
  const [draft, setDraft] = useState("");
  const [firstMessage, setFirstMessage] = useState("");
  const [unitId, setUnitId] = useState("");
  const [officerUid, setOfficerUid] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  function messageTime(value: string) {
    if (!value) return "";
    return new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
  }

  function messageDay(value: string) {
    if (!value) return "";
    const date = new Date(value);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return "Hari ini";
    if (date.toDateString() === yesterday.toDateString()) return "Kemarin";
    return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" }).format(date);
  }

  useEffect(() => {
    if (!firebaseUser) return;
    const chatsRef = collection(db, "support_chats");
    const q = role === "siswa"
      ? query(chatsRef, where("studentUid", "==", firebaseUser.uid))
      : role === "petugas"
        ? query(chatsRef, where("assignedOfficerUid", "==", firebaseUser.uid))
        : query(chatsRef);
    return onSnapshot(q, (snap) => {
      const next = snap.docs
        .map((d) => ({ ...d.data(), id: d.id } as SupportChat))
        .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
      setChats(next);
      const targetId = searchParams.get("chatId");
      setSelectedId((current) => {
        if (targetId && next.some((chat) => chat.id === targetId)) return targetId;
        if (current && next.some((chat) => chat.id === current)) return current;
        return next[0]?.id ?? null;
      });
    }, (loadError) => {
      console.error("[SupportInbox] Failed to load chat list", loadError);
      setError(`Tidak dapat memuat daftar chat (${loadError.code}). Periksa izin Firestore atau konfigurasi Firebase.`);
    });
  }, [firebaseUser, role, searchParams]);

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      setMessagesLoading(false);
      return;
    }
    setMessagesLoading(true);
    const q = query(collection(db, "support_chats", selectedId, "messages"), orderBy("createdAt", "asc"));
    return onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => ({ ...d.data(), id: d.id } as SupportMessage)));
      setMessagesLoading(false);
      setError(null);
    }, () => {
      setMessagesLoading(false);
      setError("Tidak dapat memuat pesan chat.");
    });
  }, [selectedId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, selectedId]);

  useEffect(() => {
    setDraft("");
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    const chat = chats.find((item) => item.id === selectedId);
    if (!chat) return;
    setUnitId(chat.assignedUnitId ?? "");
    setOfficerUid(chat.assignedOfficerUid ?? "");
  }, [selectedId, chats]);

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
      if (inputRef.current) inputRef.current.style.height = "auto";
      inputRef.current?.focus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Pesan gagal dikirim.");
    } finally { setBusy(false); }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  function handleDraftChange(value: string) {
    setDraft(value);
    const textarea = inputRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
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
        <h2 className="mt-1 font-display text-3xl font-bold text-ink">Customer Service</h2>
        <p className="mt-2 text-sm text-ink-muted">
          {role === "siswa" ? "Tanyakan kebutuhanmu langsung kepada admin sekolah." : "Tanggapi percakapan dan teruskan siswa ke petugas yang sesuai."}
        </p>
      </div>

      {error && <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>}

      <div className="grid min-h-[620px] overflow-hidden rounded-2xl border border-border bg-surface shadow-card md:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="border-b border-border md:border-b-0 md:border-r">
          {role === "siswa" && (
            <form onSubmit={submitNewChat} className="space-y-2 border-b border-border p-4">
              <p className="text-sm font-semibold text-ink">Hubungi customer service</p>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Topik, mis. Tanya beasiswa" maxLength={100} required />
              <textarea value={firstMessage} onChange={(e) => setFirstMessage(e.target.value)} placeholder="Ceritakan yang ingin ditanyakan..." maxLength={2000} required rows={3} className="focus-ring w-full resize-y rounded-xl border border-border bg-bg px-3 py-2 text-sm text-ink placeholder:text-ink-muted" />
              <Button type="submit" size="sm" disabled={busy || subject.trim().length < 3 || firstMessage.trim().length < 2} className="w-full">
                <MessageCircle className="h-4 w-4" /> {busy ? "Mengirim..." : "Mulai percakapan"}
              </Button>
            </form>
          )}
          <div className="max-h-[300px] overflow-y-auto md:max-h-[560px]">
            {chats.length === 0 ? (
              <p className="p-5 text-sm text-ink-muted">{role === "siswa" ? "Belum ada percakapan. Mulai chat dengan CS di atas." : "Belum ada percakapan masuk."}</p>
            ) : chats.map((chat) => (
              <button key={chat.id} onClick={() => setSelectedId(chat.id)} className={`focus-ring w-full border-b border-border p-4 text-left transition-colors ${selectedId === chat.id ? "bg-brand-soft" : "hover:bg-bg"}`}>
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate text-sm font-semibold text-ink">
                    {role === "siswa" ? chat.subject : chat.studentName}
                  </p>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${chat.status === "selesai" ? "bg-status-selesai-bg text-status-selesai" : chat.status === "diteruskan" ? "bg-status-diteruskan-bg text-status-diteruskan" : "bg-status-diajukan-bg text-ink-muted"}`}>
                    {chat.status === "menunggu_admin" ? "Menunggu admin" : chat.status === "diteruskan" ? (chat.conversationType === "officer" ? "Dengan petugas" : "Diteruskan") : "Selesai"}
                  </span>
                </div>
                <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-brand-strong">
                  {chat.conversationType === "officer" ? "Percakapan dengan petugas" : "Customer Service · Admin"}
                </p>
                <p className="mt-1 truncate text-xs text-ink-muted">{chat.lastMessage}</p>
                <p className="mt-2 text-[11px] text-ink-muted">{formatDateTimeShortID(chat.updatedAt)}</p>
              </button>
            ))}
          </div>
        </aside>

        <section className="flex min-h-[520px] flex-col">
          {!selected ? (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-ink-muted">
              <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-brand-soft text-brand-strong">
                <MessageCircle className="h-7 w-7" />
              </span>
              <p className="text-sm">Pilih percakapan untuk mulai chat dengan customer service.</p>
            </div>
          ) : <>
            <header className="flex items-center gap-3 bg-[#075e54] px-4 py-3 text-white sm:px-5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15">
                {role === "admin" ? <ShieldCheck className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold sm:text-base">{role === "siswa" ? selected.subject : selected.studentName}</p>
                <p className="mt-0.5 truncate text-xs text-white/75">
                  {selected.conversationType === "officer"
                    ? `${selected.assignedUnitName ?? "Unit"} · ${selected.assignedOfficerName ?? "Petugas"}`
                    : selected.forwardedChatId
                      ? `Customer Service · Diteruskan ke ${selected.assignedUnitName ?? "unit"} — ${selected.assignedOfficerName ?? "petugas"}`
                      : role !== "siswa" ? `${selected.subject} · Menunggu admin` : "Customer Service · Admin"}
                </p>
              </div>
              <div className="hidden shrink-0 items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white/90 sm:flex">
                <span className={`h-2 w-2 rounded-full ${selected.status === "selesai" ? "bg-white/50" : "bg-emerald-300"}`} />
                {selected.status === "selesai" ? "Selesai" : "Realtime"}
              </div>
              {role !== "siswa" && selected.status !== "selesai" && !(role === "admin" && selected.conversationType === "officer") && (
                <Button variant="secondary" size="sm" disabled={busy} onClick={completeChat} className="shrink-0">
                  <CheckCheck className="h-4 w-4" /> <span className="hidden sm:inline">Tandai selesai</span>
                </Button>
              )}
            </header>
            {role === "admin" && selected.status !== "selesai" && selected.conversationType !== "officer" && !selected.forwardedChatId && (
              <div className="flex flex-col gap-2 border-b border-border bg-surface p-3 sm:flex-row sm:px-4">
                <select value={unitId} onChange={(e) => { setUnitId(e.target.value); setOfficerUid(""); }} aria-label="Pilih unit" className="focus-ring min-h-10 flex-1 rounded-xl border border-border bg-surface px-3 text-sm text-ink">
                  <option value="">Pilih unit...</option>
                  {units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
                </select>
                <select value={officerUid} onChange={(e) => setOfficerUid(e.target.value)} aria-label="Pilih petugas" disabled={!unitId} className="focus-ring min-h-10 flex-1 rounded-xl border border-border bg-surface px-3 text-sm text-ink disabled:opacity-50">
                  <option value="">Pilih petugas...</option>
                  {eligibleOfficers.map((officer) => <option key={officer.uid} value={officer.uid}>{officer.name}</option>)}
                </select>
                <Button size="sm" disabled={busy || !officerUid} onClick={assignChat}>{busy ? "Memproses..." : "Teruskan"}</Button>
              </div>
            )}
            {selected.forwardedChatId && (
              <div className="flex flex-col gap-2 border-b border-border bg-brand-soft px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-ink-muted">
                  {role === "admin"
                    ? `Chat terpisah dengan ${selected.assignedOfficerName ?? "petugas"} sudah dibuat. Admin hanya dapat memantau.`
                    : `Percakapan sudah diteruskan kepada ${selected.assignedOfficerName ?? "petugas"}. Lanjutkan chat di kontak terpisah.`}
                </p>
                <Button size="sm" variant="secondary" onClick={() => setSelectedId(selected.forwardedChatId!)}>
                  {role === "admin" ? "Pantau chat petugas" : "Buka chat petugas"}
                </Button>
              </div>
            )}
            <div
              aria-live="polite"
              className="max-h-[min(58vh,560px)] min-h-[300px] flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-5"
              style={{
                backgroundColor: "#efeae2",
                backgroundImage: "radial-gradient(rgba(20, 40, 35, 0.045) 0.7px, transparent 0.7px)",
                backgroundSize: "12px 12px",
              }}
            >
              {messagesLoading ? (
                <div className="flex min-h-[260px] items-center justify-center">
                  <p className="rounded-full bg-white/80 px-4 py-2 text-sm text-ink-muted shadow-sm">Menghubungkan ke chat...</p>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex min-h-[260px] flex-col items-center justify-center text-center">
                  <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-white/80 text-[#075e54] shadow-sm">
                    <MessageCircle className="h-7 w-7" />
                  </span>
                  <p className="rounded-xl bg-[#fff8c6]/90 px-4 py-2 text-xs text-ink-muted shadow-sm">
                    Percakapan customer service: {selected.subject}.
                    <br />Kirim pesan untuk memulai.
                  </p>
                </div>
              ) : (
                <div className="mx-auto max-w-3xl space-y-2">
                  {messages.map((message, index) => {
                    const mine = message.authorUid === firebaseUser?.uid;
                    const previous = messages[index - 1];
                    const showDay = !previous || messageDay(previous.createdAt) !== messageDay(message.createdAt);
                    return (
                      <div key={message.id}>
                        {showDay && (
                          <div className="my-4 flex justify-center">
                            <span className="rounded-lg bg-white/85 px-3 py-1 text-[11px] font-medium text-ink-muted shadow-sm">{messageDay(message.createdAt)}</span>
                          </div>
                        )}
                        <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                          <div className={`relative max-w-[88%] px-3 py-2 shadow-sm sm:max-w-[78%] ${mine ? "rounded-xl rounded-tr-sm bg-[#d9fdd3] text-ink" : "rounded-xl rounded-tl-sm bg-white text-ink"}`}>
                            {!mine && (
                              <p className="mb-0.5 flex items-center gap-1 text-[11px] font-semibold text-[#075e54]">
                                <UserRound className="h-3 w-3" />
                                <span>{message.authorName}</span>
                                <span className="font-normal text-ink-muted">· {message.authorRole === "admin" ? "Admin" : message.authorRole === "petugas" ? "Petugas" : "Siswa"}</span>
                              </p>
                            )}
                            <div className="flex items-end gap-3">
                              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.message}</p>
                              <span className="mb-[-2px] flex shrink-0 items-center gap-1 text-[10px] text-ink-muted">
                                {messageTime(message.createdAt)}
                                {mine && <CheckCheck className="h-3.5 w-3.5 text-[#53a78e]" aria-label="Terkirim" />}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={bottomRef} />
                  {selected.status === "selesai" && (
                    <p className="mx-auto my-4 w-fit rounded-lg bg-white/85 px-3 py-1 text-[11px] font-medium text-ink-muted shadow-sm">Percakapan ini telah selesai.</p>
                  )}
                </div>
              )}
              {selected.conversationType === "officer" && selected.handoffNote && (
                <p className="mx-auto my-4 w-fit rounded-lg bg-white/85 px-3 py-1.5 text-center text-[11px] text-ink-muted shadow-sm">
                  {selected.handoffNote}{role === "admin" ? " Admin hanya dapat memantau percakapan." : ""}
                </p>
              )}
            </div>
            {selected.status !== "selesai" && !selected.forwardedChatId && !(role === "admin" && selected.conversationType === "officer") && (
              <form onSubmit={sendMessage} className="flex items-end gap-2 border-t border-border bg-[#f0f2f5] px-3 py-3 sm:px-4">
                <div className="flex min-h-11 flex-1 items-end rounded-2xl bg-white px-3 py-2 shadow-sm">
                  <textarea
                    ref={inputRef}
                    value={draft}
                    onChange={(event) => handleDraftChange(event.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ketik pesan"
                    maxLength={2000}
                    rows={1}
                    required
                    aria-label="Pesan customer service"
                    className="max-h-[120px] min-h-6 flex-1 resize-none bg-transparent text-sm leading-6 text-ink outline-none placeholder:text-ink-muted"
                  />
                  <span className="mb-0.5 ml-2 hidden text-[10px] text-ink-muted sm:inline">{draft.length}/2000</span>
                </div>
                <Button type="submit" disabled={busy || !draft.trim()} aria-label="Kirim pesan" className="h-11 w-11 shrink-0 rounded-full p-0">
                  {busy ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-label="Mengirim pesan" />
                  ) : (
                    <SendHorizontal className="h-4 w-4" />
                  )}
                </Button>
              </form>
            )}
          </>}
        </section>
      </div>
    </div>
  );
}