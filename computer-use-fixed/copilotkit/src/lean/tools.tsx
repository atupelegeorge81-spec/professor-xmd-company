import { useState } from "react";
import { ChevronRight, ExternalLink, Copy, Check as CheckIcon } from "lucide-react";
import type { Exec, Step } from "./model";
import { execLabel, fmtMs } from "./model";
import { Caret, Elapsed, KindIcon, Spinner, useStickToBottom } from "./ui";

// --------------------------------------------------------------- parsers
export interface SearchHit { n: number; title: string; url: string; snippet: string }
export function parseSearch(out: string): SearchHit[] {
  const hits: SearchHit[] = [];
  const lines = out.split("\n");
  for (let k = 0; k < lines.length; k++) {
    const m = lines[k].match(/^(\d+)\.\s+(.*?)\s+—\s+(\S+)\s*$/);
    if (m) {
      const snip = (lines[k + 1] || "").trim();
      hits.push({ n: +m[1], title: m[2], url: m[3], snippet: /^\d+\./.test(snip) ? "" : snip });
    }
  }
  return hits;
}
export function parsePage(out: string) {
  const [first = "", second = "", ...rest] = out.split("\n");
  return {
    title: first.replace(/^#\s*/, ""),
    meta: second,
    url: second.split(" · ")[0],
    body: rest.join("\n").trim(),
  };
}
const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };
const OK_URL = /^OK\s+(\S+)(?:\s+(\S+))?/m;

function searchQuery(cmd = "") {
  const m = cmd.match(/xmd-search\s+(["'])(.*?)\1/) || cmd.match(/xmd-search\s+(.*)/);
  return m ? (m[2] ?? m[1]) : cmd;
}
function argAfter(cmd = "", word: string) {
  const m = cmd.match(new RegExp(word + "\\s+(\\S+)"));
  return m ? m[1].replace(/^["']|["']$/g, "") : "";
}

// --------------------------------------------------------------- live terminal
export function TermBody({ x, max = 260, draft }: { x?: Exec; max?: number; draft?: string }) {
  const out = x?.output ?? "";
  const live = !x || x.status === "running";
  const ref = useStickToBottom<HTMLDivElement>(out.length, true);
  const cmd = x?.command ?? draft ?? "";
  return (
    <div className="xl-term" ref={ref} style={{ maxHeight: max }}>
      <div className="xl-term__cmd">
        <span className="xl-term__ps">$</span>
        <span className="xl-term__cmdtxt">{cmd}</span>
        {!x && <Caret />}
      </div>
      {out && <pre className="xl-term__out">{out.length > 60_000 ? "…" + out.slice(-60_000) : out}</pre>}
      {x && live && !out && <div className="xl-term__wait"><span className="xl-dots"><i /><i /><i /></span></div>}
      {x && live && out && <Caret />}
    </div>
  );
}

function CodeView({ text, max = 280, live }: { text: string; max?: number; live?: boolean }) {
  const lines = text.replace(/\n$/, "").split("\n");
  const shown = lines.slice(0, 400);
  return (
    <div className={`xl-code ${live ? "is-writing" : ""}`} style={{ maxHeight: max }}>
      <table>
        <tbody>
          {shown.map((l, k) => (
            <tr key={k}>
              <td className="xl-code__ln">{k + 1}</td>
              <td className="xl-code__tx">{l || " "}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {lines.length > shown.length && <div className="xl-code__more">+{lines.length - shown.length} mistari zaidi</div>}
    </div>
  );
}

function CopyBtn({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button className="xl-iconbtn" title="Nakili" onClick={(e) => {
      e.stopPropagation();
      navigator.clipboard?.writeText(text).then(() => { setOk(true); setTimeout(() => setOk(false), 1200); });
    }}>
      {ok ? <CheckIcon size={13} /> : <Copy size={13} />}
    </button>
  );
}

// --------------------------------------------------------------- card shell
function Card({ x, title, sub, right, children, defaultOpen, onFocus, accent }: {
  x: Exec; title: string; sub?: string; right?: React.ReactNode; children?: React.ReactNode;
  defaultOpen?: boolean; onFocus?: (x: Exec) => void; accent?: string;
}) {
  const live = x.status === "running";
  const [open, setOpen] = useState<boolean | null>(null);
  const isOpen = open ?? (defaultOpen ?? live);
  return (
    <div className={`xl-card xl-card--${x.kind} ${live ? "is-live" : ""} ${x.status === "fail" ? "is-fail" : ""}`} data-accent={accent}>
      {live && <span className="xl-scan" aria-hidden />}
      <div className="xl-card__head" onClick={() => setOpen(!isOpen)} role="button" tabIndex={0}>
        <span className="xl-card__icon"><KindIcon kind={x.kind} /></span>
        <span className="xl-card__title">{title}</span>
        {sub && <span className="xl-card__sub">{sub}</span>}
        <span className="xl-card__right">
          {right}
          {live ? <Spinner /> : x.status === "fail"
            ? <span className="xl-badge xl-badge--fail">exit {x.exit ?? "×"}</span>
            : <span className="xl-card__ms">{fmtMs(x.ms ?? (x.endTs ?? x.startTs) - x.startTs)}</span>}
          {live && <span className="xl-card__ms"><Elapsed start={x.startTs} live /></span>}
          {onFocus && (
            <button className="xl-iconbtn" title="Fungua kwenye Kompyuta ya XMD" onClick={(e) => { e.stopPropagation(); onFocus(x); }}>
              <ExternalLink size={13} />
            </button>
          )}
          <ChevronRight size={14} className={`xl-chev ${isOpen ? "is-open" : ""}`} />
        </span>
      </div>
      {isOpen && <div className="xl-card__body">{children}</div>}
    </div>
  );
}

// --------------------------------------------------------------- per-tool renders
export function ToolView({ x, onFocus }: { x: Exec; onFocus?: (x: Exec) => void }) {
  const live = x.status === "running";
  const label = execLabel(x, live);
  const name = (p?: string) => (p ? p.split("/").pop() : "");

  switch (x.kind) {
    case "write": {
      const content = x.content ?? "";
      return (
        <Card x={x} title={label} sub={x.path?.split("/ws/").pop()} onFocus={onFocus} defaultOpen={live || content.length < 1400}
          right={!live && <span className="xl-diff"><b className="add">+{x.added ?? x.lines ?? 0}</b>{x.removed ? <b className="del">−{x.removed}</b> : null}</span>}>
          <div className="xl-filebar"><span>{name(x.path)}</span><span>{x.lines ?? content.split("\n").length} mistari</span><CopyBtn text={content} /></div>
          <CodeView text={content} live={live} />
        </Card>
      );
    }
    case "search": {
      const q = searchQuery(x.command);
      const hits = parseSearch(x.output);
      return (
        <Card x={x} title={label} sub={`“${q}”`} onFocus={onFocus} defaultOpen
          right={!live && <span className="xl-badge">{hits.length} matokeo</span>}>
          {live && !hits.length ? (
            <div className="xl-skel"><i /><i /><i /></div>
          ) : hits.length ? (
            <ol className="xl-hits">
              {hits.map((h) => (
                <li key={h.n} className="xl-in">
                  <a href={h.url} target="_blank" rel="noreferrer">
                    <span className="xl-hits__fav">{host(h.url).slice(0, 1).toUpperCase()}</span>
                    <span className="xl-hits__main">
                      <span className="xl-hits__title">{h.title}</span>
                      <span className="xl-hits__host">{host(h.url)}</span>
                      {h.snippet && <span className="xl-hits__snip">{h.snippet}</span>}
                    </span>
                  </a>
                </li>
              ))}
            </ol>
          ) : <TermBody x={x} />}
        </Card>
      );
    }
    case "browse": {
      const url = argAfter(x.command, "xmd-fetch") || argAfter(x.command, "xmd-browse open") || argAfter(x.command, "curl");
      const pg = parsePage(x.output);
      const isFetch = /xmd-fetch/.test(x.command ?? "");
      return (
        <Card x={x} title={label} sub={host(url || pg.url)} onFocus={onFocus}>
          {isFetch && pg.title ? (
            <div className="xl-page">
              <div className="xl-page__bar"><span className="xl-page__dot" /><span>{pg.url}</span></div>
              <div className="xl-page__title">{pg.title}</div>
              <div className="xl-page__meta">{pg.meta.split(" · ").slice(1, 2).join("")}</div>
              <p className="xl-page__body">{pg.body.slice(0, 900)}{pg.body.length > 900 ? "…" : ""}</p>
            </div>
          ) : <TermBody x={x} />}
        </Card>
      );
    }
    case "check": {
      const line = x.output.trim().split("\n").pop() ?? "";
      const code = line.match(/^(\d{3})/)?.[1];
      return (
        <Card x={x} title={label} sub={argAfter(x.command, "xmd-check") || x.command} onFocus={onFocus} defaultOpen={false}
          right={code && <span className={`xl-badge ${+code < 400 ? "xl-badge--ok" : "xl-badge--fail"}`}>{code}</span>}>
          <TermBody x={x} />
        </Card>
      );
    }
    case "git":
    case "deploy": {
      const ok = x.output.match(OK_URL);
      const link = ok ? (ok[2] || ok[1]) : "";
      return (
        <Card x={x} title={label} sub={x.command} onFocus={onFocus} defaultOpen={live || !ok}>
          {ok && /^https?:/.test(link) && (
            <a className="xl-linkout xl-in" href={link} target="_blank" rel="noreferrer">
              <KindIcon kind={x.kind} /> <span>{link}</span> <ExternalLink size={12} />
            </a>
          )}
          <TermBody x={x} />
        </Card>
      );
    }
    case "skill": {
      const nm = (x.command ?? "").replace(/^skill\s+@?/, "").trim();
      return (
        <div className={`xl-skill ${live ? "is-live" : ""}`}>
          <KindIcon kind="skill" size={12} />
          <span>{live ? "Inapakia skill" : "Skill imepakiwa"}</span>
          <b>@{nm}</b>
          {!live && <span className="xl-skill__n">{x.chars ?? x.output.length} herufi</span>}
        </div>
      );
    }
    case "read": {
      const file = (x.command ?? "").replace(/^(cat|head|tail)(\s+-\S+)*\s+/, "");
      return (
        <Card x={x} title={label} sub={file} onFocus={onFocus} defaultOpen={false}>
          <CodeView text={x.output.replace(/\n?\[exit \d+\]$/, "")} />
        </Card>
      );
    }
    case "map":
    case "list":
      return (
        <Card x={x} title={label} sub={x.command} onFocus={onFocus} defaultOpen={false}>
          <TermBody x={x} />
        </Card>
      );
    case "error":
      return (
        <Card x={x} title={label} sub={x.command} defaultOpen>
          <TermBody x={x} />
        </Card>
      );
    default:
      return (
        <Card x={x} title={label} sub={x.command} onFocus={onFocus} defaultOpen={live || x.status === "fail" || x.output.length < 600}>
          <TermBody x={x} />
        </Card>
      );
  }
}

/** Faili likiandikwa: mistari ya mwisho, inafuata chini, caret mwishoni. */
export function DraftCode({ text, max = 240 }: { text: string; max?: number }) {
  const ref = useStickToBottom<HTMLDivElement>(text.length);
  const lines = text.split("\n");
  return (
    <div className="xl-code is-writing" ref={ref} style={{ maxHeight: max }}>
      <table>
        <tbody>
          {lines.map((l, k) => (
            <tr key={k}>
              <td className="xl-code__ln">{k + 1}</td>
              <td className="xl-code__tx">{l || " "}{k === lines.length - 1 && <Caret />}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Amri inavyoandikwa na model — kabla haijaendeshwa. */
export function DraftView({ d }: { d: NonNullable<Step["draft"]> }) {
  if (d.name === "finish") {
    return <div className="xl-draftline"><span className="xl-dots"><i /><i /><i /></span> Inaandika ripoti ya mwisho…</div>;
  }
  if (d.name === "write_file") {
    return (
      <div className="xl-card xl-card--write is-drafting">
        <span className="xl-scan" aria-hidden />
        <div className="xl-card__head">
          <span className="xl-card__icon"><KindIcon kind="write" /></span>
          <span className="xl-card__title">Inaandika faili</span>
          <span className="xl-card__sub">{d.preview.split("/ws/").pop()}</span>
          <span className="xl-card__right">
            {d.content != null && <span className="xl-card__ms">{d.content.split("\n").length} mistari</span>}
            <Spinner />
          </span>
        </div>
        {d.content ? (
          <div className="xl-card__body"><DraftCode text={d.content} /></div>
        ) : null}
      </div>
    );
  }
  return (
    <div className="xl-card xl-card--bash is-drafting">
      <div className="xl-card__head">
        <span className="xl-card__icon"><KindIcon kind="bash" /></span>
        <span className="xl-card__title">Inaandika amri</span>
        <span className="xl-card__right"><Spinner /></span>
      </div>
      <div className="xl-card__body"><TermBody draft={d.preview} /></div>
    </div>
  );
}
