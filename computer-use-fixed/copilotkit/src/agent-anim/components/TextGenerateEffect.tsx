import { useMemo } from "react";
import { motion } from "motion/react";
import { cn } from "../lib/cn";

export type TextGenerateEffectProps = {
  text: string;
  /** Seconds between word reveals. */
  stagger?: number | undefined;
  /** Blur the words in as they appear. */
  blur?: boolean | undefined;
  className?: string | undefined;
};

/** Word-by-word fade/blur-in reveal for finished answers and headlines. */
export function TextGenerateEffect({
  text,
  stagger = 0.045,
  blur = true,
  className,
}: TextGenerateEffectProps) {
  const words = useMemo(() => text.split(" "), [text]);
  return (
    <p className={cn("text-[13.5px] leading-relaxed", className)}>
      {words.map((word, index) => (
        <motion.span
          key={`${word}-${index}`}
          initial={{ opacity: 0, filter: blur ? "blur(6px)" : "blur(0px)", y: 3 }}
          animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
          transition={{ duration: 0.4, delay: index * stagger, ease: [0.22, 1, 0.36, 1] }}
          className="inline-block whitespace-pre"
        >
          {word}{" "}
        </motion.span>
      ))}
    </p>
  );
}
