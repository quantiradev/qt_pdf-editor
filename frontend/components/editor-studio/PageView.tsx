"use client";
import { useEffect, useRef, useState } from "react";
import { getPdfjs } from "@/lib/pdf";
import { useEditor } from "@/lib/store";
import type { Annot, LinkAnnot, Rect, TextBlock } from "@/lib/types";
import { FONT_CSS, GRID_SIZE, SNAP_SIZE, snapTo, uid } from "@/lib/utils";
import AnnotLayer from "./AnnotLayer";

const MARKUP_TOOLS = new Set(["highlight", "underline", "strikeout"]);
const DRAW_TOOLS = new Set(["pen", "rect", "ellipse", "line", "arrow", "link"]);

interface Gesture {
  kind: "pen" | "shape" | "link";
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  points: [number, number][];
}

export default function PageView({ pno }: { pno: number }) {
  const s = useEditor();
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [rendered, setRendered] = useState(false);
  const [gesture, setGesture] = useState<Gesture | null>(null);
  const gestureRef = useRef<Gesture | null>(null);

  const size = s.pageSizes[pno] ?? { w: 612, h: 792 };
  const zoom = s.zoom;
  const W = size.w * zoom;
  const H = size.h * zoom;

  /* ---------- visibility ---------- */
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    // Manual check first: IntersectionObserver callbacks are paused in
    // hidden/background tabs, which would leave pages blank until refocus.
    const check = () => {
      const r = el.getBoundingClientRect();
      if (r.bottom > -700 && r.top < window.innerHeight + 700) setVisible(true);
    };
    check();
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setVisible(true)),
      { root: null, rootMargin: "700px" }
    );
    io.observe(el);
    const onVis = () => check();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  /* ---------- pdf canvas render ---------- */
  useEffect(() => {
    if (!visible || !s.doc) return;
    let cancelled = false;
    let task: any = null;
    (async () => {
      try {
        const page = await s.doc.getPage(pno + 1);
        if (cancelled || !canvasRef.current) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        let scale = zoom * dpr;
        // cap the backing bitmap so 400% zoom doesn't blow up memory
        const cap = 4500;
        const base = page.getViewport({ scale: 1 });
        scale = Math.min(scale, cap / Math.max(base.width, base.height));
        const vp = page.getViewport({ scale });
        // render offscreen, then blit — the previous image stays visible
        // while the updated PDF renders, so commits don't flash white
        const off = document.createElement("canvas");
        off.width = Math.floor(vp.width);
        off.height = Math.floor(vp.height);
        // intent "print": pdf.js then paints via microtasks instead of
        // requestAnimationFrame, which browsers suspend in hidden tabs —
        // otherwise a backgrounded editor never finishes rendering
        task = page.render({
          canvasContext: off.getContext("2d")!, viewport: vp, intent: "print",
        });
        await task.promise;
        if (cancelled || !canvasRef.current) return;
        const canvas = canvasRef.current;
        canvas.width = off.width;
        canvas.height = off.height;
        canvas.getContext("2d")!.drawImage(off, 0, 0);
        setRendered(true);
      } catch {}
    })();
    return () => { cancelled = true; task?.cancel?.(); };
  }, [visible, s.doc, pno, zoom]);

  /* ---------- text layer (for markup selection) ---------- */
  const wantsTextLayer = MARKUP_TOOLS.has(s.tool);
  useEffect(() => {
    if (!visible || !s.doc || !textRef.current) return;
    let cancelled = false;
    let layer: any = null;
    const container = textRef.current;
    container.innerHTML = "";
    (async () => {
      try {
        const pdfjs = await getPdfjs();
        const page = await s.doc.getPage(pno + 1);
        if (cancelled) return;
        const vp = page.getViewport({ scale: zoom });
        container.style.setProperty("--scale-factor", String(zoom));
        layer = new (pdfjs as any).TextLayer({
          textContentSource: page.streamTextContent(),
          container,
          viewport: vp,
        });
        await layer.render();
      } catch {}
    })();
    return () => { cancelled = true; layer?.cancel?.(); container.innerHTML = ""; };
  }, [visible, s.doc, pno, zoom]);

  /* ---------- coordinate helpers ---------- */
  const toPage = (e: { clientX: number; clientY: number }) => {
    const r = wrapRef.current!.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) / zoom,
      y: (e.clientY - r.top) / zoom,
    };
  };
  const maybeSnap = (v: number) => snapTo(v, SNAP_SIZE, useEditor.getState().snap);

  /* ---------- creation gestures ---------- */
  const onPointerDown = (e: React.PointerEvent) => {
    const st = useEditor.getState();
    const tool = st.tool;
    if (e.button !== 0) return;

    if (tool === "text") {
      const p = toPage(e);
      const a: Annot = {
        id: uid(), page: pno, type: "text",
        x: maybeSnap(p.x), y: maybeSnap(p.y), w: 220, h: st.opts.fontSize * 1.6,
        text: "", fontSize: st.opts.fontSize, fontFamily: st.opts.fontFamily,
        color: st.opts.fontColor, bold: st.opts.bold, italic: st.opts.italic,
        align: st.opts.align,
      };
      st.addAnnot(a);
      st.set({ editingId: a.id, tool: "select" });
      return;
    }
    if (tool === "note") {
      const p = toPage(e);
      st.addAnnot({
        id: uid(), page: pno, type: "note", x: p.x - 13, y: p.y - 13,
        text: "", color: st.opts.noteColor, createdAt: Date.now(),
      });
      st.set({ rightOpen: true, rightTab: "comments", tool: "select" });
      return;
    }
    if (!DRAW_TOOLS.has(tool)) return;

    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    st.beginInteract(); // hold off auto-commit while drawing
    const p = toPage(e);
    const g: Gesture = {
      kind: tool === "pen" ? "pen" : tool === "link" ? "link" : "shape",
      x0: maybeSnap(p.x), y0: maybeSnap(p.y),
      x1: maybeSnap(p.x), y1: maybeSnap(p.y),
      points: [[p.x, p.y]],
    };
    gestureRef.current = g;
    setGesture({ ...g });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const g = gestureRef.current;
    if (!g) return;
    const p = toPage(e);
    if (g.kind === "pen") {
      const last = g.points[g.points.length - 1];
      if (Math.hypot(p.x - last[0], p.y - last[1]) > 0.7) {
        g.points.push([p.x, p.y]);
      }
    }
    g.x1 = maybeSnap(p.x);
    g.y1 = maybeSnap(p.y);
    setGesture({ ...g, points: g.points });
  };

  const onPointerUp = () => {
    const g = gestureRef.current;
    gestureRef.current = null;
    setGesture(null);
    if (!g) return;
    const st = useEditor.getState();
    st.endInteract();
    const tool = st.tool;

    if (g.kind === "pen" && g.points.length > 2) {
      st.addAnnot({
        id: uid(), page: pno, type: "ink",
        points: g.points.map(([x, y]) => [x, y] as [number, number]),
        color: st.opts.color, width: st.opts.strokeWidth, opacity: st.opts.opacity,
      }, false);
      return;
    }
    const x = Math.min(g.x0, g.x1), y = Math.min(g.y0, g.y1);
    const w = Math.abs(g.x1 - g.x0), h = Math.abs(g.y1 - g.y0);
    if (g.kind === "link") {
      if (w > 6 && h > 6) st.set({ pendingLink: { page: pno, x, y, w, h } });
      return;
    }
    if (g.kind === "shape") {
      if (tool === "line" || tool === "arrow") {
        if (Math.hypot(g.x1 - g.x0, g.y1 - g.y0) < 4) return;
        st.addAnnot({
          id: uid(), page: pno, type: tool,
          x1: g.x0, y1: g.y0, x2: g.x1, y2: g.y1,
          stroke: st.opts.color, strokeWidth: st.opts.strokeWidth, opacity: st.opts.opacity,
        });
      } else if (w > 4 && h > 4) {
        st.addAnnot({
          id: uid(), page: pno, type: tool as "rect" | "ellipse",
          x, y, w, h,
          stroke: st.opts.color, strokeWidth: st.opts.strokeWidth,
          fill: st.opts.fillColor, opacity: st.opts.opacity,
        });
      }
      st.set({ tool: "select" });
    }
  };

  /* ---------- markup from native text selection ---------- */
  const onMouseUpMarkup = () => {
    const st = useEditor.getState();
    if (!MARKUP_TOOLS.has(st.tool)) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !wrapRef.current) return;
    const pageRect = wrapRef.current.getBoundingClientRect();
    const rects: Rect[] = [];
    for (let i = 0; i < sel.rangeCount; i++) {
      for (const cr of Array.from(sel.getRangeAt(i).getClientRects())) {
        // keep only rects inside this page
        if (cr.bottom < pageRect.top || cr.top > pageRect.bottom) continue;
        if (cr.width < 2 || cr.height < 2) continue;
        const r = {
          x: (cr.left - pageRect.left) / zoom,
          y: (cr.top - pageRect.top) / zoom,
          w: cr.width / zoom,
          h: cr.height / zoom,
        };
        if (r.x < -5 || r.y < -5 || r.x > size.w + 5 || r.y > size.h + 5) continue;
        // merge with previous rect when they overlap on the same line
        const prev = rects[rects.length - 1];
        if (prev && Math.abs(prev.y - r.y) < 2 && r.x <= prev.x + prev.w + 2) {
          prev.w = Math.max(prev.w, r.x + r.w - prev.x);
          prev.h = Math.max(prev.h, r.h);
        } else {
          rects.push(r);
        }
      }
    }
    if (!rects.length) return;
    st.addAnnot({
      id: uid(), page: pno, type: st.tool as "highlight" | "underline" | "strikeout",
      rects, color: st.opts.highlightColor,
      opacity: st.tool === "highlight" ? 0.45 : 1,
    }, false);
    sel.removeAllRanges();
  };

  /* ---------- edit-text blocks ---------- */
  useEffect(() => {
    if (s.tool === "edit-text" && visible) s.fetchTextBlocks(pno);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.tool, visible, pno, s.meta?.version]);

  const cursor =
    s.tool === "pen" ? "crosshair"
      : DRAW_TOOLS.has(s.tool) ? "crosshair"
      : s.tool === "text" || s.tool === "note" ? "copy"
      : "default";

  const blocks = s.textBlocks[pno];

  return (
    <div
      ref={wrapRef}
      className="page-wrap"
      data-pno={pno}
      style={{ width: W, height: H, cursor }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onMouseUp={onMouseUpMarkup}
    >
      {!rendered && <div className="page-loading">…</div>}
      <canvas ref={canvasRef} className="pdf-canvas" style={{ width: W, height: H }} />
      {s.showGrid && (
        <div
          className="page-grid"
          style={{ backgroundSize: `${GRID_SIZE * zoom}px ${GRID_SIZE * zoom}px` }}
        />
      )}
      <div ref={textRef} className={`textLayer ${wantsTextLayer ? "interactive" : ""}`} />

      {s.tool === "edit-text" && Array.isArray(blocks) && (
        <TextBlocksOverlay pno={pno} blocks={blocks} zoom={zoom} />
      )}

      <AnnotLayer pno={pno} zoom={zoom} pageW={size.w} pageH={size.h} />

      {gesture && <GesturePreview g={gesture} zoom={zoom} pageW={size.w} pageH={size.h} />}
      {s.pendingLink?.page === pno && <LinkPopover zoom={zoom} />}
    </div>
  );
}

/* ---------------- live preview while dragging a shape/pen/link ---------------- */

function GesturePreview({ g, zoom, pageW, pageH }: {
  g: Gesture; zoom: number; pageW: number; pageH: number;
}) {
  const st = useEditor.getState();
  const tool = st.tool;
  const stroke = tool === "link" ? "#3b82f6" : st.opts.color;
  const sw = st.opts.strokeWidth;
  const x = Math.min(g.x0, g.x1), y = Math.min(g.y0, g.y1);
  const w = Math.abs(g.x1 - g.x0), h = Math.abs(g.y1 - g.y0);
  return (
    <svg
      className="annot-layer"
      viewBox={`0 0 ${pageW} ${pageH}`}
      style={{ width: "100%", height: "100%", zIndex: 7 }}
      preserveAspectRatio="none"
    >
      {g.kind === "pen" && (
        <polyline
          points={g.points.map((p) => p.join(",")).join(" ")}
          fill="none" stroke={stroke} strokeWidth={sw}
          strokeLinecap="round" strokeLinejoin="round" opacity={0.9}
        />
      )}
      {g.kind === "link" && (
        <rect x={x} y={y} width={w} height={h} fill="rgba(59,130,246,.12)"
          stroke="#3b82f6" strokeWidth={1.2 / zoom} strokeDasharray={`${4 / zoom} ${3 / zoom}`} />
      )}
      {g.kind === "shape" && tool === "rect" && (
        <rect x={x} y={y} width={w} height={h} fill={st.opts.fillColor ?? "none"}
          fillOpacity={0.5} stroke={stroke} strokeWidth={sw} />
      )}
      {g.kind === "shape" && tool === "ellipse" && (
        <ellipse cx={x + w / 2} cy={y + h / 2} rx={w / 2} ry={h / 2}
          fill={st.opts.fillColor ?? "none"} fillOpacity={0.5}
          stroke={stroke} strokeWidth={sw} />
      )}
      {g.kind === "shape" && (tool === "line" || tool === "arrow") && (
        <line x1={g.x0} y1={g.y0} x2={g.x1} y2={g.y1}
          stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
      )}
    </svg>
  );
}

/* ---------------- click-to-edit existing text ---------------- */

function TextBlocksOverlay({ pno, blocks, zoom }: {
  pno: number; blocks: TextBlock[]; zoom: number;
}) {
  const s = useEditor();
  const [editing, setEditing] = useState<number | null>(null);
  const [value, setValue] = useState("");

  // Commits straight into the PDF: the original glyphs are removed from the
  // page content and the new text is inserted — no overlay remains.
  const commit = (block: TextBlock) => {
    setEditing(null);
    if (value === block.text) return;
    s.applyTextEdit({
      id: uid(), page: pno, type: "textedit",
      x: block.x - 1, y: block.y - 1, w: block.w + 2, h: block.h + 2,
      text: value,
      fontSize: block.fontSize, fontFamily: block.fontFamily,
      color: block.color, bold: block.bold, italic: block.italic,
    });
  };

  return (
    <div className="blocks-layer">
      {blocks.map((b, i) => {
        if (editing === i) {
          return (
            <textarea
              key={i} autoFocus
              className="annot-text-editor"
              style={{
                left: b.x * zoom - 2, top: b.y * zoom - 2,
                width: Math.max(120, b.w * zoom + 30),
                height: Math.max(30, b.h * zoom + 16),
                fontSize: b.fontSize * zoom,
                fontFamily: FONT_CSS[b.fontFamily],
                fontWeight: b.bold ? 700 : 400,
                fontStyle: b.italic ? "italic" : "normal",
                color: b.color, lineHeight: 1.25,
              }}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onBlur={() => commit(b)}
              onKeyDown={(e) => {
                if (e.key === "Escape") { e.stopPropagation(); setEditing(null); }
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) commit(b);
              }}
            />
          );
        }
        return (
          <div
            key={i}
            className="text-block-hit"
            title="Click to edit this text"
            style={{ left: b.x * zoom - 2, top: b.y * zoom - 2, width: b.w * zoom + 4, height: b.h * zoom + 4 }}
            onClick={() => { setEditing(i); setValue(b.text); }}
          />
        );
      })}
    </div>
  );
}

/* ---------------- URL prompt after dragging a link area ---------------- */

function LinkPopover({ zoom }: { zoom: number }) {
  const s = useEditor();
  const [url, setUrl] = useState("https://");
  const pl = s.pendingLink!;

  const commit = () => {
    const trimmed = url.trim();
    if (trimmed && trimmed !== "https://") {
      s.addAnnot({
        id: uid(), page: pl.page, type: "link",
        x: pl.x, y: pl.y, w: pl.w, h: pl.h,
        url: /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`,
      });
    }
    s.set({ pendingLink: null, tool: "select" });
  };

  return (
    <>
      <div
        className="link-box"
        style={{
          position: "absolute", left: pl.x * zoom, top: pl.y * zoom,
          width: pl.w * zoom, height: pl.h * zoom, zIndex: 8,
        }}
      />
      <div
        className="link-popover"
        style={{ left: pl.x * zoom, top: (pl.y + pl.h) * zoom + 8 }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <input
          className="input" autoFocus value={url} placeholder="https://example.com"
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") s.set({ pendingLink: null });
          }}
        />
        <button className="btn primary small" onClick={commit}>Add</button>
      </div>
    </>
  );
}
