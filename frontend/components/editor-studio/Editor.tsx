"use client";
import { AlertTriangle, Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { api } from "@/lib/api";
import { useEditor } from "@/lib/store";
import type { Tool } from "@/lib/types";
import CanvasStage from "./CanvasStage";
import LeftSidebar from "./LeftSidebar";
import Modals from "./Modals";
import RightSidebar from "./RightSidebar";
import StatusBar from "./StatusBar";
import Toolbar from "./Toolbar";
import TopBar from "./TopBar";

const TOOL_KEYS: Record<string, Tool> = {
  v: "select", e: "edit-text", t: "text", h: "highlight", u: "underline",
  s: "strikeout", p: "pen", r: "rect", o: "ellipse", l: "line", a: "arrow",
  n: "note", k: "link",
};

export default function Editor({ id }: { id: string }) {
  const s = useEditor();

  useEffect(() => {
    s.set({ previewMode: false });
    s.loadFile(id);
    // expose for debugging / scripted testing in dev
    (window as any).__pdfstore = useEditor;
    return () => {
      // client-side navigation away: push any not-yet-committed edits
      // into the PDF (best effort — the auto-flush usually beat us here)
      const st = useEditor.getState();
      if (st.fileId && st.annots.length) {
        api.saveAnnotations(st.fileId, st.annots).catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // warn about unsaved edits when closing the tab
  useEffect(() => {
    const onUnload = (e: BeforeUnloadEvent) => {
      if (useEditor.getState().annots.length) e.preventDefault();
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
        else if (st.editingId) st.set({ editingId: null });
        else if (st.pendingLink) st.set({ pendingLink: null });
        else if (st.selectedId) st.set({ selectedId: null });
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
      <div className="editor-main">
        {s.leftOpen && <LeftSidebar />}
        <CanvasStage />
        {s.rightOpen && <RightSidebar />}
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
