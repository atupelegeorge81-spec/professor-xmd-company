import { useEffect, useState } from "react";
import { History, Monitor, Plus, Square, X } from "lucide-react";
import "./lean.css";
import { useLean } from "./useLean";
import { RunView } from "./Timeline";
import { Computer } from "./Computer";
import { Composer } from "./Composer";
import { execLabel, fmtTok, livePhase, type Exec } from "./model";
import { Elapsed, KindIcon, Shimmer, useMedia, useStickToBottom } from "./ui";

const SUGGEST = [
  "Tengeneza site ndogo ya ukurasa mmoja ya mgahawa wa Dar, kisha ihakiki",
  "@search Tafuta habari 3 mpya kuhusu AI Afrika Mashariki na unipe muhtasari",
  "Andika script ya Python inayohesabu siku hadi mwisho wa mwaka, iendeshe",
];

export default function LeanApp() {
  const L = useLean();
  const { model, config } = L;
  const run = model.runs[model.runs.length - 1];
  const running = run?.status === "running";
  const phase = livePhase(run);
  const wide = useMedia("(min-width: 1080px)");
  const [focusId, setFocusId] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  const [hist, setHist] = useState(false);
  const scroller = useStickToBottom<HTMLDivElement>(model.version);

  // kazi mpya -> rudi "moja kwa moja"
  useEffect(() => { if (running) setFocusId(null); }, [running, run?.id]);

  const onFocus = (x: Exec) => { setFocusId(x.id + x.runId); if (!wide) setSheet(true); };
  const liveExec = phase.exec;
  const curStep = run?.steps[run.steps.length - 1];
  const budget = run?.usage.budget || 0;
  const pct = budget ? Math.min(100, Math.round((run!.usage.total / budget) * 100)) : 0;

  return (
    <div className={`xl ${wide ? "is-wide" : ""}`}>
      <div className="xl-main">
        <header className="xl-head">
          <div className="xl-brand"><span className="xl-logo">X</span><b>XMD</b><span className="xl-brand__sub">Lean</span></div>
          <span className={`xl-pill xl-pill--${running ? "run" : L.conn === "live" ? "ok" : L.conn}`}>
            <i />{running ? phase.label || "Inafanya kazi" : L.conn === "offline" ? "Inaunganisha upya…" : "Tayari"}
          </span>
          <div className="xl-head__right">
            {config && <span className="xl-model" title={`mode: ${config.mode}`}>{config.model.replace(/:free$/, "")}</span>}
            <span className="xl-meter" title="Tokens za mazungumzo haya (kutoka kwa provider)">
              <span className="xl-meter__n">{fmtTok(model.threadTotal)}</span>
              <span className="xl-meter__l">tokens</span>
            </span>
            <button className="xl-iconbtn" title="Mazungumzo ya zamani" onClick={() => { L.refreshThreads(); setHist(!hist); }}><History size={16} /></button>
            <button className="xl-iconbtn" title="Mazungumzo mapya" onClick={() => { L.newThread(); setFocusId(null); }} disabled={running}><Plus size={16} /></button>
            {!wide && (
              <button className="xl-iconbtn" title="Kompyuta ya XMD" onClick={() => setSheet(true)}><Monitor size={16} /></button>
            )}
          </div>
          {hist && (
            <div className="xl-hist xl-in">
              <div className="xl-hist__h"><b>Mazungumzo</b><button className="xl-iconbtn" onClick={() => setHist(false)}><X size={14} /></button></div>
              {L.threads.length === 0 && <div className="xl-hist__e">Bado hakuna.</div>}
              {L.threads.map((t) => (
                <button key={t.id} className={t.id === L.threadId ? "is-on" : ""} onClick={() => { L.openThread(t.id); setHist(false); }}>
                  <span>{t.title}</span>{t.active && <i className="xl-dotlive" />}
                </button>
              ))}
            </div>
          )}
        </header>

        <div className="xl-scroll" ref={scroller}>
          <div className="xl-feed">
            {model.runs.length === 0 && (
              <div className="xl-empty xl-in">
                <div className="xl-empty__logo">X</div>
                <h1>XMD atafanya nini leo?</h1>
                <p>Kila hatua inaonekana ikitokea: anachofikiri, amri anayoandika, output yake mstari kwa mstari, na mafaili anayounda.</p>
                <div className="xl-suggest">
                  {SUGGEST.map((s) => <button key={s} onClick={() => L.send(s)}>{s}</button>)}
                </div>
                {config && !config.hasKey && <div className="xl-note xl-note--error">Server haina XMD_API_KEY.</div>}
              </div>
            )}
            {model.runs.map((r) => <RunView key={r.id} run={r} onFocus={onFocus} />)}
          </div>
        </div>

        <div className="xl-dock">
          {L.error && <div className="xl-note xl-note--error xl-in" onClick={() => L.setError(null)}>{L.error}</div>}
          {running && (
            <div className="xl-status xl-in">
              <span className="xl-status__dot" />
              <span className="xl-status__txt">
                <span className="xl-status__who">XMD anafanya kazi:</span>{" "}
                {liveExec ? <b><KindIcon kind={liveExec.kind} size={12} /> {execLabel(liveExec, true)}</b> : <Shimmer>{phase.label || "Inaanza"}</Shimmer>}
              </span>
              <span className="xl-status__meta">
                {curStep && <span>hatua {curStep.runStep}/{curStep.maxSteps}</span>}
                <span><Elapsed start={run.startTs} live /></span>
                {budget > 0 && (
                  <span className="xl-budget" title={`${run.usage.total} / ${budget} tokens`}>
                    <span className="xl-budget__bar"><i style={{ width: pct + "%" }} /></span>{fmtTok(run.usage.total)}
                  </span>
                )}
              </span>
              <button className="xl-stop" onClick={L.stop}><Square size={10} fill="currentColor" /> Simamisha</button>
            </div>
          )}
          {!wide && running && liveExec && (
            <button className="xl-minipc xl-in" onClick={() => setSheet(true)}>
              <Monitor size={13} /><span className="xl-minipc__cmd">{(liveExec.command ?? liveExec.path ?? "").split("/ws/").pop()}</span>
              <span className="xl-minipc__out">{liveExec.output.trim().split("\n").pop()}</span>
            </button>
          )}
          <Composer skills={config?.skills ?? []} running={running} onSend={L.send} onStop={L.stop} />
        </div>
      </div>

      {wide && (
        <Computer model={model} threadId={L.threadId} focusId={focusId} setFocusId={setFocusId} draft={running ? curStep?.draft : undefined} />
      )}
      {!wide && sheet && (
        <div className="xl-sheet" onClick={() => setSheet(false)}>
          <div className="xl-sheet__panel xl-sheet-in" onClick={(e) => e.stopPropagation()}>
            <div className="xl-sheet__grab" />
            <Computer model={model} threadId={L.threadId} focusId={focusId} setFocusId={setFocusId} onClose={() => setSheet(false)} compact draft={running ? curStep?.draft : undefined} />
          </div>
        </div>
      )}
    </div>
  );
}
