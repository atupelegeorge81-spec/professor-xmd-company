import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Monitor, Radio, RotateCw, X, AppWindow, TerminalSquare } from "lucide-react";
import type { Exec, Model, Step } from "./model";
import { execLabel, wsRel } from "./model";
import { Elapsed, KindIcon, Spinner } from "./ui";
import { DraftCode, TermBody, parsePage, parseSearch } from "./tools";

const TOOLNAME: Record<string, string> = {
  write: "Editor", search: "Search", browse: "Browser", check: "Browser", git: "Terminal", deploy: "Terminal",
  map: "Terminal", read: "Editor", list: "Terminal", pkg: "Terminal", bash: "Terminal", skill: "Skills", error: "Terminal",
};

function BigView({ x }: { x: Exec }) {
  if (x.kind === "write" || x.kind === "read") {
    const text = x.kind === "write" ? (x.content ?? "") : x.output;
    const lines = text.replace(/\n$/, "").split("\n");
    return (
      <div className={`xl-big-code ${x.status === "running" ? "is-writing" : ""}`}>
        <div className="xl-big-code__tab">{(x.path || x.command || "").split("/").pop()}</div>
        <pre>
          {lines.slice(0, 2000).map((l, k) => (
            <div key={k} className="xl-big-code__row"><span>{k + 1}</span><code>{l || " "}</code></div>
          ))}
        </pre>
      </div>
    );
  }
  if (x.kind === "search") {
    const hits = parseSearch(x.output);
    if (hits.length) {
      return (
        <div className="xl-big-search">
          {hits.map((h) => (
            <a key={h.n} href={h.url} target="_blank" rel="noreferrer" className="xl-in">
              <small>{h.url}</small><b>{h.title}</b><span>{h.snippet}</span>
            </a>
          ))}
        </div>
      );
    }
  }
  if (x.kind === "browse" && /xmd-fetch/.test(x.command ?? "") && x.output) {
    const pg = parsePage(x.output);
    return (
      <div className="xl-big-page">
        <div className="xl-page__bar"><span className="xl-page__dot" /><span>{pg.url}</span></div>
        <h3>{pg.title}</h3>
        <p>{pg.body.slice(0, 6000)}</p>
      </div>
    );
  }
  return <TermBody x={x} max={100000} />;
}

export function Computer({ model, threadId, focusId, setFocusId, onClose, compact, draft }: {
  model: Model; threadId: string | null; focusId: string | null; setFocusId: (id: string | null) => void;
  onClose?: () => void; compact?: boolean; draft?: Step["draft"];
}) {
  const execs = model.execs;
  const idx = focusId ? execs.findIndex((e) => e.id + e.runId === focusId) : -1;
  const following = idx < 0;
  const cur = following ? execs[execs.length - 1] : execs[idx];
  const pos = following ? execs.length - 1 : idx;
  const [tab, setTab] = useState<"work" | "site">("work");
  const [bust, setBust] = useState(0);

  // site ya workspace (index.html ya mwisho iliyoandikwa)
  const site = useMemo(() => {
    for (let k = execs.length - 1; k >= 0; k--) {
      const e = execs[k];
      if (e.kind === "write" && e.status === "ok" && /\.html?$/.test(e.path ?? "")) return wsRel(e.path);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [execs.length, model.version]);

  const live = cur?.status === "running";
  // model anaandika amri/faili SASA -> onyesha hapa kabla haijaendeshwa
  const showDraft = following && draft && draft.name !== "finish" && !live;
  const go = (k: number) => {
    if (k >= execs.length - 1) setFocusId(null);
    else if (k >= 0) setFocusId(execs[k].id + execs[k].runId);
  };

  return (
    <aside className={`xl-pc ${compact ? "is-compact" : ""}`}>
      <div className="xl-pc__head">
        <Monitor size={15} />
        <b>Kompyuta ya XMD</b>
        <div className="xl-pc__tabs">
          <button className={tab === "work" ? "is-on" : ""} onClick={() => setTab("work")}><TerminalSquare size={13} /> Kazi</button>
          <button className={tab === "site" ? "is-on" : ""} disabled={!site} onClick={() => setTab("site")}><AppWindow size={13} /> Site</button>
        </div>
        {onClose && <button className="xl-iconbtn" onClick={onClose} title="Funga"><X size={15} /></button>}
      </div>

      {tab === "work" && (
        <>
          <div className="xl-pc__status">
            {showDraft ? (
              <>
                <span className="xl-pc__app is-live"><KindIcon kind={draft.name === "write_file" ? "write" : "bash"} size={13} /></span>
                <span className="xl-pc__line">
                  <span className="xl-pc__using">XMD anaandaa <b>{draft.name === "write_file" ? "Editor" : "Terminal"}</b></span>
                  <span className="xl-pc__what">{draft.name === "write_file" ? "Anaandika faili" : "Anaandika amri"} · <code>{draft.preview.split("/ws/").pop()}</code></span>
                </span>
                <Spinner />
              </>
            ) : cur ? (
              <>
                <span className={`xl-pc__app ${live ? "is-live" : ""}`}><KindIcon kind={cur.kind} size={13} /></span>
                <span className="xl-pc__line">
                  <span className="xl-pc__using">XMD {live ? "anatumia" : "alitumia"} <b>{TOOLNAME[cur.kind] ?? "Terminal"}</b></span>
                  <span className="xl-pc__what">{execLabel(cur, live)} · <code>{(cur.command ?? cur.path ?? "").split("/ws/").pop()}</code></span>
                </span>
                {live ? <><Spinner /><Elapsed start={cur.startTs} live /></> : cur.status === "fail" ? <span className="xl-badge xl-badge--fail">exit {cur.exit ?? "×"}</span> : null}
              </>
            ) : <span className="xl-pc__empty">Hakuna kitendo bado — kazi ikianza, kila amri itaonekana hapa moja kwa moja.</span>}
          </div>
          <div className="xl-pc__screen">
            {showDraft ? (
              draft.name === "write_file"
                ? <div className="xl-big-code is-writing"><div className="xl-big-code__tab">{draft.preview.split("/").pop()}</div><DraftCode text={draft.content ?? ""} max={100000} /></div>
                : <TermBody draft={draft.preview} max={100000} />
            ) : cur ? <BigView key={cur.id + cur.runId} x={cur} /> : (
              <div className="xl-pc__idle"><Monitor size={36} strokeWidth={1.2} /><span>Kompyuta iko tayari</span></div>
            )}
          </div>
          <div className="xl-pc__scrub">
            <button className="xl-iconbtn" disabled={pos <= 0} onClick={() => go(pos - 1)}><ChevronLeft size={15} /></button>
            <input type="range" min={0} max={Math.max(0, execs.length - 1)} value={Math.max(0, pos)}
              onChange={(e) => go(+e.target.value)} disabled={execs.length < 2} aria-label="Rudi nyuma kwenye vitendo" />
            <button className="xl-iconbtn" disabled={following} onClick={() => go(pos + 1)}><ChevronRight size={15} /></button>
            <span className="xl-pc__count">{execs.length ? pos + 1 : 0}/{execs.length}</span>
            <button className={`xl-live ${following ? "is-on" : ""}`} onClick={() => setFocusId(null)}>
              <Radio size={12} /> Moja kwa moja
            </button>
          </div>
        </>
      )}

      {tab === "site" && site && threadId && (
        <div className="xl-pc__site">
          <div className="xl-page__bar">
            <span className="xl-page__dot" /><span>/ws/{threadId}/{site}</span>
            <button className="xl-iconbtn" onClick={() => setBust((b) => b + 1)} title="Pakia upya"><RotateCw size={13} /></button>
            <a className="xl-iconbtn" href={`/ws/${threadId}/${site}`} target="_blank" rel="noreferrer" title="Fungua">↗</a>
          </div>
          <iframe key={bust + site} src={`/ws/${threadId}/${site}?v=${bust}`} title="site preview" />
        </div>
      )}
    </aside>
  );
}
