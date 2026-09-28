import { motion } from "motion/react";
import { IconCheck, IconListCheck } from "@tabler/icons-react";
import { cn } from "../lib/cn";
import { ProgressBar } from "../primitives/ProgressBar";
import { ShimmerText } from "../primitives/ShimmerText";

export type TodoItem = {
  id: string;
  title: string;
  state: "todo" | "doing" | "done";
};

export type TodoListCardProps = {
  items: TodoItem[];
  title?: string | undefined;
  className?: string | undefined;
};

/**
 * Live to-do list (Cursor plan-mode todos / Claude Code task list).
 * Checkboxes fill with a spring, completed titles strike through, and the
 * header progress bar advances as items settle.
 */
export function TodoListCard({ items, title = "Tasks", className }: TodoListCardProps) {
  const done = items.filter((item) => item.state === "done").length;
  return (
    <section
      className={cn("w-full rounded-px-lg border border-px-border bg-px-surface p-3", className)}
      aria-label={title}
    >
      <header className="mb-2 flex items-center gap-2 text-[13px] font-medium">
        <IconListCheck size={14} className="text-px-fg-muted" />
        {title}
        <span className="ml-auto text-[11px] tabular-nums text-px-fg-subtle">
          {done}/{items.length}
        </span>
      </header>

      <ProgressBar value={items.length ? done / items.length : 0} tone={done === items.length ? "success" : "accent"} />

      <ul className="mt-2.5 flex flex-col gap-1.5">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-2 text-[12.5px]">
            <motion.span
              initial={false}
              animate={{
                backgroundColor:
                  item.state === "done" ? "var(--px-success)" : "rgba(0,0,0,0)",
                borderColor:
                  item.state === "done"
                    ? "var(--px-success)"
                    : item.state === "doing"
                      ? "var(--px-accent)"
                      : "var(--px-border-strong)",
                scale: item.state === "done" ? [1, 1.2, 1] : 1,
              }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="flex size-4 shrink-0 items-center justify-center rounded-[5px] border"
            >
              {item.state === "done" && <IconCheck size={11} stroke={3} className="text-white dark:text-black" />}
            </motion.span>
            <span
              className={cn(
                item.state === "done" && "text-px-fg-subtle line-through",
                item.state === "todo" && "text-px-fg-muted",
              )}
            >
              <ShimmerText active={item.state === "doing"}>{item.title}</ShimmerText>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
