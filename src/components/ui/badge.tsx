import type { HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { STATUS_LABEL, type ComplaintStatus } from "@/lib/types";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
  {
    variants: {
      variant: {
        neutral: "bg-status-diajukan-bg text-status-diajukan-text",
        brand: "bg-brand-soft text-brand-strong",
        progress: "bg-status-progress-bg text-status-progress-text",
        waiting: "bg-status-waiting-bg text-status-waiting-text",
        info: "bg-status-info-bg text-status-info-text",
        success: "bg-status-success-bg text-status-success-text",
        danger: "bg-status-danger-bg text-status-danger-text",
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

/** Colored dot + label matching the brief's priority colors. */
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
 * Status pill — each state gets its own hue (not one accent color shaded
 * differently), so status reads at a glance in a list: amber while it's
 * moving, coral while it's waiting on someone, violet once verified,
 * mint once done, gray/red for the terminal "didn't proceed" states.
 */
export function StatusBadge({ status }: { status: ComplaintStatus }) {
  const variant: BadgeProps["variant"] = {
    diajukan: "neutral",
    diverifikasi: "info",
    diteruskan: "progress",
    diterima_petugas: "progress",
    sedang_ditangani: "progress",
    menunggu_konfirmasi: "waiting",
    selesai: "success",
    ditolak: "danger",
    dikembalikan: "danger",
    dieskalasikan: "waiting",
    ditunda: "neutral",
  }[status] as BadgeProps["variant"];

  return <Badge variant={variant}>{STATUS_LABEL[status]}</Badge>;
}
