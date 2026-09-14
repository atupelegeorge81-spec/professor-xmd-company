import { useEffect, useState } from "react";
import type { ConversationDoc } from "@/lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  onNavigate: (v: string) => void;
  activeId?: string | null;
}

const cleanTitle = (t: string) => (t || "").replace(/\s+/g, " ").trim().slice(0, 60) || "Untitled";

export function ChatMenu({ open, onClose, onNavigate, activeId }: Props) {
  const [convs, setConvs] = useState<ConversationDoc[]>([]);
  const [q, setQ] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    fetch("/api/conversations")
      .then((r) => r.json())
      .then((d) => setConvs(d.conversations || []))
      .catch(() => {});
  }, [open]);

  const list = (() => {
    const query = q.trim().toLowerCase();
    if (!query) return convs;
    const tokens = query.split(/[^a-z0-9]+/i).filter((x) => x.length > 1);
    const scored = convs
      .map((c) => {
        const title = cleanTitle(c.title).toLowerCase();
        const hay = `${title} ${(c.project || "").toLowerCase()}`;
        let score = 0;
        if (title.includes(query)) score += 5;
        else if (hay.includes(query)) score += 3;
        for (const tk of tokens) {
          if (title.includes(tk)) score += 2;
          else if (hay.includes(tk)) score += 1;
          if (title.startsWith(tk)) score += 1;
        }
        return { c, score };
      })
      .filter((x) => x.score > 0);
    scored.sort((a, b) => b.score - a.score);
    return scored.map((x) => x.c);
  })();

  const goBoard = (id?: string) => {
    if (id) window.dispatchEvent(new CustomEvent("xmd:open-conv", { detail: id }));
    else window.dispatchEvent(new CustomEvent("xmd:new-conv"));
    onNavigate("board");
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex bg-background/75 backdrop-blur-sm" onClick={onClose}>
      <aside
        onClick={(e) => e.stopPropagation()}
        className="menu-right glass-strong flex h-full w-[88%] max-w-sm flex-col rounded-r-3xl"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="avatar-frame" style={{ width: 34, height: 34 }}>
              <img src="/brand/logo.png" alt="" width={68} height={68} className="avatar-img" />
            </span>
            <span className="truncate font-display text-[14px] font-bold text-foreground">Board Room chats</span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid h-9 w-9 place-items-center rounded-xl text-muted-foreground transition hover:bg-secondary hover:text-foreground"
          >
            ✕
          </button>
        </div>

        <div className="px-3 pt-3">
          <button
            onClick={() => goBoard()}
            className="panel-hover mb-1 flex w-full items-center gap-3 rounded-2xl border border-transparent bg-secondary/30 px-4 py-2.5 text-left text-[14px] font-medium text-foreground"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
            New discussion
          </button>
          <button
            onClick={() => setSearchOpen((s) => !s)}
            className="panel-hover flex w-full items-center gap-3 rounded-2xl border border-transparent bg-secondary/30 px-4 py-2.5 text-left text-[14px] font-medium text-foreground"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="text-primary">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            Search chats
          </button>
        </div>

        {searchOpen && (
          <div className="px-4 pt-3">
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search discussions…"
              className="w-full rounded-full border border-input bg-background/50 px-4 py-2.5 text-[13.5px] text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/50"
            />
          </div>
        )}

        <p className="px-6 pb-1 pt-5 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Recent</p>
        <div className="scroll-thin flex-1 overflow-y-auto px-3 pb-6">
          {list.length === 0 ? (
            <p className="px-4 py-10 text-center text-[13px] text-muted-foreground">
              No discussions{q ? " match that search" : " yet"}.
            </p>
          ) : (
            list.map((c, i) => {
              const active = c.id === activeId;
              return (
                <button
                  key={c.id}
                  onClick={() => goBoard(c.id)}
                  style={{ animationDelay: `${i * 30}ms` }}
                  className={`rise-in mb-1 block w-full truncate rounded-2xl px-4 py-2.5 text-left text-[14px] transition ${
                    active ? "bg-secondary/80 font-medium text-foreground ring-signal" : "text-foreground/80 hover:bg-secondary/40"
                  }`}
                >
                  {cleanTitle(c.title)}
                </button>
              );
            })
          )}
        </div>
      </aside>
    </div>
  );
}
