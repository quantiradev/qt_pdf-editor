"use client";
import { useCallback, useEffect, useRef } from "react";
import { useEditor } from "@/lib/store";
import PageView from "./PageView";

export default function CanvasStage() {
  const s = useEditor();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    s.set({ stageEl: ref.current });
    if (s.doc && s.pageSizes.length > 0 && typeof window !== "undefined") {
      const el = ref.current;
      const size = s.pageSizes[0];
      if (el && size) {
        const isMobile = window.innerWidth < 768;
        const elW = el.clientWidth || window.innerWidth;
        const availW = isMobile ? elW - 16 : elW - 72;
        s.setZoom(availW / size.w);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.doc]);

  // ctrl+wheel zoom, keeping the point under the cursor roughly stable
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const st = useEditor.getState();
      const old = st.zoom;
      const next = Math.min(4, Math.max(0.1, old * (e.deltaY < 0 ? 1.12 : 1 / 1.12)));
      if (next === old) return;
      const rect = el.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const ratio = next / old;
      const sl = (el.scrollLeft + cx) * ratio - cx;
      const stp = (el.scrollTop + cy) * ratio - cy;
      st.setZoom(next);
      requestAnimationFrame(() => { el.scrollLeft = sl; el.scrollTop = stp; });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // track which page is most visible while scrolling (continuous mode)
  const onScroll = useCallback(() => {
    const el = ref.current;
    const st = useEditor.getState();
    if (!el || st.viewMode !== "continuous") return;
    const mid = el.scrollTop + el.clientHeight / 2;
    let best = 0;
    let bestDist = Infinity;
    el.querySelectorAll<HTMLElement>("[data-pno]").forEach((p) => {
      const center = p.offsetTop + p.offsetHeight / 2;
      const d = Math.abs(center - mid);
      if (d < bestDist) { bestDist = d; best = Number(p.dataset.pno); }
    });
    if (best !== st.currentPage) st.set({ currentPage: best });
  }, []);

  const pages = s.pageSizes.length;
  const list =
    s.viewMode === "single"
      ? [s.currentPage]
      : Array.from({ length: pages }, (_, i) => i);

  const handleStageClick = () => {
    const st = useEditor.getState();
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      if (st.leftOpen || st.rightOpen) {
        st.set({ leftOpen: false, rightOpen: false });
      }
    }
  };

  return (
    <div className="stage" ref={ref} onScroll={onScroll} onClick={handleStageClick}>
      <div className="stage-inner">
        {/* keyed by page only: on commits the same canvas re-renders in
            place (offscreen blit), so the document never flashes */}
        {list.map((pno) => (
          <PageView key={pno} pno={pno} />
        ))}
      </div>
    </div>
  );
}
