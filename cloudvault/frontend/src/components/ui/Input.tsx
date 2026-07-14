import { InputHTMLAttributes, forwardRef } from "react";
import clsx from "clsx";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({ label, error, className, id, ...props }, ref) => {
  const inputId = id ?? props.name;
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-xs font-medium text-steel">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className={clsx(
          "rounded border bg-white px-3 py-2 text-sm text-ink placeholder:text-steel-soft",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-brass",
          error ? "border-signal-red" : "border-steel-hairline",
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-signal-red">{error}</p>}
    </div>
  );
});
Input.displayName = "Input";
