import { useEffect, useRef } from "react";
import type { Agent } from "@/lib/agents";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  busy: boolean;
  agent?: Agent;
}

export function Composer({ value, onChange, onSubmit, busy, agent }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);

  return (
    <div className="shrink-0 px-3 pb-3 pt-1">
      <div className="mx-auto max-w-3xl">
        <div className="glass-strong flex items-end gap-2 rounded-[26px] p-2 transition-shadow focus-within:ring-signal">
          <textarea
            ref={ref}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSubmit();
              }
            }}
            rows={1}
            placeholder={busy ? `${agent?.name ?? "Agent"} is working…` : `Message ${agent?.name ?? "the agent"}…`}
            className="scroll-thin max-h-40 min-h-[40px] flex-1 resize-none bg-transparent px-3 py-2 text-[14px] leading-6 text-foreground outline-none placeholder:text-muted-foreground"
          />
          <button
            onClick={onSubmit}
            disabled={busy || !value.trim()}
            aria-label="Send"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-signal text-primary-foreground transition-transform duration-200 hover:scale-105 active:scale-95 disabled:opacity-35 disabled:hover:scale-100"
          >
            {busy ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current" />
            ) : (
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 19V5" />
                <path d="m5 12 7-7 7 7" />
              </svg>
            )}
          </button>
        </div>
        <p className="mt-1.5 text-center text-[10px] tracking-wide text-muted-foreground">
          Enter to send · Shift + Enter for a new line
        </p>
      </div>
    </div>
  );
}
