import { useState } from "react";
import { Streamdown } from "streamdown";
import { AlertTriangle, Brain, ChevronRight, CircleStop, Info, ShieldAlert } from "lucide-react";
import type { Exec, Run, Step } from "./model";
import { fmtMs, fmtTok } from "./model";
import { Caret, Collapse, Elapsed, Shimmer, StatusNode } from "./ui";
import { DraftView, ToolView } from "./tools";

// ------------------------------------------------------------ thinking
function Thinking({ s }: { s: Step }) {
  const live = s.think.open;
  const [pinned, setPinned] = useState<boolean | null>(null);
  const open = pinned ?? live; // live -> wazi; ikiisha -> inajikunja (mtumiaji anaweza kufungua)
  if (!s.think.text && !live) return null;
  const tail = s.think.text.length > 1400 ? "…" + s.think.text.slice(-1400) : s.think.text;
  return (
    <div className={`xl-think ${live ? "is-live" : ""}`}>
      <button className="xl-think__head" onClick={() => setPinned(!open)}>
        <Brain size={13} />
        {live ? (
          <><Shimmer>Inafikiri</Shimmer><span className="xl-think__t"><Elapsed start={s.think.startTs} live /></span></>
        ) : (
          <span>Ilifikiri kwa {fmtMs(s.think.ms)}</span>
        )}
        <ChevronRight size={13} className={`xl-chev ${open ? "is-open" : ""}`} />
      </button>
      <Collapse open={open}>
        <div className={`xl-think__body ${live ? "is-live" : ""} ${live && s.think.text.length > 260 ? "is-long" : ""}`}>
          {live ? tail : s.think.text}
          {live && <Caret />}
        </div>
      </Collapse>
    </div>
  );
}

function Note({ kind, text }: { kind: string; text: string }) {
  const Icon = kind === "error" ? AlertTriangle : kind === "notice" ? Info : ShieldAlert;
  return (
    <div className={`xl-note xl-note--${kind === "error" ? "error" : kind === "notice" ? "info" : "guard"} xl-in`}>
      <Icon size={13} /> <span>{text}</span>
    </div>
  );
}

// ------------------------------------------------------------ step
function StepRow({ s, live, onFocus, last }: { s: Step; live: boolean; onFocus: (x: Exec) => void; last: boolean }) {
  const x = s.exec;
  const failed = x?.status === "fail";
  const state: "live" | "ok" | "fail" | "idle" = live ? "live" : failed ? "fail" : "ok";
  const hasBody = s.think.text || s.think.open || s.text.s || s.draft || x || s.notes.length;
  if (!hasBody && !live) return null;
  return (
    <div className={`xl-step xl-in ${last ? "is-last" : ""}`}>
      <div className="xl-step__rail"><StatusNode state={state} /></div>
      <div className="xl-step__body">
        <Thinking s={s} />
        {s.text.s && (
          <div className="xl-say">
            {s.text.s.trim()}
            {s.text.open && <Caret />}
          </div>
        )}
        {s.draft && !x && <DraftView d={s.draft} />}
        {x && <ToolView x={x} onFocus={onFocus} />}
        {s.notes.map((n, k) => <Note key={k} {...n} />)}
        {live && !s.think.text && !s.think.open && !s.text.s && !s.draft && !x && (
          <div className="xl-draftline"><span className="xl-dots"><i /><i /><i /></span> <Shimmer>Inaunganisha na model…</Shimmer></div>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------ run
const STATUS_TXT: Record<string, string> = {
  done: "Imekamilika", error: "Imekwama", stopped: "Imesimamishwa", stuck: "Imesimamishwa (kosa linajirudia)",
  interrupted: "Imekatizwa (server ilizimwa)", running: "Inaendelea",
};

export function RunView({ run, onFocus }: { run: Run; onFocus: (x: Exec) => void }) {
  const live = run.status === "running";
  const lastStep = run.steps[run.steps.length - 1];
  return (
    <section className="xl-run">
      <div className="xl-user xl-in"><div className="xl-user__bubble">{run.task}</div></div>

      <div className="xl-agent">
        <div className="xl-agent__head">
          <span className={`xl-avatar ${live ? "is-live" : ""}`}>X</span>
          <span className="xl-agent__name">XMD</span>
          {run.skills.map((sk) => (
            <span key={sk.name} className="xl-chip xl-in" title={`imepakiwa kwa ${sk.via === "mention" ? "@mention" : "router"} · ${sk.chars} herufi`}>
              @{sk.name}
            </span>
          ))}
          {run.size && <span className="xl-agent__meta">kazi {run.size} · bajeti {run.budget?.steps} hatua</span>}
        </div>

        <div className="xl-steps">
          {run.steps.map((s) => (
            <StepRow key={s.n} s={s} live={live && s === lastStep} onFocus={onFocus} last={s === lastStep} />
          ))}
          {live && run.steps.length === 0 && (
            <div className="xl-step xl-in is-last">
              <div className="xl-step__rail"><StatusNode state="live" /></div>
              <div className="xl-step__body"><div className="xl-draftline"><Shimmer>Inaandaa mazingira…</Shimmer></div></div>
            </div>
          )}
        </div>

        {run.notes.map((n, k) => <Note key={k} {...n} />)}

        {run.report != null && (
          <div className={`xl-report xl-in ${run.partial ? "is-partial" : ""}`}>
            {run.partial && <div className="xl-report__flag">Ripoti ya sehemu — kazi haikukamilika yote</div>}
            <Streamdown>{run.report}</Streamdown>
          </div>
        )}

        {!live && (
          <div className={`xl-runfoot xl-runfoot--${run.status}`}>
            {run.status === "stopped" ? <CircleStop size={12} /> : <StatusNode state={run.status === "done" ? "ok" : "fail"} />}
            <span>{STATUS_TXT[run.status] ?? run.status}</span>
            {run.end && (
              <>
                <span>·</span><span>hatua {run.end.steps}</span>
                <span>·</span><span>{fmtMs(run.end.ms)}</span>
                <span>·</span><span title={`prompt ${run.end.prompt} · jibu ${run.end.completion} · cache ${run.end.cached}`}>
                  tokens {fmtTok(run.end.total)}{run.end.cached ? ` (cache ${fmtTok(run.end.cached)})` : ""}
                </span>
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
