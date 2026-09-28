import { cn } from "../lib/cn";

export type StreamingCaretProps = {
  className?: string | undefined;
  /** Block caret instead of a thin bar. */
  block?: boolean | undefined;
};

/** Blinking caret appended to text while tokens are still streaming. */
export function StreamingCaret({ className, block = false }: StreamingCaretProps) {
  return (
    <span
      aria-hidden
      className={cn(
        "ml-0.5 inline-block translate-y-[1px] rounded-[1px] bg-current align-baseline",
        block ? "h-[1em] w-[0.5em]" : "h-[1em] w-[2px]",
        className,
      )}
      style={{ animation: "px-caret 1s steps(1) infinite" }}
    />
  );
}
