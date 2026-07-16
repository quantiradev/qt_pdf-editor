"use client";
import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useEditor } from "@/lib/store";
import { BASE_FONTS, ensureFont, fontCss } from "@/lib/utils";

/**
 * Font-family picker that looks and behaves exactly like the other Menu
 * dropdowns in the toolbar.  No text input — just a button that opens a
 * fixed-positioned panel containing one row per font, each rendered in its own
 * typeface for an instant visual preview.
 */

const labelOf = (v: string) =>
  BASE_FONTS.find((b) => b.value === v)?.label ?? v;

export default function FontPicker({
  value,
  onChange,
  width = 150,
}: {
  value: string;
  onChange: (family: string) => void;
  width?: number;
}) {
  const fetchFonts = useEditor((s) => s.fetchFonts);
  const families = useEditor((s) => s.fontFamilies);

  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  // Fetch Google-Fonts catalogue once on mount
  useEffect(() => { fetchFonts(); }, [fetchFonts]);

  // Close panel when the user clicks outside
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [open]);

  const toggle = () => {
    if (open) { setOpen(false); return; }
    const r = btnRef.current?.getBoundingClientRect();
    if (r) {
      setPos({
        top: r.bottom + 6,
        left: Math.max(6, Math.min(r.left, window.innerWidth - 260)),
      });
    }
    setOpen(true);
  };

  const handleSelect = (v: string) => {
    ensureFont(v);
    onChange(v);
    setOpen(false);
  };

  // Merge base + Google families
  const allFonts = [
    ...BASE_FONTS.map((b) => ({ value: b.value, label: b.label })),
    ...families.map((f) => ({ value: f, label: f })),
  ];

  return (
    <div className="tb-menu" ref={ref}>
      {/* Trigger button — matches Zoom / other Menu buttons in the toolbar */}
      <button
        ref={btnRef}
        className={`tb-btn tb-drop${open ? " active" : ""}`}
        title="Font family"
        style={{ width, justifyContent: "space-between" }}
        onClick={toggle}
      >
        <span
          className="tb-lbl"
          style={{ fontFamily: fontCss(value), maxWidth: width - 28, overflow: "hidden", textOverflow: "ellipsis" }}
        >
          {labelOf(value)}
        </span>
        <ChevronDown size={12} className="tb-caret" />
      </button>

      {open && (
        <div
          className="tb-pop font-picker-pop"
          style={{ top: pos.top, left: pos.left, width: 252 }}
        >
          {allFonts.map((f) => {
            ensureFont(f.value);
            const isSelected = value === f.value;
            return (
              <button
                key={f.value}
                className={`tb-item${isSelected ? " active" : ""}`}
                style={{ fontFamily: fontCss(f.value) }}
                onClick={() => handleSelect(f.value)}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
