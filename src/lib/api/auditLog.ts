import { adminDb } from "@/lib/firebase/admin";
import type { Role } from "@/lib/types";

export async function writeAuditLog(entry: {
  userId: string;
  role: Role;
  action: string;
  targetType: "complaint" | "user" | "unit" | "category" | "system";
  targetId?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  await adminDb.collection("audit_logs").add({
    userId: entry.userId,
    role: entry.role,
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId ?? null,
    metadata: entry.metadata ?? null,
    createdAt: new Date().toISOString(),
  });
}
