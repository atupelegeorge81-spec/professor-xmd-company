import { motion } from "motion/react";
import { cn } from "../lib/cn";

export type TabItem = { id: string; label: string; badge?: string | number };

export type TabSwitcherProps = {
  tabs: TabItem[];
  active: string;
  onChange: (id: string) => void;
  className?: string | undefined;
  /** Unique id so several switchers can coexist on one page. */
  layoutId?: string | undefined;
};

/** Tabs with a shared-layout indicator that slides between items. */
export function TabSwitcher({ tabs, active, onChange, className, layoutId = "px-tab" }: TabSwitcherProps) {
  return (
    <div role="tablist" className={cn("flex items-center gap-1 border-b border-px-border", className)}>
      {tabs.map((tab) => {
        const selected = tab.id === active;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={selected}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              "relative px-2.5 py-1.5 text-[12.5px] transition-colors",
              selected ? "text-px-fg" : "text-px-fg-muted hover:text-px-fg",
            )}
          >
            {tab.label}
            {tab.badge !== undefined && (
              <span className="ml-1.5 rounded-full bg-px-surface-2 px-1.5 py-0.5 text-[10px] tabular-nums">
                {tab.badge}
              </span>
            )}
            {selected && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-x-1 -bottom-px h-0.5 rounded-full bg-px-accent"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
