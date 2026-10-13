"use client";
import { Link2, Lock, CircleDashed, Sparkles, Code2 } from "lucide-react";
import type { AgendaDef, AgendaPhase, FinalePhase, LiveStage } from "@/lib/stage/types";
import { cn } from "@/lib/utils";
import { TONE } from "./kit";

/* Rail ya maendeleo (sticky) — inaonyesha agenda zote, awamu ya sasa na kazi ya background.
 * Awamu zinatoka kwenye matukio halisi ya engine (angalia lib/board/adapter.ts). */

const AGENDA_STEPS: { k: AgendaPhase; label: string }[] = [
  { k: "evidence", label: "Evidence" },
  { k: "discussion", label: "Mjadala" },
  { k: "code", label: "Code" },
  { k: "lock", label: "Ledger" },
  { k: "review", label: "Observers" },
  { k: "relock", label: "Re-lock" },
];
const FINALE_STEPS: { k: FinalePhase; label: string }[] = [
  { k: "validate", label: "Validator" },
  { k: "assemble", label: "Script" },
  { k: "report", label: "Ripoti" },
  { k: "done", label: "Imekamilika" },
];
// R30 · plan mode: hakuna Script — Mpango Kazi ndiyo hatua (inapatikana /api/plans kwa computer-use agent)
const FINALE_STEPS_PLAN: { k: FinalePhase; label: string }[] = [
  { k: "validate", label: "Validator" },
  { k: "plan", label: "Mpango" },
  { k: "report", label: "Ripoti" },
  { k: "done", label: "Imekamilika" },
];
// mpangilio halisi wa engine: lock → observers → (relock)
const ORDER: AgendaPhase[] = ["evidence", "discussion", "code", "lock", "review", "relock"];

export function StageRail({ stage, agenda, live }: { stage: LiveStage; agenda: AgendaDef[]; live: boolean }) {
  const inFinale = stage.scope === "finale" || stage.scope === "done";
  const steps = inFinale
    ? stage.plan
      ? FINALE_STEPS_PLAN
      : FINALE_STEPS
    // R31-G5: plan mode — awamu ya kuandika code IMERUKWA; step ya "Code" haionekani kabisa
    : AGENDA_STEPS.filter((s) => (s.k === "code" ? stage.agenda?.requiresCode && !stage.plan : s.k === "relock" ? stage.hadObjection : true))
        .sort((a, b) => ORDER.indexOf(a.k) - ORDER.indexOf(b.k));
  const cur = inFinale ? stage.finale : stage.phase;
  const curIdx = steps.findIndex((s) => s.k === cur);

  if (stage.scope === "opening") return null;

  return (
    <div className="glass sticky top-0 z-20 -mx-4 border-b border-[var(--color-line)] px-4 py-2 sm:-mx-6 sm:px-6">
      <div className="st-fog-x st-noscroll flex items-center gap-1.5 overflow-x-auto">
        {agenda.map((a) => {
          const l = stage.ledger[a.index];
          const active = !inFinale && stage.agenda?.index === a.index && !l;
          const tone = l?.status === "OPEN" ? TONE.warn : l ? TONE.ok : null;
          return (
            <a key={a.index} href={`#agenda-${a.index}`} title={`${a.title}${l ? ` · ${l.status}` : ""}`}
              className={cn("flex h-6 shrink-0 items-center gap-1 rounded-full border px-2 text-[10.5px] font-semibold transition-all", active ? "prism-border text-[var(--color-fg)]" : "border-[var(--color-line)] text-[var(--color-muted)]")}
              style={tone ? { color: tone.c, borderColor: `rgb(${tone.rgb} / 0.35)`, background: `rgb(${tone.rgb} / 0.08)` } : undefined}>
              {l?.status === "SUPERSEDED+LOCKED" ? <Link2 size={10} /> : l?.status === "OPEN" ? <CircleDashed size={10} /> : l ? <Lock size={10} /> : active ? <span className="h-1.5 w-1.5 rounded-full bg-prism animate-pulse" /> : null}
              A{a.index}
              {l && <span className="font-mono font-normal opacity-80">v{l.version}</span>}
            </a>
          );
        })}
        {/* P2 (maelezo.md 14.P2) → R63: strip ya milestones — TICKET ya gradient (violet→fuchsia) TOFAUTI na pill za agenda;
            tile ya M + </> Computer inapoanzishwa (PLANNING→VERIFYING) + lock inaposign-off */}
        {!!stage.milestones?.length && (
          <>
            <span className="mx-1 h-4 w-px shrink-0 bg-[var(--color-line)]" />
            {stage.milestones.map((m) => {
              const tone =
                m.status === "SIGNED_OFF" ? TONE.ok
                : m.status === "SIGNED_OFF_WITH_WAIVERS" || m.status === "CAP_REACHED" ? TONE.warn
                : m.status === "BLOCKED" ? TONE.bad : null;
              const computerOn = !!m.status && !["DISCUSSING", "SIGNED_OFF", "SIGNED_OFF_WITH_WAIVERS", "CAP_REACHED", "BLOCKED"].includes(m.status);
              return (
                <span key={m.id} title={`MILESTONE · ${m.title} · ${m.status}${m.round ? ` · raundi ${m.round}/${m.maxRounds}` : ""} · ${m.mode}`}
                  className={cn(
                    "flex h-6 shrink-0 items-center gap-1.5 rounded-lg border py-0.5 pl-0.5 pr-1.5 text-[10.5px] font-semibold",
                    m.active
                      ? "border-[rgb(167_139_250/0.55)] bg-[linear-gradient(135deg,rgb(139_92_246/0.18),rgb(217_70_239/0.08))] text-[var(--color-fg)] shadow-[0_0_12px_-4px_rgb(139_92_246/0.7)]"
                      : "border-[var(--color-line)] text-[var(--color-muted)]",
                  )}
                  style={tone ? { color: tone.c, borderColor: `rgb(${tone.rgb} / 0.4)`, background: `rgb(${tone.rgb} / 0.08)` } : undefined}>
                  {/* tile ya gradient — alama rasmi ya MILE (si dot kama agenda) */}
                  <span className={cn("grid h-5 w-5 shrink-0 place-items-center rounded-md font-mono text-[9px] font-bold", tone ? "" : "bg-gradient-to-br from-[#8b5cf6] to-[#d946ef] text-white")} style={tone ? { background: `rgb(${tone.rgb} / 0.18)`, color: tone.c } : undefined}>
                    {m.status === "SIGNED_OFF" ? <Lock size={9} /> : m.id}
                  </span>
                  {m.active && !tone && <span className="h-1.5 w-1.5 rounded-full bg-prism animate-pulse" />}
                  {computerOn && <Code2 size={10} className="text-[#c4b5fd]" />}
                  {(m.status === "FIXING" || m.status === "VERIFYING") && (
                    <span className="font-mono font-normal opacity-80">R{m.round}</span>
                  )}
                </span>
              );
            })}
          </>
        )}
        <span className={cn("flex h-6 shrink-0 items-center gap-1 rounded-full border px-2 text-[10.5px] font-semibold", inFinale ? "prism-border text-[var(--color-fg)]" : "border-[var(--color-line)] text-[var(--color-faint)]")}>
          <Sparkles size={10} /> Finale
        </span>
        <span className="mx-1 h-4 w-px shrink-0 bg-[var(--color-line)]" />
        {steps.map((s, i) => {
          const done = i < curIdx || stage.scope === "done";
          const on = i === curIdx && stage.scope !== "done";
          return (
            <span key={s.k} className="flex shrink-0 items-center gap-1.5">
              {i > 0 && <span className={cn("h-px w-3", done || on ? "bg-[var(--color-line-strong)]" : "bg-[var(--color-line)]")} />}
              <span className={cn("flex items-center gap-1 text-[11px]", on ? "font-semibold text-[var(--color-fg)]" : done ? "text-[var(--color-muted)]" : "text-[var(--color-faint)]")}>
                <span className={cn("h-1.5 w-1.5 rounded-full", on ? "bg-prism animate-pulse" : done ? "bg-[var(--color-ok)]" : "bg-[var(--color-line-strong)]")} />
                {s.label}
              </span>
            </span>
          );
        })}
      </div>
      {live && stage.background && (
        <p className="shimmer-text mt-1 truncate text-[11px] font-medium">{stage.background}</p>
      )}
    </div>
  );
}
