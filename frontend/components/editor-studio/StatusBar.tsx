"use client";
import {
  ChevronLeft, ChevronRight, File as SinglePageIcon, LayoutGrid, Magnet,
  Maximize, MoveHorizontal, Rows3, ZoomIn, ZoomOut,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useEditor } from "@/lib/store";

export default function StatusBar() {
  const s = useEditor();
  const pages = s.meta?.pages ?? 1;
  const [jump, setJump] = useState(String(s.currentPage + 1));

  useEffect(() => setJump(String(s.currentPage + 1)), [s.currentPage]);

  const fit = (mode: "width" | "page") => {
    const el = s.stageEl;
    const size = s.pageSizes[s.currentPage];
    if (!el || !size) return;
    const availW = el.clientWidth - 72;
    const availH = el.clientHeight - 56;
    const z = mode === "width"
      ? availW / size.w
      : Math.min(availW / size.w, availH / size.h);
    s.setZoom(z);
  };

  return (
    <div className="statusbar">
      <div className="page-ind">
        <button className="icon-btn" style={{ width: 24, height: 24 }}
          disabled={s.currentPage <= 0}
          onClick={() => s.gotoPage(s.currentPage - 1)}>
          <ChevronLeft size={15} />
        </button>
        Page
        <input
          className="page-jump" value={jump}
          onChange={(e) => setJump(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const n = parseInt(jump, 10);
              if (!isNaN(n)) s.gotoPage(n - 1);
            }
          }}
          onBlur={() => setJump(String(s.currentPage + 1))}
        />
        of {pages}
        <button className="icon-btn" style={{ width: 24, height: 24 }}
          disabled={s.currentPage >= pages - 1}
          onClick={() => s.gotoPage(s.currentPage + 1)}>
          <ChevronRight size={15} />
        </button>
      </div>

      <div className="divider-v" />

      <button
        className={`icon-btn ${s.viewMode === "continuous" ? "active" : ""}`}
        style={{ width: 26, height: 26 }} title="Continuous scroll"
        onClick={() => s.set({ viewMode: "continuous" })}
      ><Rows3 size={14} /></button>
      <button
        className={`icon-btn ${s.viewMode === "single" ? "active" : ""}`}
        style={{ width: 26, height: 26 }} title="Single page"
        onClick={() => s.set({ viewMode: "single" })}
      ><SinglePageIcon size={14} /></button>

      <div className="divider-v" />

      <button
        className={`icon-btn ${s.showGrid ? "active" : ""}`}
        style={{ width: 26, height: 26 }} title="Toggle layout grid"
        onClick={() => s.set({ showGrid: !s.showGrid })}
      ><LayoutGrid size={14} /></button>
      <button
        className={`icon-btn ${s.snap ? "active" : ""}`}
        style={{ width: 26, height: 26 }} title="Snap to grid (8pt)"
        onClick={() => s.set({ snap: !s.snap })}
      ><Magnet size={14} /></button>

      <div style={{ flex: 1 }} />

      <button className="icon-btn" style={{ width: 26, height: 26 }} title="Fit width"
        onClick={() => fit("width")}><MoveHorizontal size={14} /></button>
      <button className="icon-btn" style={{ width: 26, height: 26 }} title="Fit page"
        onClick={() => fit("page")}><Maximize size={13} /></button>

      <button className="icon-btn" style={{ width: 26, height: 26 }} title="Zoom out"
        onClick={() => s.setZoom(s.zoom / 1.15)}><ZoomOut size={14} /></button>
      <input
        type="range" min={10} max={400} step={5}
        value={Math.round(s.zoom * 100)}
        style={{ width: 110 }}
        onChange={(e) => s.setZoom(Number(e.target.value) / 100)}
      />
      <button className="icon-btn" style={{ width: 26, height: 26 }} title="Zoom in"
        onClick={() => s.setZoom(s.zoom * 1.15)}><ZoomIn size={14} /></button>
      <span className="zoom-pct">{Math.round(s.zoom * 100)}%</span>
    </div>
  );
}
