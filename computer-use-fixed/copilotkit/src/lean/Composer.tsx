import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, Square, Sparkles } from "lucide-react";

export function Composer({ skills, running, onSend, onStop }: {
  skills: { name: string; description: string }[];
  running: boolean;
  onSend: (t: string) => Promise<boolean>;
  onStop: () => void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [sel, setSel] = useState(0);
  const ta = useRef<HTMLTextAreaElement>(null);
  const touch = useMemo(() => window.matchMedia("(pointer: coarse)").matches, []);

  // @mention: neno la mwisho linaloanza na @
  const mention = useMemo(() => {
    const el = ta.current;
    const caret = el?.selectionStart ?? text.length;
    const m = text.slice(0, caret).match(/(^|\s)@([a-z0-9-]*)$/i);
    if (!m) return null;
    const q = m[2].toLowerCase();
    const list = skills.filter((s) => s.name.startsWith(q) || s.description.toLowerCase().includes(q));
    return list.length ? { q, list, start: caret - q.length - 1 } : null;
  }, [text, skills]);

  useEffect(() => setSel(0), [mention?.q]);

  useEffect(() => {
    const el = ta.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }, [text]);

  const pick = (name: string) => {
    if (!mention) return;
    const el = ta.current;
    const caret = el?.selectionStart ?? text.length;
    const next = text.slice(0, mention.start) + "@" + name + " " + text.slice(caret);
    setText(next);
    requestAnimationFrame(() => {
      const p = mention.start + name.length + 2;
      el?.focus();
      el?.setSelectionRange(p, p);
    });
  };

  const submit = async () => {
    const t = text.trim();
    if (!t || busy || running) return;
    setBusy(true);
    const ok = await onSend(t);
    setBusy(false);
    if (ok) setText("");
  };

  return (
    <div className="xl-composer">
      {mention && (
        <div className="xl-mention xl-in" role="listbox">
          {mention.list.map((s, k) => (
            <button key={s.name} className={k === sel ? "is-on" : ""} onMouseDown={(e) => { e.preventDefault(); pick(s.name); }}>
              <Sparkles size={13} /><b>@{s.name}</b><span>{s.description}</span>
            </button>
          ))}
        </div>
      )}
      <div className="xl-composer__box">
        <textarea
          ref={ta}
          value={text}
          rows={1}
          placeholder={touch ? "Mpe XMD kazi… (@ = skill)" : "Mpe XMD kazi…  (andika @ kuchagua skill)"}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (mention) {
              if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => (s + 1) % mention.list.length); return; }
              if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => (s - 1 + mention.list.length) % mention.list.length); return; }
              if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); pick(mention.list[sel].name); return; }
            }
            if (e.key === "Enter" && !e.shiftKey && !touch) { e.preventDefault(); submit(); }
          }}
        />
        {running ? (
          <button className="xl-send xl-send--stop" onClick={onStop} title="Simamisha"><Square size={13} fill="currentColor" /></button>
        ) : (
          <button className="xl-send" onClick={submit} disabled={!text.trim() || busy} title="Tuma"><ArrowUp size={17} /></button>
        )}
      </div>
    </div>
  );
}
