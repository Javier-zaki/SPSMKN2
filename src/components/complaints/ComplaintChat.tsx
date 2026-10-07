"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { MessageCircle, Send, UserRound } from "lucide-react";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/lib/auth/AuthContext";
import { apiFetch } from "@/lib/api/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDateTimeShortID } from "@/lib/utils";
import type { ComplaintChatMessage, ComplaintStatus } from "@/lib/types";

const CLOSED_STATUSES: ComplaintStatus[] = [
  "selesai",
  "ditolak",
  "dikembalikan",
  "dieskalasikan",
];
const MAX_LIVE_MESSAGES = 100;

export function ComplaintChat({
  complaintId,
  complaintNumber,
  currentOfficerId,
  status,
}: {
  complaintId: string;
  complaintNumber: string;
  currentOfficerId: string | null;
  status: ComplaintStatus;
}) {
  const { firebaseUser, profile } = useAuth();
  const [messages, setMessages] = useState<ComplaintChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const canView = profile?.role === "admin" ||
    (profile?.role === "petugas" && firebaseUser?.uid === currentOfficerId);
  const canSend = canView && Boolean(currentOfficerId) && !CLOSED_STATUSES.includes(status);

  useEffect(() => {
    if (!canView || !currentOfficerId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const messagesQuery = query(
      collection(db, "complaints", complaintId, "chat_messages"),
      orderBy("createdAt", "desc"),
      limit(MAX_LIVE_MESSAGES)
    );
    return onSnapshot(
      messagesQuery,
      (snapshot) => {
        setMessages(
          snapshot.docs
            .map((message) => ({
              ...(message.data() as ComplaintChatMessage),
              id: message.id,
            }))
            .reverse()
        );
        setLoading(false);
        setError(null);
      },
      () => {
        setLoading(false);
        setError("Chat tidak dapat dimuat. Periksa koneksi atau hak akses.");
      }
    );
  }, [canView, complaintId, currentOfficerId]);

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
      await apiFetch(firebaseUser, `/api/complaints/${complaintId}/messages`, {
        body: { message },
      });
      setDraft("");
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

  if (!canView || !currentOfficerId) return null;

  return (
    <Card>
      <CardContent className="p-0">
        <header className="flex items-center gap-3 border-b border-border px-5 py-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-soft text-brand-strong">
            <MessageCircle className="h-5 w-5" />
          </span>
          <div>
            <h3 className="font-semibold text-ink">Chat penanganan</h3>
            <p className="text-xs text-ink-muted">
              {complaintNumber} · realtime dengan admin dan petugas penanggung jawab
            </p>
          </div>
          <span className="ml-auto flex items-center gap-1.5 text-xs text-success">
            <span className="h-2 w-2 rounded-full bg-success" /> Live
          </span>
        </header>

        <div
          aria-live="polite"
          className="max-h-[420px] min-h-40 space-y-3 overflow-y-auto bg-bg/50 p-4"
        >
          {loading ? (
            <p className="py-8 text-center text-sm text-ink-muted">Memuat percakapan...</p>
          ) : messages.length === 0 ? (
            <div className="py-8 text-center">
              <MessageCircle className="mx-auto mb-2 h-7 w-7 text-ink-muted/50" />
              <p className="text-sm text-ink-muted">Belum ada pesan. Mulai diskusi di sini.</p>
            </div>
          ) : (
            <>
              {messages.length === MAX_LIVE_MESSAGES && (
                <p className="text-center text-xs text-ink-muted">
                  Menampilkan {MAX_LIVE_MESSAGES} pesan terbaru.
                </p>
              )}
              {messages.map((message) => {
                const mine = message.authorUid === firebaseUser?.uid;
                return (
                  <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[88%] rounded-2xl px-4 py-3 ${
                        mine
                          ? "rounded-br-md bg-brand text-white"
                          : "rounded-bl-md border border-border bg-surface text-ink"
                      }`}
                    >
                      <p
                        className={`mb-1 flex items-center gap-1.5 text-[11px] font-semibold ${
                          mine ? "text-white/70" : "text-ink-muted"
                        }`}
                      >
                        <UserRound className="h-3 w-3" />
                        {mine ? "Anda" : message.authorName}
                      </p>
                      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                        {message.message}
                      </p>
                      <p
                        className={`mt-1.5 text-right text-[10px] ${
                          mine ? "text-white/60" : "text-ink-muted"
                        }`}
                      >
                        {formatDateTimeShortID(message.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </>
          )}
        </div>

        {error && (
          <p role="alert" className="border-t border-border bg-danger/10 px-4 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        {canSend ? (
          <form onSubmit={sendMessage} className="flex items-end gap-2 border-t border-border p-3 sm:p-4">
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Tulis pesan... (Enter untuk kirim, Shift+Enter untuk baris baru)"
              maxLength={2000}
              rows={2}
              required
              aria-label="Pesan chat"
              className="focus-ring min-h-11 flex-1 resize-y rounded-xl border border-border bg-bg px-3 py-2 text-sm text-ink placeholder:text-ink-muted"
            />
            <Button type="submit" disabled={busy || !draft.trim()} aria-label="Kirim pesan">
              <Send className="h-4 w-4" />
              <span className="hidden sm:inline">{busy ? "Mengirim..." : "Kirim"}</span>
            </Button>
          </form>
        ) : (
          <p className="border-t border-border px-4 py-3 text-center text-xs text-ink-muted">
            Laporan sudah ditutup; percakapan hanya dapat dibaca.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
