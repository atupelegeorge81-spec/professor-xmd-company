import { motion } from "motion/react";
import { IconFile, IconFolder } from "@tabler/icons-react";
import { cn } from "../lib/cn";
import { useStaggeredReveal } from "../lib/hooks";

export type FileNode = {
  id: string;
  name: string;
  depth: number;
  kind: "file" | "folder";
  /** Marks the file the agent just touched. */
  highlight?: boolean | undefined;
};

export type FileTreeRevealProps = {
  nodes: FileNode[];
  /** While true nodes appear one by one. */
  scanning?: boolean | undefined;
  className?: string | undefined;
};

/** Workspace tree that reveals row by row while the agent explores it. */
export function FileTreeReveal({ nodes, scanning = true, className }: FileTreeRevealProps) {
  const shown = useStaggeredReveal(nodes, scanning, 80);
  return (
    <ul className={cn("rounded-px border border-px-border bg-px-bg py-1", className)}>
      {shown.map((node) => (
        <motion.li
          key={node.id}
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.18 }}
          className={cn(
            "flex items-center gap-1.5 px-2 py-0.5 font-mono text-[11.5px]",
            node.highlight ? "text-px-accent" : "text-px-fg-muted",
          )}
          style={{ paddingLeft: 8 + node.depth * 14 }}
        >
          {node.kind === "folder" ? (
            <IconFolder size={12} className="shrink-0" />
          ) : (
            <IconFile size={12} className="shrink-0" />
          )}
          <span className="truncate">{node.name}</span>
        </motion.li>
      ))}
    </ul>
  );
}
