import { useMemo } from "react";
import { motion } from "motion/react";
import { cn } from "../lib/cn";
import { useTypewriter } from "../lib/hooks";
import { StreamingCaret } from "../primitives/StreamingCaret";

export type StreamingMarkdownProps = {
  /** Plain text or light markdown (`**bold**`, `` `code` ``, `- item`, `# head`). */
  text: string;
  streaming?: boolean | undefined;
  charsPerSecond?: number | undefined;
  className?: string | undefined;
};

type Line = { key: string; kind: "h" | "li" | "p"; content: string };

function parse(text: string): Line[] {
  return text.split("\n").map((raw, index) => {
    const line = raw.trimEnd();
    if (line.startsWith("#")) return { key: `${index}`, kind: "h", content: line.replace(/^#+\s*/, "") };
    if (/^[-*]\s+/.test(line)) return { key: `${index}`, kind: "li", content: line.replace(/^[-*]\s+/, "") };
    return { key: `${index}`, kind: "p", content: line };
  });
}

function renderInline(content: string) {
  const parts = content.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**"))
      return (
        <strong key={index} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    if (part.startsWith("`") && part.endsWith("`"))
      return (
        <code key={index} className="rounded bg-px-surface-2 px-1 py-0.5 font-mono text-[0.92em]">
          {part.slice(1, -1)}
        </code>
      );
    return <span key={index}>{part}</span>;
  });
}

/** Assistant answer that streams token by token and renders light markdown live. */
export function StreamingMarkdown({
  text,
  streaming = false,
  charsPerSecond = 90,
  className,
}: StreamingMarkdownProps) {
  const shown = useTypewriter(text, streaming, charsPerSecond);
  const value = streaming ? shown : text;
  const lines = useMemo(() => parse(value), [value]);

  return (
    <div className={cn("text-[13.5px] leading-relaxed", className)} aria-live="polite">
      {lines.map((line, index) => (
        <motion.div
          key={line.key}
          initial={{ opacity: 0, y: 3 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
          className={cn(
            line.kind === "h" && "mt-2 mb-1 text-[15px] font-semibold",
            line.kind === "li" && "ml-4 list-item list-disc",
            line.kind === "p" && "mb-1",
          )}
        >
          {renderInline(line.content)}
          {streaming && index === lines.length - 1 && <StreamingCaret className="text-px-accent" />}
        </motion.div>
      ))}
    </div>
  );
}
