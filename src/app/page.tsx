"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AGENTS, getAgent } from "@/lib/agents";
import type { LogEntry } from "@/lib/types";
import { BoardRoom, type ConvSignal } from "@/components/BoardRoom";
import { AgentChat } from "@/components/AgentChat";
import { ReportsDashboard } from "@/components/ReportsDashboard";
import { MenuDrawer } from "@/components/MenuDrawer";
import { ChatMenu } from "@/components/ChatMenu";
import { LogsPopup } from "@/components/LogsPopup";

const nid = () => typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2, 10);

export default function HomePage() {
  const [view, setView] = useState("board");
  const [menuOpen, setMenuOpen] = useState(false);
  const [chatsOpen, setChatsOpen] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [usage, setUsage] = useState<Record<string, { requests: number; tokens: number }> | null>(null);
  const [reportsBadge, setReportsBadge] = useState(0);
  const [convSignal, setConvSignal] = useState<ConvSignal>(null);
  const convN = useRef(0);
  const headerRef = useRef<HTMLElement>(null);

  const addLog = useCallback((type: LogEntry["type"], message: string) => setLogs((items) => [...items.slice(-199), { id: nid(), timestamp: new Date().toLocaleTimeString("en-GB"), type, message }]), []);

  useEffect(() => {
    const open = (event: Event) => { const id = (event as CustomEvent<string>).detail; if (id) setConvSignal({ kind: "open", id, n: ++convN.current }); };
    const fresh = () => setConvSignal({ kind: "new", n: ++convN.current });
    window.addEventListener("xmd:open-conv", open); window.addEventListener("xmd:new-conv", fresh);
    return () => { window.removeEventListener("xmd:open-conv", open); window.removeEventListener("xmd:new-conv", fresh); };
  }, []);

  useEffect(() => {
    const poll = () => fetch("/api/reports").then((response) => response.json()).then((data) => setReportsBadge(Array.isArray(data.reports) ? data.reports.length : 0)).catch(() => {});
    poll(); const interval = setInterval(poll, 15000); return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const syncHeader = () => headerRef.current && document.documentElement.style.setProperty("--app-header-h", `${headerRef.current.getBoundingClientRect().bottom}px`);
    syncHeader(); window.addEventListener("resize", syncHeader); return () => window.removeEventListener("resize", syncHeader);
  }, []);

  const agent = getAgent(view);
  const roomLabel = view === "board" ? "Board room" : view === "reports" ? "Reports" : agent?.name ?? view;

  return (
    <div className="app-shell min-h-dvh text-foreground">
      <div className="ambient-glow" aria-hidden="true" />
      <header ref={headerRef} className="topbar">
        <div className="brand-lockup">
          <span className="brand-mark"><img src="/brand/logo.png" alt="Professor XMD Company" /></span>
          <span><strong>PROFESSOR<span className="brand-accent">-XMD</span></strong><small>Autonomous AI company</small></span>
        </div>
        <div className="topbar-status"><span className="status-dot" /> Systems online <span className="status-divider" /> {roomLabel}</div>
        <div className="topbar-actions">
          <button onClick={() => setChatsOpen(true)} className="icon-button" aria-label="Open conversations"><Icon name="chat" /></button>
          <button onClick={() => setMenuOpen(true)} className="icon-button" aria-label="Open menu"><Icon name="menu" /></button>
        </div>
      </header>

      <div className="workspace-layout">
        <aside className="sidebar">
          <div className="sidebar-label">Workspace</div>
          <RailButton active={view === "board"} onClick={() => setView("board")} label="Board room" icon="grid" />
          <RailButton active={view === "reports"} onClick={() => setView("reports")} label="Reports" icon="chart" badge={reportsBadge} />
          <div className="sidebar-label agents-label">Agents <span>{AGENTS.length}</span></div>
          {AGENTS.map((item) => <button key={item.id} onClick={() => setView(item.id)} className={`agent-nav ${view === item.id ? "active" : ""}`}><img src={item.avatar} alt="" /><span><strong>{item.name}</strong><small>{item.role}</small></span><i style={{ background: item.accent }} /></button>)}
          <div className="sidebar-footer"><div className="footer-line" /><span>Run your next decision with clarity.</span></div>
        </aside>

        <main className="main-stage">
          <section className="welcome-row">
            <div><p className="eyebrow">Command center / 09.24.26</p><h1>Make sharper decisions,<br /><em>together.</em></h1><p className="lede">A focused workspace for turning ambitious ideas into clear, evidence-backed action.</p></div>
            <button className="new-session" onClick={() => { setView("board"); window.dispatchEvent(new Event("xmd:new-conv")); }}><span>+</span> New session</button>
          </section>
          <section className="insight-grid">
            <div className="insight-card dark-card"><div className="card-kicker">ACTIVE ROOM <span className="live-pill">LIVE</span></div><div className="big-number">01</div><div><strong>Board room</strong><p>Consensus-led product thinking</p></div><span className="card-arrow">↗</span></div>
            <div className="insight-card orange-card"><div className="card-kicker">TEAM CAPACITY</div><div className="big-number">{AGENTS.length}<small> agents</small></div><div><strong>Specialists ready</strong><p>Strategy, design, engineering</p></div><span className="card-arrow">↗</span></div>
            <div className="insight-card"><div className="card-kicker">WORKFLOW</div><div className="big-number">03</div><div><strong>Signals aligned</strong><p>Context · evidence · action</p></div><span className="card-arrow">↗</span></div>
          </section>
          <section className="agent-section"><div className="section-heading"><div><p className="eyebrow">Your council</p><h2>Choose a specialist</h2></div><span className="section-note">Select an agent to enter their workspace</span></div><div className="agent-grid">{AGENTS.map((item, index) => <button key={item.id} onClick={() => setView(item.id)} className={`agent-card ${view === item.id ? "selected" : ""}`}><div className="agent-card-top"><span className="agent-index">0{index + 1}</span><span className="agent-status"><i style={{ background: item.accent }} /> Available</span></div><img src={item.avatar} alt={`${item.name}, ${item.role}`} /><div className="agent-card-copy"><h3>{item.name}</h3><p>{item.role}</p><span>{item.tagline}</span></div><span className="agent-enter">↗</span></button>)}</div></section>
          <section className="workspace-panel"><div className="panel-heading"><div><p className="eyebrow">Live workspace</p><h2>{roomLabel}</h2></div><div className="panel-meta"><span className="status-dot" /> Connected</div></div><div className="panel-content">{view === "board" ? <BoardRoom addLog={addLog} setUsage={setUsage} onReport={() => setReportsBadge((count) => count + 1)} convSignal={convSignal} /> : view === "reports" ? <ReportsDashboard /> : agent ? <AgentChat key={agent.id} agent={agent} addLog={addLog} setUsage={setUsage} /> : null}</div></section>
        </main>
      </div>
      <LogsPopup logs={logs} roomLabel={roomLabel} usage={usage} onClear={() => setLogs([])} />
      <MenuDrawer open={menuOpen} view={view} reportsBadge={reportsBadge} onClose={() => setMenuOpen(false)} onSelect={(next) => { if (next === "reports") setReportsBadge(0); setView(next); }} />
      <ChatMenu open={chatsOpen} onClose={() => setChatsOpen(false)} onNavigate={(next) => setView(next)} activeId={convSignal?.kind === "open" ? convSignal.id : null} />
    </div>
  );
}

function RailButton({ active, onClick, label, icon, badge }: { active: boolean; onClick: () => void; label: string; icon: "grid" | "chart"; badge?: number }) { return <button onClick={onClick} className={`rail-button ${active ? "active" : ""}`}><Icon name={icon} /><span>{label}</span>{badge ? <b>{badge}</b> : null}</button>; }
function Icon({ name }: { name: "chat" | "menu" | "grid" | "chart" }) { if (name === "menu") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>; if (name === "chat") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z" /></svg>; if (name === "chart") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19V5m0 14h16M8 16v-5m4 5V7m4 9v-8" /></svg>; return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></svg>; }

