import type { HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { STATUS_LABEL, type ComplaintStatus } from "@/lib/types";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
  {
    variants: {
      variant: {
        neutral: "bg-brand-soft text-brand-strong",
        // Generic semantic pair for non-complaint contexts (active/inactive
        // toggles for accounts, units, categories) — reuses the same green
        // and soft-red pastels as the "selesai"/"ditolak" status pills.
        success: "bg-status-selesai-bg text-status-selesai-text",
        danger: "bg-status-ditolak-bg text-status-ditolak-text",
        // 11 distinct hues, one per complaint status — see globals.css
        diajukan: "bg-status-diajukan-bg text-status-diajukan-text",
        diverifikasi: "bg-status-diverifikasi-bg text-status-diverifikasi-text",
        diteruskan: "bg-status-diteruskan-bg text-status-diteruskan-text",
        diterima: "bg-status-diterima-bg text-status-diterima-text",
        ditangani: "bg-status-ditangani-bg text-status-ditangani-text",
        menunggu: "bg-status-menunggu-bg text-status-menunggu-text",
        selesai: "bg-status-selesai-bg text-status-selesai-text",
        ditolak: "bg-status-ditolak-bg text-status-ditolak-text",
        dikembalikan: "bg-status-dikembalikan-bg text-status-dikembalikan-text",
        dieskalasikan: "bg-status-dieskalasikan-bg text-status-dieskalasikan-text",
        ditunda: "bg-status-ditunda-bg text-status-ditunda-text",
      },
    },
    defaultVariants: { variant: "neutral" },
  }
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

/** Colored dot matching the brief's priority colors (green/blue/orange/red). */
export function PriorityDot({
  priority,
}: {
  priority: "rendah" | "normal" | "tinggi" | "mendesak";
}) {
  const color = {
    rendah: "bg-priority-low",
    normal: "bg-priority-normal",
    tinggi: "bg-priority-high",
    mendesak: "bg-priority-urgent",
  }[priority];
  return <span className={cn("h-2 w-2 rounded-full", color)} />;
}

/**
 * Status pill — each of the 11 states gets its own hue, not a shared
 * accent shaded differently, so status is scannable at a glance down a
 * long list: blue-gray while unverified, blue once checked, teal while
 * routed, saffron while actively worked, soft orange while waiting on the
 * student, green once done, coral/red/purple/gray for the various
 * "didn't proceed straight through" outcomes.
 */
export function StatusBadge({ status }: { status: ComplaintStatus }) {
  const variant: BadgeProps["variant"] = {
    diajukan: "diajukan",
    diverifikasi: "diverifikasi",
    diteruskan: "diteruskan",
    diterima_petugas: "diterima",
    sedang_ditangani: "ditangani",
    menunggu_konfirmasi: "menunggu",
    selesai: "selesai",
    ditolak: "ditolak",
    dikembalikan: "dikembalikan",
    dieskalasikan: "dieskalasikan",
    ditunda: "ditunda",
  }[status] as BadgeProps["variant"];

  return <Badge variant={variant}>{STATUS_LABEL[status]}</Badge>;
}
