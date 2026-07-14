import { HTMLAttributes } from "react";
import clsx from "clsx";

export function Card({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx("rounded-md border border-steel-hairline bg-paper-raised shadow-panel", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("animate-pulse rounded bg-steel-hairline/70", className)} />;
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <div className="mb-2 h-10 w-10 rounded-full border-2 border-dashed border-steel-hairline" />
      <h3 className="font-display text-base font-medium text-ink">{title}</h3>
      <p className="max-w-xs text-sm text-steel">{description}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
