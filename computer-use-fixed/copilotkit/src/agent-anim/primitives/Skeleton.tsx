import { cn } from "../lib/cn";

export type SkeletonProps = {
  className?: string | undefined;
  /** Rounded pill shape for text lines. */
  rounded?: boolean | undefined;
  /** Explicit width, e.g. "82%". */
  width?: string | undefined;
};

/** Shimmering placeholder block. */
export function Skeleton({ className, rounded = true, width }: SkeletonProps) {
  return (
    <span
      aria-hidden
      style={width ? { width } : undefined}
      className={cn(
        "px-skeleton-bg block h-3 w-full",
        rounded ? "rounded-full" : "rounded-px",
        className,
      )}
    />
  );
}

export type SkeletonMessageProps = {
  lines?: number | undefined;
  className?: string | undefined;
};

/** Multi-line skeleton shown before the first assistant token arrives. */
export function SkeletonMessage({ lines = 3, className }: SkeletonMessageProps) {
  const widths = ["100%", "92%", "76%", "84%", "64%"];
  return (
    <div
      className={cn("flex w-full flex-col gap-2", className)}
      aria-label="Loading response"
      role="status"
    >
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton key={index} width={widths[index % widths.length]} />
      ))}
    </div>
  );
}
