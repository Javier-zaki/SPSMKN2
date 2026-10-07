"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { Check, CheckCheck, MessageCircle, SendHorizontal, ShieldCheck, UserRound } from "lucide-react";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/lib/auth/AuthContext";
import { apiFetch } from "@/lib/api/client";
import { Card } from "@/components/ui/card";
import type { ComplaintStatus, Role } from "@/lib/types";

interface ConversationMessage {
  id: string;
  authorUid: string;
  authorRole: Role;
  authorName: string;
  message: string;
  createdAt: string;
}

const CLOSED_STATUSES: ComplaintStatus[] = ["selesai", "ditolak"];
const MESSAGE_LIMIT = 100;

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

export function ComplaintConversation({
  complaintId,
  complaintNumber,
  studentUid,
  currentOfficerId,
  status,
}: {
  complaintId: string;
  complaintNumber: string;
  studentUid: string;
  currentOfficerId: string | null;
  status: ComplaintStatus;
}) {
  const { firebaseUser, profile } = useAuth();
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const userRole = profile?.role;
  const canView = userRole === "admin" ||
    (userRole === "siswa" && firebaseUser?.uid === studentUid) ||
    (userRole === "petugas" && firebaseUser?.uid === currentOfficerId);
  const canSend = canView && !CLOSED_STATUSES.includes(status);

  useEffect(() => {
    if (!canView) {
      setMessages([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const messagesQuery = query(
      collection(db, "complaints", complaintId, "public_chat_messages"),
      orderBy("createdAt", "desc"),
      limit(MESSAGE_LIMIT)
    );
    return onSnapshot(
      messagesQuery,
      (snapshot) => {
        setMessages(
          snapshot.docs
            .map((message) => ({
              ...(message.data() as ConversationMessage),
              id: message.id,
            }))
            .reverse()
        );
        setLoading(false);
        setError(null);
      },
      () => {
        setLoading(false);
        setError("Pesan tidak dapat dimuat. Periksa koneksi atau hak akses.");
      }
    );
  }, [canView, complaintId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = draft.trim();
    if (!firebaseUser || !message || !canSend || busy) return;

    setBusy(true);
    setError(null);
    try {
      await apiFetch(firebaseUser, `/api/complaints/${complaintId}/public-messages`, {
        body: { message },
      });
      setDraft("");
      if (inputRef.current) inputRef.current.style.height = "auto";
      inputRef.current?.focus();
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Pesan gagal dikirim.");
    } finally {
      setBusy(false);
    }
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

  if (!canView) return null;

  return (
    <Card className="overflow-hidden rounded-2xl shadow-card">
      <header className="flex items-center gap-3 bg-[#075e54] px-4 py-3 text-white sm:px-5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15">
          {userRole === "admin" ? <ShieldCheck className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold sm:text-base">Chat pengaduan</h3>
          <p className="mt-0.5 truncate text-xs text-white/75">
            {complaintNumber} · Pelapor{currentOfficerId ? " · Petugas menangani" : " · Menunggu petugas"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white/90">
          <span className="h-2 w-2 rounded-full bg-emerald-300" /> Realtime
        </div>
      </header>

      <div
        aria-live="polite"
        className="max-h-[min(58vh,560px)] min-h-[300px] overflow-y-auto px-3 py-4 sm:px-6 sm:py-5"
        style={{
          backgroundColor: "#efeae2",
          backgroundImage: "radial-gradient(rgba(20, 40, 35, 0.045) 0.7px, transparent 0.7px)",
          backgroundSize: "12px 12px",
        }}
      >
        {loading ? (
          <div className="flex min-h-[260px] items-center justify-center">
            <p className="rounded-full bg-white/80 px-4 py-2 text-sm text-ink-muted shadow-sm">Menghubungkan ke chat...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex min-h-[260px] flex-col items-center justify-center text-center">
            <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-white/80 text-[#075e54] shadow-sm">
              <MessageCircle className="h-7 w-7" />
            </span>
            <p className="rounded-xl bg-[#fff8c6]/90 px-4 py-2 text-xs text-ink-muted shadow-sm">
              Percakapan ini khusus untuk pengaduan {complaintNumber}.
              <br />Mulai dengan mengirim pesan.
            </p>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-2">
            {messages.length === MESSAGE_LIMIT && (
              <p className="mx-auto mb-3 w-fit rounded-lg bg-[#fff8c6]/90 px-3 py-1.5 text-[11px] text-ink-muted shadow-sm">
                Menampilkan {MESSAGE_LIMIT} pesan terbaru
              </p>
            )}
            {messages.map((message, index) => {
              const mine = message.authorUid === firebaseUser?.uid;
              const previous = messages[index - 1];
              const showDay = !previous || messageDay(previous.createdAt) !== messageDay(message.createdAt);
              return (
                <div key={message.id}>
                  {showDay && (
                    <div className="my-4 flex justify-center">
                      <span className="rounded-lg bg-white/85 px-3 py-1 text-[11px] font-medium text-ink-muted shadow-sm">
                        {messageDay(message.createdAt)}
                      </span>
                    </div>
                  )}
                  <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`relative max-w-[88%] px-3 py-2 shadow-sm sm:max-w-[78%] ${
                        mine
                          ? "rounded-xl rounded-tr-sm bg-[#d9fdd3] text-ink"
                          : "rounded-xl rounded-tl-sm bg-white text-ink"
                      }`}
                    >
                      {!mine && (
                        <p className="mb-0.5 flex items-center gap-1 text-[11px] font-semibold text-[#075e54]">
                          <UserRound className="h-3 w-3" />
                          <span>{message.authorName}</span>
                          <span className="font-normal text-ink-muted">
                            {message.authorRole === "admin" ? "· Admin" : message.authorRole === "petugas" ? "· Petugas" : "· Pelapor"}
                          </span>
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
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="border-t border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {canSend ? (
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
              aria-label="Pesan chat pengaduan"
              className="max-h-[120px] min-h-6 flex-1 resize-none bg-transparent text-sm leading-6 text-ink outline-none placeholder:text-ink-muted"
            />
            <span className="mb-0.5 ml-2 hidden text-[10px] text-ink-muted sm:inline">
              {draft.length}/2000
            </span>
          </div>
          <button
            type="submit"
            disabled={busy || !draft.trim()}
            aria-label="Kirim pesan"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#075e54] text-white transition-colors hover:bg-[#064c44] disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {busy ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <SendHorizontal className="h-5 w-5" />}
          </button>
        </form>
      ) : (
        <div className="border-t border-border bg-[#f0f2f5] px-4 py-3 text-center text-xs text-ink-muted">
          Percakapan diarsipkan karena laporan sudah ditutup.
        </div>
      )}
      <footer className="flex items-center justify-center gap-1 border-t border-border bg-surface px-3 py-2 text-[10px] text-ink-muted">
        <Check className="h-3 w-3" /> Chat terhubung langsung dengan pengaduan ini
      </footer>
    </Card>
  );
}
