import { useCallback, useEffect, useRef, useState } from "react";
import { apply, emptyModel, type LeanEvent, type Model } from "./model";

export interface LeanConfig {
  model: string;
  mode: string;
  hasKey: boolean;
  skills: { name: string; description: string }[];
}
export interface ThreadInfo { id: string; title: string; updated: number; active: boolean }

const LS_KEY = "xmd-lean-thread";

function initialThread(): string | null {
  const u = new URL(window.location.href).searchParams.get("t");
  if (u) return u;
  return localStorage.getItem(LS_KEY);
}

/** Muunganiko wa LIVE na server: SSE (replay + live), send, stop. */
export function useLean() {
  const modelRef = useRef<Model>(emptyModel());
  const [, setTick] = useState(0);
  const [threadId, setThreadId] = useState<string | null>(initialThread);
  const [config, setConfig] = useState<LeanConfig | null>(null);
  const [conn, setConn] = useState<"connecting" | "live" | "offline">("connecting");
  const [error, setError] = useState<string | null>(null);
  const [threads, setThreads] = useState<ThreadInfo[]>([]);
  const raf = useRef(0);

  // chora mara moja kwa kila frame hata kama events 100 zimefika
  const schedule = useCallback(() => {
    if (raf.current) return;
    raf.current = requestAnimationFrame(() => {
      raf.current = 0;
      setTick((t) => t + 1);
    });
  }, []);

  useEffect(() => {
    fetch("/api/config").then((r) => r.json()).then(setConfig).catch(() => setConfig(null));
  }, []);

  const refreshThreads = useCallback(() => {
    fetch("/api/threads").then((r) => r.json()).then(setThreads).catch(() => {});
  }, []);
  useEffect(refreshThreads, [refreshThreads]);

  // SSE ya thread
  useEffect(() => {
    modelRef.current = emptyModel();
    schedule();
    if (!threadId) { setConn("live"); return; }
    localStorage.setItem(LS_KEY, threadId);
    const url = new URL(window.location.href);
    if (url.searchParams.get("t") !== threadId) {
      url.searchParams.set("t", threadId);
      window.history.replaceState(null, "", url.toString());
    }
    setConn("connecting");
    let es: EventSource | null = null;
    let closed = false;
    let retry = 0;
    let timer = 0;
    const open = () => {
      if (closed) return;
      const from = modelRef.current.lastI;
      es = new EventSource(`/api/threads/${threadId}/stream?from=${from}`);
      es.onopen = () => { retry = 0; setConn("live"); };
      es.onmessage = (msg) => {
        try {
          const ev = JSON.parse(msg.data) as LeanEvent;
          apply(modelRef.current, ev);
          if (ev.type === "run_end") refreshThreads();
          schedule();
        } catch { /* ignore */ }
      };
      es.onerror = () => {
        es?.close();
        if (closed) return;
        setConn("offline");
        retry = Math.min(retry + 1, 6);
        timer = window.setTimeout(open, 400 * retry);
      };
    };
    open();
    return () => { closed = true; clearTimeout(timer); es?.close(); };
  }, [threadId, schedule, refreshThreads]);

  const send = useCallback(async (task: string) => {
    setError(null);
    const r = await fetch("/api/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threadId, task }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setError(d.error || `HTTP ${r.status}`); return false; }
    if (d.threadId !== threadId) setThreadId(d.threadId);
    refreshThreads();
    return true;
  }, [threadId, refreshThreads]);

  const stop = useCallback(async () => {
    if (!threadId) return;
    await fetch(`/api/threads/${threadId}/stop`, { method: "POST" }).catch(() => {});
  }, [threadId]);

  const newThread = useCallback(() => {
    localStorage.removeItem(LS_KEY);
    const url = new URL(window.location.href);
    url.searchParams.delete("t");
    window.history.replaceState(null, "", url.toString());
    setThreadId(null);
  }, []);

  return {
    model: modelRef.current, threadId, config, conn, error, threads,
    send, stop, newThread, openThread: setThreadId, refreshThreads, setError,
  };
}

/** Saa inayotembea (kwa timers za live) — inasimama isipohitajika. */
export function useNow(active: boolean, every = 100): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(Date.now()), every);
    return () => clearInterval(id);
  }, [active, every]);
  return active ? now : Date.now();
}
