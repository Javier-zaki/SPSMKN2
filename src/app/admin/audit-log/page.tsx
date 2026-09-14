"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/form-fields";
import { Badge } from "@/components/ui/badge";
import { formatDateTimeShortID } from "@/lib/utils";
import type { AuditLogEntry, Role } from "@/lib/types";

const ROLE_LABEL: Record<Role, string> = {
  admin: "Admin",
  petugas: "Petugas",
  siswa: "Siswa",
};

const TARGET_LABEL: Record<AuditLogEntry["targetType"], string> = {
  complaint: "Laporan",
  user: "Pengguna",
  unit: "Unit",
  category: "Kategori",
  system: "Sistem",
};

export default function AuditLogPage() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [roleFilter, setRoleFilter] = useState("");
  const [targetFilter, setTargetFilter] = useState("");

  useEffect(() => {
    // Audit log is append-only and server-written (see firestore.rules);
    // this view is strictly read-only for admins.
    const q = query(
      collection(db, "audit_logs"),
      orderBy("createdAt", "desc"),
      limit(200)
    );
    return onSnapshot(q, (snap) => {
      setEntries(
        snap.docs.map((d) => ({ ...(d.data() as AuditLogEntry), id: d.id }))
      );
    });
  }, []);

  const filtered = useMemo(
    () =>
      entries.filter((e) => {
        if (roleFilter && e.role !== roleFilter) return false;
        if (targetFilter && e.targetType !== targetFilter) return false;
        return true;
      }),
    [entries, roleFilter, targetFilter]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <Select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="sm:max-w-[180px]"
        >
          <option value="">Semua peran</option>
          {Object.entries(ROLE_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Select
          value={targetFilter}
          onChange={(e) => setTargetFilter(e.target.value)}
          className="sm:max-w-[200px]"
        >
          <option value="">Semua jenis target</option>
          {Object.entries(TARGET_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </div>

      <Card>
        <CardContent className="divide-y divide-border p-0">
          {filtered.length === 0 ? (
            <p className="p-6 text-center text-sm text-ink-muted">
              Belum ada aktivitas yang tercatat.
            </p>
          ) : (
            filtered.map((e) => (
              <div key={e.id} className="flex items-start justify-between gap-4 p-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">
                    {humanizeAction(e.action)}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {TARGET_LABEL[e.targetType]}
                    {e.targetId ? ` · ${e.targetId}` : ""}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <Badge variant="neutral">{ROLE_LABEL[e.role]}</Badge>
                  <p className="mt-1 text-xs text-ink-muted">
                    {formatDateTimeShortID(e.createdAt)}
                  </p>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function humanizeAction(action: string): string {
  return action.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}
