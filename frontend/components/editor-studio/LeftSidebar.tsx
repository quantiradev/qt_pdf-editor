"use client";
import {
  Copy, FilePlus2, ListTree, RotateCcw, RotateCw, Trash2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useEditor } from "@/lib/store";

export default function LeftSidebar() {
  const s = useEditor();
  return (
    <div className="sidebar-l">
      <div className="side-tabs">
        <button
          className={`side-tab ${s.leftTab === "pages" ? "active" : ""}`}
          onClick={() => s.set({ leftTab: "pages" })}
        >Pages</button>
        <button
          className={`side-tab ${s.leftTab === "outline" ? "active" : ""}`}
          onClick={() => s.set({ leftTab: "outline" })}
        >Outline</button>
      </div>
      {s.leftTab === "pages" ? <PagesTab /> : <OutlineTab />}
    </div>
  );
}

/* ------------------------------------------------ pages (thumbnails) */

function PagesTab() {
  const s = useEditor();
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const dragFrom = useRef<number | null>(null);
  const [dragOver, setDragOver] = useState<{ pno: number; after: boolean } | null>(null);

  const pages = s.pageSizes.length;
  const sel = s.selectedPages;
  const targets = sel.length ? sel : [s.currentPage];

  const clickThumb = (pno: number, e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      s.set({
        selectedPages: sel.includes(pno)
          ? sel.filter((p) => p !== pno)
          : [...sel, pno],
      });
    } else if (e.shiftKey && sel.length) {
      const anchor = sel[0];
      const [lo, hi] = [Math.min(anchor, pno), Math.max(anchor, pno)];
      s.set({ selectedPages: Array.from({ length: hi - lo + 1 }, (_, i) => lo + i) });
    } else {
      s.set({ selectedPages: [pno] });
      s.gotoPage(pno);
    }
  };

  const drop = async (target: number, after: boolean) => {
    const from = dragFrom.current;
    dragFrom.current = null;
    setDragOver(null);
    if (from === null) return;
    let to = after ? target + 1 : target;
    if (from < to) to -= 1;
    if (to === from) return;
    const order = Array.from({ length: pages }, (_, i) => i);
    order.splice(from, 1);
    order.splice(to, 0, from);
    await s.runOp("Reordering pages", () => api.reorderPages(s.fileId!, order));
    s.set({ selectedPages: [to] });
  };

  const op = {
    rotate: (deg: number) =>
      s.runOp("Rotating pages", () => api.rotatePages(s.fileId!, targets, deg)),
    duplicate: () =>
      s.runOp("Duplicating pages", () => api.duplicatePages(s.fileId!, targets)),
    remove: () => {
      if (targets.length >= pages) { s.toast("Cannot delete every page", "error"); return; }
      if (!confirm(`Delete page${targets.length > 1 ? "s" : ""} ${targets.map((p) => p + 1).join(", ")}?`)) return;
      s.runOp("Deleting pages", () => api.deletePages(s.fileId!, targets))
        .then((ok) => ok && s.set({ selectedPages: [] }));
    },
    extract: async () => {
      if (!(await s.ensureSaved())) return;
      try {
        const meta = await api.extractPages(s.fileId!, targets);
        s.toast(`Created "${meta.name}" in your library`, "success");
      } catch (e: any) {
        s.toast(`Extract failed: ${e.message}`, "error");
      }
    },
  };

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("contextmenu", close);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("contextmenu", close);
    };
  }, [menu]);

  return (
    <>
      {!s.previewMode && (
        <div className="page-ops-bar">
          <button className="icon-btn" title="Rotate left 90°" onClick={() => op.rotate(-90)}><RotateCcw size={15} /></button>
          <button className="icon-btn" title="Rotate right 90°" onClick={() => op.rotate(90)}><RotateCw size={15} /></button>
          <button className="icon-btn" title="Duplicate page(s)" onClick={op.duplicate}><Copy size={15} /></button>
          <button className="icon-btn" title="Extract page(s) to a new PDF" onClick={op.extract}><FilePlus2 size={15} /></button>
          <button className="icon-btn" title="Delete page(s)" onClick={op.remove}><Trash2 size={15} /></button>
        </div>
      )}
      <div className="side-body">
        {Array.from({ length: pages }, (_, pno) => (
          <div
            key={pno}
            className={[
              "thumb",
              sel.includes(pno) ? "sel" : "",
              s.currentPage === pno ? "current" : "",
              dragOver?.pno === pno ? (dragOver.after ? "drag-over-bottom" : "drag-over-top") : "",
            ].join(" ")}
            draggable={!s.previewMode}
            onClick={(e) => clickThumb(pno, e)}
            onContextMenu={(e) => {
              e.preventDefault();
              if (s.previewMode) return;
              if (!sel.includes(pno)) s.set({ selectedPages: [pno] });
              setMenu({ x: e.clientX, y: e.clientY });
            }}
            onDragStart={(e) => {
              if (s.previewMode) return;
              dragFrom.current = pno;
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragOver={(e) => {
              if (s.previewMode) return;
              e.preventDefault();
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
              setDragOver({ pno, after: e.clientY > rect.top + rect.height / 2 });
            }}
            onDragLeave={() => {
              if (s.previewMode) return;
              setDragOver((d) => (d?.pno === pno ? null : d));
            }}
            onDrop={(e) => {
              if (s.previewMode) return;
              e.preventDefault();
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
              drop(pno, e.clientY > rect.top + rect.height / 2);
            }}
          >
            <Thumb pno={pno} />
            <div className="tno">{pno + 1}</div>
          </div>
        ))}
      </div>

      {menu && (
        <div className="ctx-menu" style={{ left: menu.x, top: menu.y }}>
          <button onClick={() => op.rotate(-90)}><RotateCcw size={15} /> Rotate left</button>
          <button onClick={() => op.rotate(90)}><RotateCw size={15} /> Rotate right</button>
          <button onClick={op.duplicate}><Copy size={15} /> Duplicate</button>
          <button onClick={op.extract}><FilePlus2 size={15} /> Extract to new PDF</button>
          <hr />
          <button className="danger" onClick={op.remove}><Trash2 size={15} /> Delete page{targets.length > 1 ? "s" : ""}</button>
        </div>
      )}
    </>
  );
}

const THUMB_W = 158;

function Thumb({ pno }: { pno: number }) {
  const epoch = useEditor((s) => s.pageEpochs[pno] ?? 0);
  const size = useEditor((s) => s.pageSizes[pno]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    let task: any = null;
    (async () => {
      // read the latest doc at render time; the epoch dep decides *when*
      const doc = useEditor.getState().doc;
      if (!doc || !canvasRef.current) return;
      try {
        const page = await doc.getPage(pno + 1);
        if (cancelled) return;
        const base = page.getViewport({ scale: 1 });
        const scale = (THUMB_W / base.width) * (window.devicePixelRatio > 1 ? 1.6 : 1);
        const vp = page.getViewport({ scale });
        // offscreen render + blit: thumbnails update without flicker
        const off = document.createElement("canvas");
        off.width = vp.width;
        off.height = vp.height;
        // intent "print" avoids rAF scheduling (suspended in hidden tabs)
        task = page.render({
          canvasContext: off.getContext("2d")!, viewport: vp, intent: "print",
        });
        await task.promise;
        const canvas = canvasRef.current;
        if (cancelled || !canvas) return;
        canvas.width = off.width;
        canvas.height = off.height;
        canvas.getContext("2d")!.drawImage(off, 0, 0);
      } catch {}
    })();
    return () => { cancelled = true; task?.cancel?.(); };
  }, [epoch, pno]);

  const ratio = size ? size.h / size.w : 1.3;
  return <canvas ref={canvasRef} style={{ width: "100%", aspectRatio: `1 / ${ratio}` }} />;
}

/* ------------------------------------------------ outline */

function OutlineTab() {
  const s = useEditor();
  if (!s.outline.length) {
    return (
      <div className="side-body">
        <div style={{ color: "var(--faint)", textAlign: "center", padding: "26px 8px", lineHeight: 1.5 }}>
          <ListTree size={22} style={{ marginBottom: 8 }} />
          <div>No headings detected in this document.</div>
        </div>
      </div>
    );
  }
  return (
    <div className="side-body">
      {s.outline.map((item, i) => (
        <button
          key={i} className="outline-item"
          style={{ paddingLeft: 8 + (item.level - 1) * 14 }}
          onClick={() => s.gotoPage(item.page)}
          title={`Go to page ${item.page + 1}`}
        >
          {item.title}
          <span className="op">p.{item.page + 1}</span>
        </button>
      ))}
    </div>
  );
}
