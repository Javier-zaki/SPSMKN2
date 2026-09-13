import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">
          {eyebrow}
        </p>
        <h1 className="mt-1 font-display text-3xl font-bold leading-tight text-ink">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-muted">
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
