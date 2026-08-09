import { ButtonHTMLAttributes, forwardRef } from "react";
import clsx from "clsx";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", isLoading, className, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={clsx(
          "inline-flex items-center justify-center gap-2 rounded font-body font-medium transition-colors",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          size === "md" ? "px-4 py-2 text-sm" : "px-3 py-1.5 text-xs",
          variant === "primary" && "bg-brass text-white hover:bg-brass-dark",
          variant === "secondary" && "bg-white text-ink border border-steel-hairline hover:bg-paper",
          variant === "ghost" && "bg-transparent text-steel hover:bg-paper",
          variant === "danger" && "bg-signal-red text-white hover:bg-signal-red/90",
          className
        )}
        {...props}
      >
        {isLoading && (
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
        )}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
