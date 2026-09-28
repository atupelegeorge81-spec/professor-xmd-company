import { cn } from "../lib/cn";

export type TypingDotsProps = {
  size?: number | undefined;
  className?: string | undefined;
  label?: string | undefined;
};

/** Three bouncing dots — the classic "assistant is typing" indicator. */
export function TypingDots({ size = 4, className, label = "Assistant is typing" }: TypingDotsProps) {
  return (
    <span
      role="status"
      aria-label={label}
      className={cn("inline-flex items-end gap-1 align-middle", className)}
    >
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className="inline-block rounded-full bg-current"
          style={{
            width: size,
            height: size,
            animation: `px-dot-bounce 1.1s ${index * 0.15}s ease-in-out infinite`,
          }}
        />
      ))}
    </span>
  );
}
