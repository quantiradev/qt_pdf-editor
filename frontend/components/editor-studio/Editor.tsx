"use client";
import {
  AlertTriangle, ChevronDown, ChevronUp, Loader2, Search, X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { realEdits, useEditor } from "@/lib/store";
import type { Tool } from "@/lib/types";
import CanvasStage from "./CanvasStage";
import LeftSidebar from "./LeftSidebar";
import Modals from "./Modals";
import RightSidebar from "./RightSidebar";
import StatusBar from "./StatusBar";
import Toolbar from "./Toolbar";
import TopBar from "./TopBar";

const TOOL_KEYS: Record<string, Tool> = {
  v: "select", e: "edit-text", f: "form", t: "text", h: "highlight",
  u: "underline", s: "strikeout", p: "pen", x: "eraser", r: "rect", o: "ellipse",
  l: "line", a: "arrow", n: "note", k: "link",
};

export default function Editor({ id }: { id: string }) {
  const s = useEditor();

  useEffect(() => {
    s.set({ previewMode: false });
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      s.set({ leftOpen: false, rightOpen: false });
    }
    s.loadFile(id);
    // expose for debugging / scripted testing in dev
    (window as any).__pdfstore = useEditor;
    return () => {
      // client-side navigation away: push any not-yet-committed edits
      // into the PDF (best effort — the auto-flush usually beat us here).
      // Untouched block sessions are selections, not edits: skip them.
      const st = useEditor.getState();
      const batch = realEdits(st.annots);
      if (st.fileId && batch.length) {
        api.saveAnnotations(st.fileId, batch).catch(() => {});
      }
      st.applyFields(true).catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  // warn about unsaved edits when closing the tab
  useEffect(() => {
    const onUnload = (e: BeforeUnloadEvent) => {
      const st = useEditor.getState();
      const draftDirty = Object.entries(st.formDraft).some(([xref, v]) =>
        st.formFields.some((f) => f.xref === Number(xref) && f.value !== v));
      if (realEdits(st.annots).length || draftDirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const st = useEditor.getState();
      const target = e.target as HTMLElement;
      const typing =
        target.tagName === "INPUT" || target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        st.save();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        st.openSearch();
        return;
      }
      if (typing) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        e.shiftKey ? st.redo() : st.undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault(); st.redo(); return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === "=" || e.key === "+")) {
        e.preventDefault(); st.setZoom(st.zoom * 1.15); return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "-") {
        e.preventDefault(); st.setZoom(st.zoom / 1.15); return;
      }
      if (e.key === "Escape") {
        if (st.modal) st.set({ modal: null });
        else if (st.search.open) st.closeSearch();
        else if (st.editingId) st.set({ editingId: null });
        else if (st.pendingLink) st.set({ pendingLink: null });
        else if (st.selectedId) {
          st.set({ selectedId: null });
          st.scheduleFlush(); // sweeps an untouched block session away
        }
        else st.setTool("select");
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && st.selectedId) {
        e.preventDefault(); st.removeAnnot(st.selectedId); return;
      }
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        const tool = TOOL_KEYS[e.key.toLowerCase()];
        if (tool) { st.setTool(tool); return; }
      }
      // nudge selection with arrows
      if (st.selectedId && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        const a: any = st.annots.find((x) => x.id === st.selectedId);
        if (!a) return;
        e.preventDefault();
        const d = e.shiftKey ? 10 : 1;
        const dx = e.key === "ArrowLeft" ? -d : e.key === "ArrowRight" ? d : 0;
        const dy = e.key === "ArrowUp" ? -d : e.key === "ArrowDown" ? d : 0;
        if (a.type === "ink") {
          st.updateAnnot(a.id, {
            points: a.points.map(([x, y]: number[]) => [x + dx, y + dy]),
          } as any, true);
        } else if (a.type === "line" || a.type === "arrow") {
          st.updateAnnot(a.id, {
            x1: a.x1 + dx, y1: a.y1 + dy, x2: a.x2 + dx, y2: a.y2 + dy,
          } as any, true);
        } else if ("x" in a && "y" in a) {
          st.updateAnnot(a.id, { x: a.x + dx, y: a.y + dy } as any, true);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (s.loadError) {
    return (
      <div className="load-screen">
        <AlertTriangle size={30} color="var(--danger)" />
        <div style={{ color: "var(--text)", fontWeight: 600 }}>Could not open this document</div>
        <div>{s.loadError}</div>
        <Link className="btn" href="/">Back to library</Link>
      </div>
    );
  }
  if (!s.doc || !s.meta) {
    return (
      <div className="load-screen">
        <Loader2 size={28} className="spin" />
        <div>Opening document…</div>
      </div>
    );
  }

  return (
    <div className="editor">
      <TopBar />
      <Toolbar />
      <div className="editor-main" style={{ position: "relative" }}>
        {s.leftOpen && <LeftSidebar />}
        <CanvasStage />
        {s.rightOpen && <RightSidebar />}
        {s.search.open && <SearchBar />}
      </div>
      <StatusBar />
      <Modals />
      <Toasts />
      {s.busy && (
        <div className="busy-veil">
          <Loader2 size={20} className="spin" /> {s.busy}…
        </div>
      )}
    </div>
  );
}

/* ---------------- find in document ---------------- */

function SearchBar() {
  const s = useEditor();
  const { query, matches, index } = s.search;
  const [q, setQ] = useState(query);
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, []);

  const onChange = (v: string) => {
    setQ(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => s.runSearch(v), 220);
  };

  return (
    <div className="search-bar">
      <Search size={14} style={{ color: "var(--muted)", flex: "none" }} />
      <input
        ref={inputRef} className="input" placeholder="Find in document…"
        value={q}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") s.gotoMatch(index + (e.shiftKey ? -1 : 1));
          if (e.key === "Escape") s.closeSearch();
        }}
      />
      <span className="search-count">
        {matches.length
          ? `${index + 1} / ${matches.length}`
          : q.trim().length > 1 ? "0 found" : ""}
      </span>
      <button className="icon-btn" title="Previous match (Shift+Enter)"
        disabled={!matches.length} onClick={() => s.gotoMatch(index - 1)}>
        <ChevronUp size={15} />
      </button>
      <button className="icon-btn" title="Next match (Enter)"
        disabled={!matches.length} onClick={() => s.gotoMatch(index + 1)}>
        <ChevronDown size={15} />
      </button>
      <button className="icon-btn" title="Close (Esc)" onClick={() => s.closeSearch()}>
        <X size={15} />
      </button>
    </div>
  );
}

function Toasts() {
  const toasts = useEditor((s) => s.toasts);
  if (!toasts.length) return null;
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`}>{t.msg}</div>
      ))}
    </div>
  );
}
