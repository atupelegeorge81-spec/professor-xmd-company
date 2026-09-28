import { AnimatePresence, motion } from "motion/react";
import { IconCamera } from "@tabler/icons-react";
import { ToolRow } from "../primitives/ToolRow";
import type { ToolCardBaseProps } from "../types";
import { isRunning } from "../types";

export type ScreenshotCardProps = ToolCardBaseProps & {
  /** Image shown after the capture completes. */
  imageUrl?: string | undefined;
  caption?: string | undefined;
};

/**
 * "Taking screenshot" -> "Captured screenshot".
 * While running, a scan line sweeps a framed placeholder; on completion a
 * white flash fires once and the image scales in.
 */
export function ScreenshotCard({
  status,
  imageUrl,
  caption = "Sandbox desktop",
  durationMs,
  startedAt,
  className,
  defaultExpanded = true,
}: ScreenshotCardProps) {
  const running = isRunning(status);
  return (
    <ToolRow
      status={status}
      icon={<IconCamera size={13} />}
      activeLabel="Taking screenshot"
      label="Captured screenshot"
      detail={caption}
      durationMs={durationMs}
      startedAt={startedAt}
      className={className}
      defaultExpanded={defaultExpanded}
    >
      <div className="relative overflow-hidden rounded-px border border-px-border bg-px-surface">
        {running ? (
          <div className="relative h-32">
            <span className="px-skeleton-bg absolute inset-0" />
            <span
              className="absolute inset-x-0 h-8 bg-gradient-to-b from-transparent via-[var(--px-accent-soft)] to-transparent"
              style={{ animation: "px-scan 1.5s linear infinite" }}
            />
          </div>
        ) : (
          <AnimatePresence>
            <motion.div key="shot" className="relative">
              {imageUrl && (
                <motion.img
                  src={imageUrl}
                  alt={caption}
                  initial={{ opacity: 0, scale: 1.03 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  className="block max-h-64 w-full object-cover object-top"
                  loading="lazy"
                />
              )}
              <span
                className="pointer-events-none absolute inset-0 bg-white"
                style={{ animation: "px-flash 600ms ease-out 1 both" }}
              />
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </ToolRow>
  );
}
