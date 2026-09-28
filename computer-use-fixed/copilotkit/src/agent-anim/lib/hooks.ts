import { useEffect, useMemo, useRef, useState } from "react";

/** Ticks while `running` is true and returns elapsed milliseconds. */
export function useElapsed(running: boolean, startedAt?: number, intervalMs = 100): number {
  const start = useRef<number>(startedAt ?? Date.now());
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!running) return;
    start.current = startedAt ?? Date.now();
    setElapsed(Date.now() - start.current);
    const id = window.setInterval(() => setElapsed(Date.now() - start.current), intervalMs);
    return () => window.clearInterval(id);
  }, [running, startedAt, intervalMs]);

  return elapsed;
}

/** Reveals `text` character by character while `active` is true. */
export function useTypewriter(text: string, active: boolean, charsPerSecond = 45): string {
  const [shown, setShown] = useState(active ? "" : text);

  useEffect(() => {
    if (!active) {
      setShown(text);
      return;
    }
    setShown("");
    let index = 0;
    const step = Math.max(16, 1000 / charsPerSecond);
    const id = window.setInterval(() => {
      index += 1;
      setShown(text.slice(0, index));
      if (index >= text.length) window.clearInterval(id);
    }, step);
    return () => window.clearInterval(id);
  }, [text, active, charsPerSecond]);

  return shown;
}

/** Reveals array items one at a time, `every` ms apart, while active. */
export function useStaggeredReveal<T>(items: readonly T[], active: boolean, every = 180): T[] {
  const [count, setCount] = useState(active ? 0 : items.length);

  useEffect(() => {
    if (!active) {
      setCount(items.length);
      return;
    }
    setCount(0);
    let shown = 0;
    const id = window.setInterval(() => {
      shown += 1;
      setCount(shown);
      if (shown >= items.length) window.clearInterval(id);
    }, every);
    return () => window.clearInterval(id);
  }, [items, active, every]);

  return useMemo(() => items.slice(0, count) as T[], [items, count]);
}

/** True after the component has mounted on the client. */
export function useHasMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

/**
 * Anti-flicker "settle" delay for a running -> settled transition (the
 * same trick as the `spin-delay` / `useIsActive` pattern: Jakob Nielsen's
 * response-time research shows a state that appears and disappears in well
 * under ~400-500ms doesn't read as "it worked", it reads as a glitch).
 *
 * OpenHands can resolve a trivial `file_editor create` or a cached
 * `terminal` call in a handful of milliseconds — faster than a human can
 * consciously register the "running" frame. Rather than let the card jump
 * straight to its settled state (which is what made "Creating file..."
 * look like it only ever appears *after* the fact), this hook holds the
 * displayed status at "running" for a minimum duration once it has been
 * shown, so every step is guaranteed at least one visible in-progress
 * frame before it resolves. It never delays the *start* of "running" —
 * only smooths the exit.
 */
export function useSettledStatus<T extends { toString(): string }>(
  status: T,
  isPending: (status: T) => boolean,
  minVisibleMs = 450,
): T {
  const [display, setDisplay] = useState(status);
  const wasPendingRef = useRef(isPending(status));
  const shownAtRef = useRef(Date.now());
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const pendingNow = isPending(status);
    const wasPending = wasPendingRef.current;

    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (pendingNow) {
      if (!wasPending) shownAtRef.current = Date.now();
      wasPendingRef.current = true;
      setDisplay(status);
      return;
    }

    wasPendingRef.current = false;

    if (!wasPending) {
      setDisplay(status);
      return;
    }

    const elapsed = Date.now() - shownAtRef.current;
    const remaining = Math.max(0, minVisibleMs - elapsed);

    if (remaining === 0) {
      setDisplay(status);
    } else {
      timerRef.current = window.setTimeout(() => setDisplay(status), remaining);
    }

    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, minVisibleMs]);

  return display;
}
