import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "focus-ring inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        cta: "bg-cta text-cta-ink hover:bg-cta-strong",
        primary: "bg-brand text-white hover:bg-brand-strong",
        secondary:
          "bg-surface text-ink border border-border hover:bg-brand-soft",
        ghost: "text-ink hover:bg-brand-soft",
        danger: "bg-danger text-white hover:opacity-90",
        link: "rounded-none text-brand underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-8 px-3.5",
        md: "h-10 px-5",
        lg: "h-12 px-6 text-base",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  )
);
Button.displayName = "Button";
