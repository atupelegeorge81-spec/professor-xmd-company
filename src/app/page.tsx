"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AGENTS, getAgent } from "@/lib/agents";
import type { LogEntry } from "@/lib/types";
import { BoardRoom, type ConvSignal } from "@/components/BoardRoom";
import { AgentChat } from "@/components/AgentChat";
import { ReportsDashboard } from "@/components/ReportsDashboard";
import { MenuDrawer } from "@/components/MenuDrawer";
import { ChatMenu } from "@/components/ChatMenu";
import { LogsPopup } from "@/components/LogsPopup";

const nid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 10);

export default function HomePage() {
  const [view, setView] = useState<string>("board");
  const [menuOpen, setMenuOpen] = useState(false);
  const [chatsOpen, setChatsOpen] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [usage, setUsage] = useState<Record<string, { requests: number; tokens: number }> | null>(null);
  const [reportsBadge, setReportsBadge] = useState(0);
  const [convSignal, setConvSignal] = useState<ConvSignal>(null);
  const convN = useRef(0);
  const headerRef = useRef<HTMLElement>(null);

  const addLog = useCallback((type: LogEntry["type"], message: string) => {
    setLogs((l) => [
      ...l.slice(-199),
      { id: nid(), timestamp: new Date().toLocaleTimeString("en-GB"), type, message },
    ]);
  }, []);

  useEffect(() => {
    const open = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      if (id) setConvSignal({ kind: "open", id, n: ++convN.current });
    };
    const fresh = () => setConvSignal({ kind: "new", n: ++convN.current });
    window.addEventListener("xmd:open-conv", open);
    window.addEventListener("xmd:new-conv", fresh);
    return () => {
      window.removeEventListener("xmd:open-conv", open);
      window.removeEventListener("xmd:new-conv", fresh);
    };
  }, []);

  useEffect(() => {
    const poll = () =>
      fetch("/api/reports")
        .then((r) => r.json())
        .then((d) => setReportsBadge(Array.isArray(d.reports) ? d.reports.length : 0))
        .catch(() => {});
    poll();
    const iv = setInterval(poll, 15000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const setHeaderVar = () => {
      if (headerRef.current) {
        document.documentElement.style.setProperty(
          "--app-header-h",
          `${headerRef.current.getBoundingClientRect().bottom}px`,
        );
      }
    };
    setHeaderVar();
    window.addEventListener("resize", setHeaderVar);
    return () => window.removeEventListener("resize", setHeaderVar);
  }, []);

  const agent = getAgent(view);
  const roomLabel =
    view === "board" ? "Board Room" : view === "reports" ? "Reports" : agent?.name ?? view;

  return (
    <div className="app-shell relative bg-transparent text-foreground">
      {/* Atmosphere — drifting signal light behind everything */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        <div
          className="absolute left-[58%] top-[-16rem] h-[34rem] w-[34rem] rounded-full opacity-60 blur-[120px]"
          style={{ background: "radial-gradient(circle, oklch(0.62 0.24 293 / 0.20), transparent 70%)" }}
        />
        <div
          className="absolute bottom-[-14rem] right-[8%] h-[30rem] w-[30rem] rounded-full opacity-50 blur-[120px]"
          style={{ background: "radial-gradient(circle, oklch(0.8 0.14 220 / 0.16), transparent 70%)" }}
        />
        {/* Fine grid for depth */}
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "linear-gradient(oklch(1 0 0 / 0.55) 1px, transparent 1px), linear-gradient(90deg, oklch(1 0 0 / 0.55) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            maskImage: "radial-gradient(75% 70% at 50% 36%, #000 40%, transparent 100%)",
            WebkitMaskImage: "radial-gradient(75% 70% at 50% 36%, #000 40%, transparent 100%)",
          }}
        />
      </div>

      {/* Brand header */}
      <header
        ref={headerRef}
        className="glass-strong relative z-20 mx-auto mt-3 flex w-[calc(100%-1.5rem)] max-w-6xl shrink-0 items-center gap-3 rounded-[1.4rem] px-3.5 py-2.5"
      >
        <span className="brand-lockup relative h-11 w-11 shrink-0 overflow-hidden p-[3px]">
          <img
            src="/brand/logo.png"
            alt="PROFESSOR-XMD-COMPANY logo"
            width={92}
            height={92}
            className="h-full w-full rounded-full object-cover"
          />
        </span>

        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-[16px] font-bold leading-5 tracking-tight text-foreground">
            PROFESSOR-XMD<span className="text-signal">-COMPANY</span>
          </h1>
          <p className="truncate text-[11px] text-muted-foreground">
            Autonomous AI engineering company
          </p>
        </div>

        <span className="hidden shrink-0 items-center gap-1.5 rounded-full border border-border bg-background/50 px-2.5 py-1 text-[10.5px] font-semibold text-muted-foreground sm:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-signal shadow-[0_0_8px_var(--primary)]" />
          {roomLabel}
        </span>

        <button
          onClick={() => setChatsOpen(true)}
          aria-label="Board Room chats"
          title="Board Room chats"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-muted-foreground transition hover:bg-secondary hover:text-foreground active:scale-95"
        >
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>

        <button
          onClick={() => setMenuOpen(true)}
          aria-label="Open menu"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-muted-foreground transition hover:bg-secondary hover:text-foreground active:scale-95"
        >
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
      </header>

      {/* Navigation rail */}
      <nav className="relative z-10 mx-auto mt-2.5 flex w-[calc(100%-1.5rem)] max-w-6xl shrink-0 items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
        <RailButton
          active={view === "board"}
          onClick={() => setView("board")}
          label={
            <span className="flex items-center gap-1.5">
              <span className="grid h-5 w-5 place-items-center overflow-hidden rounded-full ring-1 ring-white/10">
                <img src="/boardroom.png" alt="Board Room" className="h-5 w-5 rounded-full object-cover" />
              </span>
              Board
            </span>
          }
        />
        <RailButton
          active={view === "reports"}
          onClick={() => setView("reports")}
          label={
            <span className="flex items-center gap-1.5">
              <span className="text-[13px] leading-none">📑</span>
              Reports
            </span>
          }
          badge={reportsBadge}
        />

        <span className="mx-1 h-5 w-px shrink-0 bg-border" />

        {AGENTS.map((a) => {
          const active = view === a.id;
          return (
            <button
              key={a.id}
              onClick={() => setView(a.id)}
              className={`flex shrink-0 items-center gap-2 rounded-full border px-2.5 py-1.5 transition-all duration-200 active:scale-95 ${
                active
                  ? "text-foreground"
                  : "border-border/60 bg-white/[0.03] text-foreground/80 hover:border-primary/30 hover:bg-white/[0.06] hover:text-foreground"
              }`}
              style={
                active
                  ? {
                      borderColor: `${a.accent}99`,
                      backgroundColor: `${a.accent}1c`,
                      boxShadow: `0 8px 24px -14px ${a.accent}`,
                    }
                  : undefined
              }
            >
              <span className="avatar-frame" style={{ width: 22, height: 22, minWidth: 22 }}>
                <img src={a.avatar} alt={a.name} width={44} height={44} loading="lazy" decoding="async" className="avatar-img" />
              </span>
              <span className="text-[11.5px] font-semibold">{a.name}</span>
              {active && <span className="h-1.5 w-1.5 rounded-full" style={{ background: a.accent, boxShadow: `0 0 8px ${a.accent}` }} />}
            </button>
          );
        })}
      </nav>

      <main className="relative z-10 flex min-h-0 flex-1 flex-col">
        {view === "board" ? (
          <BoardRoom
            addLog={addLog}
            setUsage={(u) => setUsage(u)}
            onReport={() => setReportsBadge((b) => b + 1)}
            convSignal={convSignal}
          />
        ) : view === "reports" ? (
          <ReportsDashboard />
        ) : agent ? (
          <AgentChat key={agent.id} agent={agent} addLog={addLog} setUsage={(u) => setUsage(u)} />
        ) : null}
      </main>

      <LogsPopup logs={logs} roomLabel={roomLabel} usage={usage} onClear={() => setLogs([])} />
      <MenuDrawer
        open={menuOpen}
        view={view}
        reportsBadge={reportsBadge}
        onClose={() => setMenuOpen(false)}
        onSelect={(v) => {
          if (v === "reports") setReportsBadge(0);
          setView(v);
        }}
      />
      <ChatMenu
        open={chatsOpen}
        onClose={() => setChatsOpen(false)}
        onNavigate={(v) => setView(v)}
        activeId={convSignal?.kind === "open" ? convSignal.id : null}
      />
    </div>
  );
}

function RailButton({
  active,
  onClick,
  label,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  label: ReactNode;
  badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11.5px] font-semibold transition-all duration-200 active:scale-95 ${
        active
          ? "border-white/15 bg-white/[0.07] text-foreground shadow-[0_10px_26px_-16px_var(--primary)]"
          : "border-border/60 bg-white/[0.03] text-foreground/80 hover:border-primary/30 hover:bg-white/[0.06] hover:text-foreground"
      }`}
    >
      {label}
      {badge ? (
        <span className="rounded-full bg-signal px-1.5 py-px text-[9px] font-bold text-primary-foreground">
          {badge}
        </span>
      ) : null}
    </button>
  );
}
