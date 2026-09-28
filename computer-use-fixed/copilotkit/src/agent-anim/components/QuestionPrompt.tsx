import { useState } from "react";
import { motion } from "motion/react";
import { IconHelpCircle } from "@tabler/icons-react";
import { cn } from "../lib/cn";

export type QuestionOption = {
  id: string;
  label: string;
  description?: string | undefined;
};

export type QuestionPromptProps = {
  question: string;
  options: QuestionOption[];
  /** Pre-selected answer id; when set the card renders in answered state. */
  answeredId?: string | undefined;
  onAnswer?: ((id: string) => void) | undefined;
  className?: string | undefined;
};

/**
 * Clarifying-question card. Options stagger in, the chosen one springs to the
 * accent state and the rest fade back.
 */
export function QuestionPrompt({
  question,
  options,
  answeredId,
  onAnswer,
  className,
}: QuestionPromptProps) {
  const [selected, setSelected] = useState<string | undefined>(answeredId);
  const answered = selected ?? answeredId;

  return (
    <section
      className={cn("w-full rounded-px-lg border border-px-border bg-px-surface p-3", className)}
      aria-label="Clarifying question"
    >
      <p className="flex items-start gap-2 text-[13px] font-medium">
        <IconHelpCircle size={14} className="mt-0.5 shrink-0 text-px-accent" />
        {question}
      </p>
      <div className="mt-2.5 flex flex-col gap-1.5">
        {options.map((option, index) => {
          const isChosen = answered === option.id;
          return (
            <motion.button
              key={option.id}
              type="button"
              initial={{ opacity: 0, y: 5 }}
              animate={{
                opacity: answered && !isChosen ? 0.45 : 1,
                y: 0,
                scale: isChosen ? 1.01 : 1,
              }}
              transition={{ duration: 0.22, delay: index * 0.05 }}
              disabled={Boolean(answered)}
              onClick={() => {
                setSelected(option.id);
                onAnswer?.(option.id);
              }}
              className={cn(
                "rounded-px border px-2.5 py-1.5 text-left text-[12.5px] transition-colors",
                isChosen
                  ? "border-px-accent bg-px-accent-soft text-px-accent"
                  : "border-px-border bg-px-bg hover:border-px-border-strong hover:bg-px-surface-2",
              )}
            >
              <span className="font-medium">{option.label}</span>
              {option.description && (
                <span className="block text-[11.5px] text-px-fg-muted">{option.description}</span>
              )}
            </motion.button>
          );
        })}
      </div>
    </section>
  );
}
