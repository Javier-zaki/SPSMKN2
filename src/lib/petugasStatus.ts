import type { ComplaintStatus } from "@/lib/types";

/** Reports still active in this petugas's queue (not yet off their plate). */
export const PETUGAS_ACTIVE_STATUS: ComplaintStatus[] = [
  "diteruskan",
  "diterima_petugas",
  "sedang_ditangani",
  "menunggu_konfirmasi",
];

/** Reports that have left the petugas's active queue one way or another. */
export const PETUGAS_HISTORY_STATUS: ComplaintStatus[] = [
  "selesai",
  "dikembalikan",
  "dieskalasikan",
];
