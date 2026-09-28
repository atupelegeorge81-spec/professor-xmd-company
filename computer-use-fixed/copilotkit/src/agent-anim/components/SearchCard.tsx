import { motion } from "motion/react";
import { IconFileSearch, IconSearch, IconWorldSearch } from "@tabler/icons-react";
import { ToolRow } from "../primitives/ToolRow";
import { cn } from "../lib/cn";
import { hostname } from "../lib/format";
import type { ToolCardBaseProps } from "../types";
import { isRunning } from "../types";

export type SearchKind = "web" | "code" | "files";

export type SearchResult = {
  id: string;
  title: string;
  /** URL for web results, path for code/file results. */
  location: string;
  snippet?: string | undefined;
};

export type SearchCardProps = ToolCardBaseProps & {
  kind?: SearchKind | undefined;
  query: string;
  results?: SearchResult[] | undefined;
};

const KIND_META: Record<SearchKind, { icon: typeof IconSearch; active: string; done: string }> = {
  web: { icon: IconWorldSearch, active: "Searching the web", done: "Searched the web" },
  code: { icon: IconSearch, active: "Searching codebase", done: "Searched codebase" },
  files: { icon: IconFileSearch, active: "Searching files", done: "Searched files" },
};

/**
 * "Searching …" -> "Searched …" with a result count badge; results fade and
 * slide in one after another when the observation arrives.
 */
export function SearchCard({
  status,
  kind = "web",
  query,
  results = [],
  durationMs,
  startedAt,
  className,
  defaultExpanded,
}: SearchCardProps) {
  const running = isRunning(status);
  const meta = KIND_META[kind];
  const Icon = meta.icon;

  return (
    <ToolRow
      status={status}
      icon={<Icon size={13} />}
      activeLabel={meta.active}
      label={meta.done}
      detail={<span className="italic">“{query}”</span>}
      trailing={
        !running ? (
          <span className="rounded-full bg-px-surface-2 px-1.5 py-0.5 text-[10.5px] tabular-nums text-px-fg-muted">
            {results.length} results
          </span>
        ) : null
      }
      durationMs={durationMs}
      startedAt={startedAt}
      className={className}
      defaultExpanded={defaultExpanded}
    >
      <ul className="flex flex-col gap-1">
        {results.map((result, index) => (
          <motion.li
            key={result.id}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: index * 0.05 }}
            className={cn(
              "rounded-px border border-px-border bg-px-bg px-2.5 py-1.5",
              "transition-colors hover:border-px-border-strong hover:bg-px-surface",
            )}
          >
            <p className="truncate text-[12.5px] font-medium">{result.title}</p>
            <p className="truncate text-[11.5px] text-px-fg-subtle">
              {kind === "web" ? hostname(result.location) : result.location}
            </p>
            {result.snippet && (
              <p className="mt-0.5 line-clamp-2 text-[11.5px] text-px-fg-muted">{result.snippet}</p>
            )}
          </motion.li>
        ))}
      </ul>
    </ToolRow>
  );
}
