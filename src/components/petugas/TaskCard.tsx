import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge, PriorityDot } from "@/components/ui/badge";
import { formatDateID } from "@/lib/utils";
import type { Complaint } from "@/lib/types";

export function TaskCard({ c }: { c: Complaint }) {
  const overdue =
    c.deadline &&
    new Date(c.deadline).getTime() < Date.now() &&
    !["selesai", "ditolak"].includes(c.status);

  return (
    <Link href={`/petugas/tugas/${c.id}`}>
      <Card className="transition-colors hover:border-brand">
        <CardContent className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <PriorityDot priority={c.priority} />
              <span className="font-display text-sm font-semibold text-ink">
                {c.complaintNumber}
              </span>
            </div>
            <p className="mt-1 truncate text-sm font-medium text-ink">{c.title}</p>
            <p className="mt-1 text-xs text-ink-muted">
              {c.categoryName} · {c.location}
            </p>
            {c.deadline && (
              <p className={`mt-1 text-xs ${overdue ? "font-medium text-danger" : "text-ink-muted"}`}>
                {overdue ? "⚠️ Melebihi batas waktu: " : "Batas waktu: "}
                {formatDateID(c.deadline)}
              </p>
            )}
          </div>
          <StatusBadge status={c.status} />
        </CardContent>
      </Card>
    </Link>
  );
}
