import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  AlertTriangle, Check, FileCode2, FilePen, FolderTree, GitBranch, Globe, List, Package,
  Rocket, Search, ShieldCheck, Sparkles, Terminal, X, FileText,
} from "lucide-react";
import type { ExecKind } from "./model";
import { fmtMs } from "./model";
import { useNow } from "./useLean";

export function KindIcon({ kind, size = 14 }: { kind: ExecKind | string; size?: number }) {
  const p = { size, strokeWidth: 2 };
  switch (kind) {
    case "write": return <FilePen {...p} />;
    case "search": return <Search {...p} />;
    case "browse": return <Globe {...p} />;
    case "check": return <ShieldCheck {...p} />;
    case "git": return <GitBranch {...p} />;
    case "deploy": return <Rocket {...p} />;
    case "map": return <FolderTree {...p} />;
    case "read": return <FileText {...p} />;
    case "list": return <List {...p} />;
    case "pkg": return <Package {...p} />;
    case "skill": return <Sparkles {...p} />;
    case "error": return <AlertTriangle {...p} />;
    case "code": return <FileCode2 {...p} />;
    default: return <Terminal {...p} />;
  }
}

/** Nodi ya rail: inazunguka (live) -> tiki / msalaba. */
export function StatusNode({ state }: { state: "live" | "ok" | "fail" | "idle" }) {
  return (
    <span className={`xl-node xl-node--${state}`} aria-hidden>
      {state === "ok" && <Check size={10} strokeWidth={3} />}
      {state === "fail" && <X size={10} strokeWidth={3} />}
    </span>
  );
}

export function Spinner({ size = 12 }: { size?: number }) {
  return <span className="xl-spin" style={{ width: size, height: size }} aria-label="inaendelea" />;
}

/** Muda unaotembea kila 100ms wakati wa live; unaganda ukimalizika. */
export function Elapsed({ start, end, live }: { start?: number; end?: number; live: boolean }) {
  const now = useNow(live && !!start);
  if (!start) return null;
  const ms = (end ?? (live ? now : start)) - start;
  return <span className="xl-num">{fmtMs(ms)}</span>;
}

/** Sehemu inayokunjika kwa grid-rows (laini, bila kupima urefu). */
export function Collapse({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <div className={`xl-collapse ${open ? "is-open" : ""}`}>
      <div className="xl-collapse__inner">{children}</div>
    </div>
  );
}

/** Scroll inafuata chini wakati mtumiaji yuko chini; akipanda juu inaacha. */
export function useStickToBottom<T extends HTMLElement>(dep: unknown, enabled = true) {
  const ref = useRef<T | null>(null);
  const stick = useRef(true);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onScroll = () => {
      stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => {
    const el = ref.current;
    if (el && enabled && stick.current) el.scrollTop = el.scrollHeight;
  });
  // dep inalazimisha kuangalia upya
  void dep;
  return ref;
}

/** Maandishi yanayoonekana kama yanaandikwa: caret inapepesa mwishoni. */
export function Caret() {
  return <span className="xl-caret" aria-hidden />;
}

export function Shimmer({ children }: { children: ReactNode }) {
  return <span className="xl-shimmer">{children}</span>;
}

export function useMedia(q: string): boolean {
  const [m, setM] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = () => setM(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [q]);
  return m;
}
