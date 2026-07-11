"use client";
import { AlertTriangle, Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { useEditor } from "@/lib/store";
import CanvasStage from "./CanvasStage";
import LeftSidebar from "./LeftSidebar";
import StatusBar from "./StatusBar";
import PreviewTopBar from "./PreviewTopBar";

export default function Previewer({ id }: { id: string }) {
  const s = useEditor();

  useEffect(() => {
    s.set({ previewMode: true, rightOpen: false, tool: "select" });
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      s.set({ leftOpen: false });
    }
    s.loadFile(id);
    (window as unknown as Record<string, unknown>).__pdfstore = useEditor;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const st = useEditor.getState();
      const target = e.target as HTMLElement;
      const typing =
        target.tagName === "INPUT" || target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      if (typing) return;

      if ((e.ctrlKey || e.metaKey) && (e.key === "=" || e.key === "+")) {
        e.preventDefault(); st.setZoom(st.zoom * 1.15); return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "-") {
        e.preventDefault(); st.setZoom(st.zoom / 1.15); return;
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
      <PreviewTopBar />
      <div className="editor-main">
        {s.leftOpen && <LeftSidebar />}
        <CanvasStage />
      </div>
      <StatusBar />
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
