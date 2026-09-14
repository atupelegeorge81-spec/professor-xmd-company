import { useEffect, useRef, useState } from "react";
import type { ReportDoc } from "@/lib/types";
import { Markdown } from "./Markdown";

export function ReportsDashboard() {
  const [reports, setReports] = useState<ReportDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<ReportDoc | null>(null);
  const [printReport, setPrintReport] = useState<ReportDoc | null>(null);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragStartY = useRef<number | null>(null);

  const load = () => {
    fetch("/api/reports")
      .then((r) => r.json())
      .then((d) => {
        setReports(d.reports || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const iv = setInterval(load, 5000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (!printReport) return;
    const t = setTimeout(() => window.print(), 400);
    const clear = () => setPrintReport(null);
    window.addEventListener("afterprint", clear);
    return () => {
      clearTimeout(t);
      window.removeEventListener("afterprint", clear);
    };
  }, [printReport]);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  const handleSheetPointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
  ) => {
    dragStartY.current = e.clientY
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const finishSheetDrag = (
    e: React.PointerEvent<HTMLDivElement>,
  ) => {
    if (!dragging) return;

    const delta = Math.max(0, e.clientY - dragStartY.current!);

    setDragging(false);

    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }

    if (delta > 110) {
      setOpen(null);
      setDragY(0);
      return;
    }

    setDragY(0);
  };

  const handleSheetPointerMove = (
    e: React.PointerEvent<HTMLDivElement>,
  ) => {
    if (!dragging) return;

    const delta = Math.max(0, e.clientY - dragStartY.current!);
    setDragY(Math.min(delta, 280));
  };

  const handleContentPointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
  ) => {
    const scroll = scrollRef.current;
    if (!scroll || scroll.scrollTop > 0) return;

    dragStartY.current = e.clientY
  };

  const handleContentPointerMove = (
    e: React.PointerEvent<HTMLDivElement>,
  ) => {
    const scroll = scrollRef.current;
    if (!scroll) return;

    const delta = e.clientY - dragStartY.current!;

    if (!dragging && scroll.scrollTop <= 0 && delta > 8) {
      setDragging(true);
      e.currentTarget.setPointerCapture(e.pointerId);
    }

    if (dragging || (scroll.scrollTop <= 0 && delta > 8)) {
      e.preventDefault();
      setDragY(Math.min(Math.max(0, delta), 280));
    }
  };

  const handleContentPointerUp = (
    e: React.PointerEvent<HTMLDivElement>,
  ) => {
    if (dragging) {
      finishSheetDrag(e);
    }
  };

  return (
    <div className="scroll-thin min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-[22px] font-bold text-foreground">Board reports</h2>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Full Swahili reports written by Optimus after each board discussion.
            </p>
          </div>
          <button
            onClick={load}
            className="shrink-0 rounded-full border border-border bg-secondary/40 px-3.5 py-1.5 text-[11.5px] text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="grid gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="glass h-[76px] animate-pulse rounded-2xl" style={{ animationDelay: `${i * 120}ms` }} />
            ))}
          </div>
        ) : reports.length === 0 ? (
          <div className="glass rounded-3xl p-10 text-center">
            <p className="text-3xl">📑</p>
            <p className="mt-3 font-display text-[15px] font-semibold text-foreground">No reports yet</p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Open the Board Room, drop a project on the table, and Optimus files the report here.
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {reports.map((r, i) => (
              <div
                key={r.id}
                style={{ animationDelay: `${i * 45}ms` }}
                className="rise-in glass panel-hover flex min-w-0 items-center gap-4 rounded-2xl px-4 py-3.5"
              >
                <button onClick={() => setOpen(r)} className="flex min-w-0 flex-1 items-center gap-4 text-left">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-signal/15 text-xl">📑</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-display text-[14px] font-semibold text-foreground">{r.title}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {r.agents} · {new Date(r.created_at).toLocaleString("en-GB")}
                    </span>
                  </span>
                </button>
                <button
                  onClick={() => setPrintReport(r)}
                  className="shrink-0 rounded-full border border-accent/35 bg-accent/10 px-2.5 py-1 text-[10.5px] font-semibold text-accent transition hover:bg-accent/20"
                >
                  PDF
                </button>
                <button
                  onClick={() => setOpen(r)}
                  className="shrink-0 rounded-full border border-primary/35 bg-primary/10 px-2.5 py-1 text-[10.5px] font-semibold text-primary transition hover:bg-primary/20"
                >
                  Read
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {open && (
        <div
          className="fixed inset-x-0 bottom-0 z-50 flex items-end justify-center bg-background/80 backdrop-blur-sm sm:items-center" style={{ top: "var(--app-header-h, 0px)" }}
          onClick={() => setOpen(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              transform: `translateY(${dragY}px)`,
              transition: dragging ? "none" : "transform 180ms ease-out",
            }}
            className="sheet-up glass-strong flex h-full w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl sm:h-[86vh] sm:rounded-3xl"
          >
            <div
              className="mx-auto mt-2 h-1 w-10 cursor-grab touch-none rounded-full bg-white/20 active:cursor-grabbing"
              onPointerDown={handleSheetPointerDown}
              onPointerMove={handleSheetPointerMove}
              onPointerUp={finishSheetDrag}
              onPointerCancel={finishSheetDrag}
            />

            <div className="flex items-center justify-between gap-3 border-b border-border bg-signal/[0.08] px-5 py-4">
              <div className="min-w-0">
                <h3 className="truncate font-display text-[15px] font-bold text-foreground">{open.title}</h3>
                <p className="truncate text-[11px] text-muted-foreground">{open.agents}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  onClick={() => setPrintReport(open)}
                  className="rounded-lg bg-accent/15 px-3 py-1.5 text-[11px] text-accent transition hover:bg-accent/25"
                >
                  PDF
                </button>
                <button
                  onClick={() => navigator.clipboard.writeText(open.content)}
                  className="rounded-lg bg-secondary/60 px-3 py-1.5 text-[11px] text-muted-foreground transition hover:text-foreground"
                >
                  Copy
                </button>
                <button
                  onClick={() => setOpen(null)}
                  className="rounded-lg bg-secondary/60 px-3 py-1.5 text-[11px] text-muted-foreground transition hover:text-foreground"
                >
                  ✕
                </button>
              </div>
            </div>
            <div
              ref={scrollRef}
              data-report-content
              className="scroll-thin flex-1 overflow-y-auto overscroll-contain px-6 py-5"
              onPointerDown={handleContentPointerDown}
              onPointerMove={handleContentPointerMove}
              onPointerUp={handleContentPointerUp}
              onPointerCancel={handleContentPointerUp}
            >
              <Markdown text={open.content} />
            </div>
          </div>
        </div>
      )}

      {printReport && (
        <div id="print-sheet">
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>{printReport.title}</h1>
          <Markdown text={printReport.content} />
        </div>
      )}
    </div>
  );
}
