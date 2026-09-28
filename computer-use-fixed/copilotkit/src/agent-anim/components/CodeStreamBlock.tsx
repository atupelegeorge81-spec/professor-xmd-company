import { useMemo } from "react";
import { IconCode } from "@tabler/icons-react";
import { cn } from "../lib/cn";
import { tokenize, TOKEN_CLASS } from "../lib/highlight";
import { useTypewriter } from "../lib/hooks";
import { StreamingCaret } from "../primitives/StreamingCaret";
import { ShimmerText } from "../primitives/ShimmerText";

export type CodeStreamBlockProps = {
  code: string;
  language?: string | undefined;
  filename?: string | undefined;
  /** While true the code types itself in and a caret blinks. */
  streaming?: boolean | undefined;
  charsPerSecond?: number | undefined;
  className?: string | undefined;
};

/** Code block that streams in with lightweight syntax highlighting. */
export function CodeStreamBlock({
  code,
  language = "ts",
  filename,
  streaming = false,
  charsPerSecond = 140,
  className,
}: CodeStreamBlockProps) {
  const shown = useTypewriter(code, streaming, charsPerSecond);
  const text = streaming ? shown : code;
  const tokens = useMemo(() => tokenize(text), [text]);

  return (
    <div className={cn("overflow-hidden rounded-px border border-px-border", className)}>
      <div className="flex items-center gap-2 bg-px-surface px-2.5 py-1.5 text-[11.5px] text-px-fg-muted">
        <IconCode size={12} />
        <span className="font-mono">{filename ?? language}</span>
        {streaming && (
          <span className="ml-auto text-[11px]">
            <ShimmerText>Writing</ShimmerText>
          </span>
        )}
      </div>
      <pre className="max-h-64 overflow-auto bg-px-code-bg px-3 py-2 font-mono text-[11.5px] leading-[1.55]">
        <code>
          {tokens.map((token, index) => (
            <span key={index} className={TOKEN_CLASS[token.kind]}>
              {token.value}
            </span>
          ))}
          {streaming && <StreamingCaret className="text-px-code-fg" />}
        </code>
      </pre>
    </div>
  );
}
