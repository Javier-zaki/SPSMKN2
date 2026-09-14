// ---------------------------------------------------------------------------
// SPSMKN2 — Core data model
// Mirrors the Firestore collections described in the project spec:
// users, units, categories, complaints, complaint_assignments,
// complaint_history, complaint_comments, notifications, audit_logs
// ---------------------------------------------------------------------------

export type Role = "siswa" | "admin" | "petugas";

export interface BaseUser {
  uid: string;
  role: Role;
  name: string;
  email: string;
  photoURL?: string | null;
  isActive: boolean;
  mustChangePassword?: boolean;
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

export interface StudentUser extends BaseUser {
  role: "siswa";
  nis: string;
  className: string;
}

export interface AdminUser extends BaseUser {
  role: "admin";
  canViewAnonymousIdentity: boolean;
}

export interface OfficerUser extends BaseUser {
  role: "petugas";
  unitId: string;
  position?: string; // e.g. "Kepala Unit", "Staf"
}

export type AppUser = StudentUser | AdminUser | OfficerUser;

export interface Unit {
  id: string;
  name: string; // e.g. "Sarana & Prasarana"
  description?: string;
  isActive: boolean;
  createdAt: string;
}

export interface Category {
  id: string;
  name: string; // e.g. "Fasilitas", "Bullying", "Akademik"
  description?: string;
  defaultUnitId?: string; // suggested routing
  isActive: boolean;
}

export type ComplaintPriority = "rendah" | "normal" | "tinggi" | "mendesak";

export type ComplaintStatus =
  | "diajukan"
  | "diverifikasi"
  | "diteruskan"
  | "diterima_petugas"
  | "sedang_ditangani"
  | "menunggu_konfirmasi"
  | "selesai"
  | "ditolak"
  | "dikembalikan"
  | "dieskalasikan"
  | "ditunda";

export interface Complaint {
  id: string;
  complaintNumber: string; // PGD-YYYYMMDD-NNN
  studentUid: string; // always stored, even if anonymous
  categoryId: string;
  title: string;
  description: string;
  location: string;
  incidentDate: string; // ISO date
  isAnonymous: boolean;
  priority: ComplaintPriority;
  status: ComplaintStatus;
  currentUnitId: string | null;
  currentOfficerId: string | null;
  // Denormalized display names, written by the server whenever disposisi
  // happens. Kept alongside the ids so siswa/petugas can render "who has
  // this" without needing cross-role reads into other users' profiles
  // (which firestore.rules deliberately does not allow).
  currentUnitName: string | null;
  currentOfficerName: string | null;
  categoryName: string;
  deadline: string | null; // ISO date
  // Set once each reminder has fired so the SLA cron job never notifies
  // twice for the same threshold (see /api/cron/sla-check).
  deadlineWarnedAt: string | null;
  deadlineOverdueNotifiedAt: string | null;
  attachmentUrls: string[];
  publicResponse: string | null; // visible to student
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  verifiedAt: string | null;
  verifiedBy: string | null;
}

export interface ComplaintAssignment {
  id: string;
  complaintId: string;
  fromUserId: string;
  toUserId: string | null;
  unitId: string;
  instruction: string;
  priority: ComplaintPriority;
  deadline: string | null;
  assignedAt: string;
  acceptedAt: string | null;
  completedAt: string | null;
  status: "menunggu" | "diterima" | "selesai" | "dikembalikan" | "dieskalasikan";
}

export interface ComplaintHistoryEntry {
  id: string;
  complaintId: string;
  action: string; // e.g. "diverifikasi", "diteruskan", "eskalasi", "ditutup"
  fromStatus: ComplaintStatus | null;
  toStatus: ComplaintStatus | null;
  fromUserId: string | null;
  toUserId: string | null;
  note: string | null;
  createdAt: string;
}

export interface ComplaintComment {
  id: string;
  complaintId: string;
  authorUid: string;
  authorRole: Role;
  visibility: "pelapor" | "internal"; // internal notes never shown to siswa
  message: string;
  createdAt: string;
}

export interface EscalationRecord {
  id: string;
  complaintId: string;
  fromUserId: string;
  toUserId: string;
  reason: string;
  note: string | null;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  role: Role;
  title: string;
  message: string;
  complaintId: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  userId: string;
  role: Role;
  action: string;
  targetType: "complaint" | "user" | "unit" | "category" | "system";
  targetId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  ip?: string;
}

export const STATUS_LABEL: Record<ComplaintStatus, string> = {
  diajukan: "Diajukan",
  diverifikasi: "Diverifikasi",
  diteruskan: "Diteruskan",
  diterima_petugas: "Diterima Petugas",
  sedang_ditangani: "Sedang Ditangani",
  menunggu_konfirmasi: "Menunggu Konfirmasi",
  selesai: "Selesai",
  ditolak: "Ditolak",
  dikembalikan: "Dikembalikan",
  dieskalasikan: "Dieskalasikan",
  ditunda: "Ditunda",
};

export const PRIORITY_LABEL: Record<ComplaintPriority, string> = {
  rendah: "Rendah",
  normal: "Normal",
  tinggi: "Tinggi",
  mendesak: "Mendesak",
};
