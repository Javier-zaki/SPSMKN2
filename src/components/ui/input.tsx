import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "focus-ring flex h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-ink placeholder:text-ink-muted disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm",
      className
    )}
    {...props}
  />
));
Input.displayName = "Input";
