import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { writeAuditLog } from "@/lib/api/auditLog";
import type { ComplaintStatus } from "@/lib/types";

// Statuses where a deadline is still "live" — anything closed no longer
// needs a reminder.
const ACTIVE_STATUSES: ComplaintStatus[] = [
  "diteruskan",
  "diterima_petugas",
  "sedang_ditangani",
];

const WARN_WINDOW_MS = 24 * 60 * 60 * 1000; // warn when <=24h remain

/**
 * Called on a schedule (see vercel.json) rather than by any user action.
 * Protected by CRON_SECRET so it can't be triggered by an outside request —
 * this is the one route in the app that isn't gated by a Firebase role,
 * so it needs its own check.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const provided = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!secret || provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = Date.now();
  const nowIso = new Date(now).toISOString();

  const snap = await adminDb
    .collection("complaints")
    .where("status", "in", ACTIVE_STATUSES)
    .get();

  let warned = 0;
  let overdue = 0;

  const admins = await adminDb
    .collection("users")
    .where("role", "==", "admin")
    .where("isActive", "==", true)
    .get();

  for (const doc of snap.docs) {
    const c = doc.data();
    if (!c.deadline) continue;
    const deadlineMs = new Date(c.deadline).getTime();

    // Deadline already passed and not yet flagged as overdue.
    if (deadlineMs < now && !c.deadlineOverdueNotifiedAt) {
      await doc.ref.update({ deadlineOverdueNotifiedAt: nowIso });

      await Promise.all(
        admins.docs.map((a) =>
          adminDb.collection("notifications").add({
            userId: a.id,
            role: "admin",
            title: "Melebihi batas waktu",
            message: `Laporan ${c.complaintNumber} telah melewati batas waktu penyelesaian.`,
            complaintId: doc.id,
            isRead: false,
            createdAt: nowIso,
          })
        )
      );
      if (c.currentOfficerId) {
        await adminDb.collection("notifications").add({
          userId: c.currentOfficerId,
          role: "petugas",
          title: "Melebihi batas waktu",
          message: `Laporan ${c.complaintNumber} sudah melewati batas waktu. Mohon segera ditindaklanjuti.`,
          complaintId: doc.id,
          isRead: false,
          createdAt: nowIso,
        });
      }
      overdue++;
      continue;
    }

    // Deadline approaching (<=24h) and not yet warned.
    if (
      deadlineMs >= now &&
      deadlineMs - now <= WARN_WINDOW_MS &&
      !c.deadlineWarnedAt
    ) {
      await doc.ref.update({ deadlineWarnedAt: nowIso });

      if (c.currentOfficerId) {
        await adminDb.collection("notifications").add({
          userId: c.currentOfficerId,
          role: "petugas",
          title: "Deadline mendekat",
          message: `Laporan ${c.complaintNumber} jatuh tempo dalam 24 jam.`,
          complaintId: doc.id,
          isRead: false,
          createdAt: nowIso,
        });
      }
      await Promise.all(
        admins.docs.map((a) =>
          adminDb.collection("notifications").add({
            userId: a.id,
            role: "admin",
            title: "Deadline hampir habis",
            message: `Laporan ${c.complaintNumber} jatuh tempo dalam 24 jam.`,
            complaintId: doc.id,
            isRead: false,
            createdAt: nowIso,
          })
        )
      );
      warned++;
    }
  }

  await writeAuditLog({
    userId: "system",
    role: "admin",
    action: "sla_check_dijalankan",
    targetType: "system",
    metadata: { checked: snap.size, warned, overdue },
  });

  return NextResponse.json({ checked: snap.size, warned, overdue });
}
