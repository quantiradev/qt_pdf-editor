"use client";
import { StickyNote } from "lucide-react";
import { useEffect, useRef } from "react";
import { useEditor } from "@/lib/store";
import type { Annot } from "@/lib/types";
import { FONT_CSS, SNAP_SIZE, clamp, inkBBox, pointsToPath, snapTo } from "@/lib/utils";

/** Renders all pending annotations for one page + selection/drag/resize UX. */
export default function AnnotLayer({ pno, zoom, pageW, pageH }: {
  pno: number; zoom: number; pageW: number; pageH: number;
}) {
  const s = useEditor();
  const annots = s.annots.filter((a) => a.page === pno);
  const drag = useRef<{
    id: string; mode: "move" | "resize" | "endpoint";
    handle?: string; startX: number; startY: number; orig: any;
  } | null>(null);

  /* window-level move/up so drags survive fast pointer movement */
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const st = useEditor.getState();
      const a: any = st.annots.find((x) => x.id === d.id);
      if (!a) return;
      const dx = (e.clientX - d.startX) / zoom;
      const dy = (e.clientY - d.startY) / zoom;
      const sn = (v: number) => snapTo(v, SNAP_SIZE, st.snap);

      if (d.mode === "move") {
        if (a.type === "ink") {
          st.updateAnnot(a.id, {
            points: d.orig.points.map(([x, y]: number[]) => [x + dx, y + dy]),
          } as any);
        } else if (a.type === "line" || a.type === "arrow") {
          st.updateAnnot(a.id, {
            x1: d.orig.x1 + dx, y1: d.orig.y1 + dy,
            x2: d.orig.x2 + dx, y2: d.orig.y2 + dy,
          } as any);
        } else {
          st.updateAnnot(a.id, {
            x: clamp(sn(d.orig.x + dx), -a.w * 0.5, pageW - a.w * 0.5),
            y: clamp(sn(d.orig.y + dy), -10, pageH - 10),
          } as any);
        }
      } else if (d.mode === "endpoint") {
        const patch: any = {};
        if (d.handle === "p1") { patch.x1 = sn(d.orig.x1 + dx); patch.y1 = sn(d.orig.y1 + dy); }
        else { patch.x2 = sn(d.orig.x2 + dx); patch.y2 = sn(d.orig.y2 + dy); }
        st.updateAnnot(a.id, patch);
      } else if (d.mode === "resize") {
        let { x, y, w, h } = d.orig;
        const hd = d.handle!;
        if (hd.includes("e")) w = Math.max(8, sn(d.orig.w + dx));
        if (hd.includes("s")) h = Math.max(8, sn(d.orig.h + dy));
        if (hd.includes("w")) {
          const nx = sn(d.orig.x + dx);
          w = Math.max(8, d.orig.w + (d.orig.x - nx));
          x = d.orig.x + d.orig.w - w;
        }
        if (hd.includes("n")) {
          const ny = sn(d.orig.y + dy);
          h = Math.max(8, d.orig.h + (d.orig.y - ny));
          y = d.orig.y + d.orig.h - h;
        }
        st.updateAnnot(a.id, { x, y, w, h } as any);
      }
    };
    const onUp = () => {
      if (drag.current) {
        drag.current = null;
        useEditor.getState().endInteract();
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [zoom, pageW, pageH]);

  const startDrag = (
    e: React.PointerEvent, a: Annot,
    mode: "move" | "resize" | "endpoint", handle?: string
  ) => {
    if (useEditor.getState().tool !== "select") return;
    e.stopPropagation();
    e.preventDefault();
    const st = useEditor.getState();
    st.set({ selectedId: a.id });
    st.snapshot();
    st.beginInteract(); // pause auto-commit while dragging/resizing
    drag.current = {
      id: a.id, mode, handle,
      startX: e.clientX, startY: e.clientY,
      orig: JSON.parse(JSON.stringify(a)),
    };
  };

  const selectable = s.tool === "select";

  return (
    <div className="annot-layer">
      {/* SVG sub-layer: ink + shapes + lines */}
      <svg
        viewBox={`0 0 ${pageW} ${pageH}`} preserveAspectRatio="none"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible" }}
      >
        {annots.map((a) => {
          if (a.type === "ink") {
            return (
              <path
                key={a.id} d={pointsToPath(a.points)} fill="none"
                stroke={a.color} strokeWidth={a.width} opacity={a.opacity}
                strokeLinecap="round" strokeLinejoin="round"
                className={selectable ? "hit" : ""}
                style={{ cursor: selectable ? "move" : undefined, pointerEvents: selectable ? "stroke" : "none" }}
                onPointerDown={(e) => startDrag(e, a, "move")}
              />
            );
          }
          if (a.type === "rect" || a.type === "ellipse") {
            const common = {
              fill: a.fill ?? "none", fillOpacity: a.fill ? a.opacity * 0.45 : 0,
              stroke: a.stroke, strokeWidth: a.strokeWidth, strokeOpacity: a.opacity,
              className: selectable ? "hit" : "",
              style: {
                cursor: selectable ? "move" : undefined,
                pointerEvents: (selectable ? "visiblePainted" : "none") as any,
              },
              onPointerDown: (e: React.PointerEvent) => startDrag(e, a, "move"),
            };
            return a.type === "rect" ? (
              <rect key={a.id} x={a.x} y={a.y} width={a.w} height={a.h} {...common} />
            ) : (
              <ellipse key={a.id} cx={a.x + a.w / 2} cy={a.y + a.h / 2} rx={a.w / 2} ry={a.h / 2} {...common} />
            );
          }
          if (a.type === "line" || a.type === "arrow") {
            return (
              <g key={a.id}>
                {a.type === "arrow" && (
                  <defs>
                    <marker
                      id={`ah-${a.id}`} viewBox="0 0 10 10" refX="8.5" refY="5"
                      markerWidth="5.5" markerHeight="5.5" orient="auto-start-reverse"
                    >
                      <path d="M 0 0 L 10 5 L 0 10 z" fill={a.stroke} />
                    </marker>
                  </defs>
                )}
                <line
                  x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2}
                  stroke={a.stroke} strokeWidth={a.strokeWidth} opacity={a.opacity}
                  strokeLinecap="round"
                  markerEnd={a.type === "arrow" ? `url(#ah-${a.id})` : undefined}
                  className={selectable ? "hit" : ""}
                  style={{ cursor: selectable ? "move" : undefined, pointerEvents: selectable ? "stroke" : "none", strokeDasharray: undefined }}
                  onPointerDown={(e) => startDrag(e, a, "move")}
                />
                {/* fat invisible hit line for easier grabbing */}
                {selectable && (
                  <line
                    x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2}
                    stroke="transparent" strokeWidth={Math.max(10, a.strokeWidth * 3)}
                    className="hit" style={{ cursor: "move", pointerEvents: "stroke" }}
                    onPointerDown={(e) => startDrag(e, a, "move")}
                  />
                )}
              </g>
            );
          }
          return null;
        })}
      </svg>

      {/* HTML sub-layer: markup rects, text, images, notes, links */}
      {annots.map((a) => <HtmlAnnot key={a.id} a={a} zoom={zoom} startDrag={startDrag} />)}

      {/* selection adornments */}
      {selectable && s.selectedId && (
        <Selection
          a={annots.find((x) => x.id === s.selectedId)}
          zoom={zoom} startDrag={startDrag}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------- HTML annotations */

function HtmlAnnot({ a, zoom, startDrag }: {
  a: Annot; zoom: number;
  startDrag: (e: React.PointerEvent, a: Annot, m: "move" | "resize" | "endpoint", h?: string) => void;
}) {
  const s = useEditor();
  const selectable = s.tool === "select";
  const editing = s.editingId === a.id;

  if (a.type === "highlight" || a.type === "underline" || a.type === "strikeout") {
    return (
      <>
        {a.rects.map((r, i) => {
          const style: React.CSSProperties = {
            left: r.x * zoom, top: r.y * zoom,
            width: r.w * zoom, height: r.h * zoom,
            pointerEvents: selectable ? "auto" : "none",
            cursor: selectable ? "pointer" : undefined,
          };
          if (a.type === "highlight") {
            style.background = a.color;
            style.opacity = a.opacity;
            style.mixBlendMode = "multiply";
          }
          return (
            <div
              key={i} className={`annot-item hit ${s.selectedId === a.id ? "sel-outline" : ""}`}
              style={style}
              onPointerDown={(e) => {
                if (!selectable) return;
                e.stopPropagation();
                s.set({ selectedId: a.id });
              }}
            >
              {a.type === "underline" && (
                <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: Math.max(1.5, 2 * zoom), background: a.color }} />
              )}
              {a.type === "strikeout" && (
                <div style={{ position: "absolute", left: 0, right: 0, top: "45%", height: Math.max(1.5, 2 * zoom), background: a.color }} />
              )}
            </div>
          );
        })}
      </>
    );
  }

  if (a.type === "text" || a.type === "textedit") {
    const base: React.CSSProperties = {
      left: a.x * zoom, top: a.y * zoom,
      width: a.w * zoom, minHeight: a.h * zoom,
      fontSize: a.fontSize * zoom,
      fontFamily: FONT_CSS[a.fontFamily],
      fontWeight: a.bold ? 700 : 400,
      fontStyle: a.italic ? "italic" : "normal",
      textAlign: a.align ?? "left",
      color: a.color, lineHeight: 1.25, whiteSpace: "pre-wrap",
      wordBreak: "break-word",
      pointerEvents: selectable ? "auto" : "none",
    };
    if (editing) {
      return (
        <TextEditorOverlay a={a} style={base} zoom={zoom} />
      );
    }
    return (
      <div
        className={`annot-item ${selectable ? "selectable hit" : ""}`}
        style={base}
        onPointerDown={(e) => selectable && startDrag(e, a, "move")}
        onDoubleClick={(e) => {
          e.stopPropagation();
          s.set({ editingId: a.id, selectedId: a.id });
        }}
        title="Double-click to edit text"
      >
        {a.text || <span style={{ opacity: 0.4 }}>Double-click to type…</span>}
      </div>
    );
  }

  if (a.type === "image") {
    const swap = a.rotate === 90 || a.rotate === 270;
    return (
      <div
        className={`annot-item ${selectable ? "selectable hit" : ""}`}
        style={{
          left: a.x * zoom, top: a.y * zoom, width: a.w * zoom, height: a.h * zoom,
          pointerEvents: selectable ? "auto" : "none", overflow: "hidden",
        }}
        onPointerDown={(e) => selectable && startDrag(e, a, "move")}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={a.src} alt=""
          style={{
            position: "absolute", left: "50%", top: "50%",
            width: swap ? a.h * zoom : a.w * zoom,
            height: swap ? a.w * zoom : a.h * zoom,
            transform: `translate(-50%,-50%) rotate(${a.rotate}deg)`,
            userSelect: "none", pointerEvents: "none",
          }}
          draggable={false}
        />
      </div>
    );
  }

  if (a.type === "note") {
    return (
      <div
        className={`annot-item hit ${s.selectedId === a.id ? "sel-outline" : ""}`}
        style={{
          left: a.x * zoom, top: a.y * zoom,
          pointerEvents: selectable ? "auto" : "none",
          cursor: selectable ? "move" : undefined,
        }}
        onPointerDown={(e) => selectable && startDrag(e, a, "move")}
        onDoubleClick={() => s.set({ rightOpen: true, rightTab: "comments", selectedId: a.id })}
        title={a.text || "Sticky note — double-click to write the comment"}
      >
        <div className="note-pin" style={{ background: a.color, transform: `scale(${Math.max(0.7, zoom)})`, transformOrigin: "top left" }}>
          <StickyNote size={15} />
        </div>
      </div>
    );
  }

  if (a.type === "link") {
    return (
      <div
        className={`annot-item hit link-box ${s.selectedId === a.id ? "sel-outline" : ""}`}
        style={{
          left: a.x * zoom, top: a.y * zoom, width: a.w * zoom, height: a.h * zoom,
          pointerEvents: selectable ? "auto" : "none",
          cursor: selectable ? "move" : undefined,
        }}
        onPointerDown={(e) => selectable && startDrag(e, a, "move")}
      >
        {s.selectedId === a.id && <span className="link-chip">{a.url}</span>}
      </div>
    );
  }
  return null;
}

/* ------------------------------------------------ inline text editing */

function TextEditorOverlay({ a, style, zoom }: {
  a: Extract<Annot, { type: "text" | "textedit" }>;
  style: React.CSSProperties; zoom: number;
}) {
  const s = useEditor();
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  const commit = () => {
    const v = ref.current?.value ?? "";
    if (!v.trim() && a.type === "text") {
      s.removeAnnot(a.id);
    } else {
      const lines = v.split("\n").length;
      s.updateAnnot(a.id, {
        text: v,
        h: Math.max(a.h, lines * a.fontSize * 1.3 + 4),
      } as any, true);
    }
    s.set({ editingId: null });
  };

  return (
    <textarea
      ref={ref}
      className="annot-text-editor"
      defaultValue={a.text}
      style={{
        ...style,
        height: Math.max((style.minHeight as number) ?? 24, 24),
        pointerEvents: "auto",
        background: "transparent",
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape") s.set({ editingId: null });
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) commit();
      }}
      onPointerDown={(e) => e.stopPropagation()}
    />
  );
}

/* ------------------------------------------------ selection handles */

const HANDLES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"] as const;
const CURSORS: Record<string, string> = {
  nw: "nwse-resize", n: "ns-resize", ne: "nesw-resize", e: "ew-resize",
  se: "nwse-resize", s: "ns-resize", sw: "nesw-resize", w: "ew-resize",
};

function Selection({ a, zoom, startDrag }: {
  a: Annot | undefined; zoom: number;
  startDrag: (e: React.PointerEvent, a: Annot, m: "move" | "resize" | "endpoint", h?: string) => void;
}) {
  if (!a) return null;

  if (a.type === "line" || a.type === "arrow") {
    return (
      <>
        {(["p1", "p2"] as const).map((hp) => (
          <div
            key={hp} className="handle"
            style={{
              left: (hp === "p1" ? a.x1 : a.x2) * zoom - 5,
              top: (hp === "p1" ? a.y1 : a.y2) * zoom - 5,
              borderRadius: "50%", cursor: "grab",
            }}
            onPointerDown={(e) => startDrag(e, a, "endpoint", hp)}
          />
        ))}
      </>
    );
  }

  let box: { x: number; y: number; w: number; h: number } | null = null;
  let resizable = false;
  if (a.type === "ink") box = inkBBox(a.points);
  else if (a.type === "note") box = { x: a.x, y: a.y, w: 26 / zoom * Math.max(0.7, zoom), h: 26 / zoom * Math.max(0.7, zoom) };
  else if (a.type === "highlight" || a.type === "underline" || a.type === "strikeout") {
    const xs = a.rects.map((r) => r.x), ys = a.rects.map((r) => r.y);
    const xe = a.rects.map((r) => r.x + r.w), ye = a.rects.map((r) => r.y + r.h);
    box = {
      x: Math.min(...xs), y: Math.min(...ys),
      w: Math.max(...xe) - Math.min(...xs), h: Math.max(...ye) - Math.min(...ys),
    };
  } else if ("w" in a && "h" in a) {
    box = { x: (a as any).x, y: (a as any).y, w: (a as any).w, h: (a as any).h };
    resizable = true;
  }
  if (!box) return null;

  return (
    <>
      <div
        style={{
          position: "absolute",
          left: box.x * zoom - 2, top: box.y * zoom - 2,
          width: box.w * zoom + 4, height: box.h * zoom + 4,
          outline: "1.5px solid var(--accent)", pointerEvents: "none",
          borderRadius: 2,
        }}
      />
      {resizable && HANDLES.map((h) => {
        const cx = h.includes("w") ? box!.x : h.includes("e") ? box!.x + box!.w : box!.x + box!.w / 2;
        const cy = h.includes("n") ? box!.y : h.includes("s") ? box!.y + box!.h : box!.y + box!.h / 2;
        return (
          <div
            key={h} className="handle"
            style={{ left: cx * zoom - 5, top: cy * zoom - 5, cursor: CURSORS[h] }}
            onPointerDown={(e) => startDrag(e, a, "resize", h)}
          />
        );
      })}
    </>
  );
}
