"use client";
import {
  ArrowUpRight, Bold, Circle, Highlighter, Image as ImageIcon, Italic, Link2,
  Minus, MousePointer2, Pencil, PenTool, Square, StickyNote, Strikethrough,
  TextCursorInput, Type, Underline as UnderlineIcon,
} from "lucide-react";
import { useRef } from "react";
import { useEditor } from "@/lib/store";
import type { ImageAnnot, Tool } from "@/lib/types";
import {
  HIGHLIGHT_COLORS, NOTE_COLORS, STROKE_COLORS, TEXT_COLORS, uid,
} from "@/lib/utils";

const TOOLS: { tool: Tool; icon: React.ReactNode; label: string; key: string }[] = [
  { tool: "select", icon: <MousePointer2 size={17} />, label: "Select / move", key: "V" },
  { tool: "edit-text", icon: <TextCursorInput size={17} />, label: "Edit text blocks — move, resize, rotate, retype", key: "E" },
  { tool: "text", icon: <Type size={17} />, label: "Add text box", key: "T" },
  { tool: "highlight", icon: <Highlighter size={17} />, label: "Highlight text", key: "H" },
  { tool: "underline", icon: <UnderlineIcon size={17} />, label: "Underline text", key: "U" },
  { tool: "strikeout", icon: <Strikethrough size={17} />, label: "Strike through text", key: "S" },
  { tool: "pen", icon: <Pencil size={17} />, label: "Draw with pen", key: "P" },
  { tool: "rect", icon: <Square size={17} />, label: "Rectangle", key: "R" },
  { tool: "ellipse", icon: <Circle size={17} />, label: "Ellipse", key: "O" },
  { tool: "line", icon: <Minus size={17} />, label: "Line", key: "L" },
  { tool: "arrow", icon: <ArrowUpRight size={17} />, label: "Arrow", key: "A" },
  { tool: "image", icon: <ImageIcon size={17} />, label: "Insert image", key: "" },
  { tool: "sign", icon: <PenTool size={17} />, label: "Sign document", key: "" },
  { tool: "note", icon: <StickyNote size={17} />, label: "Sticky note", key: "N" },
  { tool: "link", icon: <Link2 size={17} />, label: "Add hyperlink", key: "K" },
];

const GROUP_AFTER = new Set(["select", "text", "strikeout", "pen", "arrow"]);

export default function Toolbar() {
  const s = useEditor();
  const fileRef = useRef<HTMLInputElement>(null);

  const pickImage = () => fileRef.current?.click();

  const onImageChosen = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const src = reader.result as string;
      const img = new Image();
      img.onload = () => {
        const st = useEditor.getState();
        const page = st.currentPage;
        const size = st.pageSizes[page] ?? { w: 612, h: 792 };
        const maxW = size.w * 0.5;
        const scale = Math.min(1, maxW / img.naturalWidth);
        const w = Math.max(24, img.naturalWidth * scale);
        const h = Math.max(24, img.naturalHeight * scale);
        const annot: ImageAnnot = {
          id: uid(), page, type: "image",
          x: (size.w - w) / 2, y: (size.h - h) / 2, w, h,
          src, rotate: 0,
        };
        st.addAnnot(annot);
        st.set({ tool: "select" });
        st.toast("Image placed — drag to position it", "info");
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="toolbar">
      {TOOLS.map(({ tool, icon, label, key }) => (
        <span key={tool} style={{ display: "contents" }}>
          <button
            className={`tool-btn ${s.tool === tool ? "active" : ""}`}
            title={key ? `${label} (${key})` : label}
            onClick={() => {
              if (tool === "image") { s.setTool("image"); pickImage(); }
              else s.setTool(tool);
            }}
          >
            {icon}
          </button>
          {GROUP_AFTER.has(tool) && <div className="divider-v" />}
        </span>
      ))}
      <div className="divider-v" />
      <ContextStrip />
      <input
        ref={fileRef} type="file" accept="image/png,image/jpeg" hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onImageChosen(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}

/* ---- contextual options that follow the active tool / selection ---- */

function ContextStrip() {
  const s = useEditor();
  const sel = s.annots.find((a) => a.id === s.selectedId);

  // A live text block gets its own strip (colors/fonts of existing text are
  // preserved by the engine, so no restyle controls here — just rotation).
  if (sel?.type === "textblock" && (s.tool === "select" || s.tool === "edit-text")) {
    return (
      <div className="ctx-strip">
        <span className="cs-label">Text block</span>
        <span className="cs-label">Rotation</span>
        <input
          className="input" type="number" step={1} min={-180} max={180}
          style={{ width: 64, padding: "5px 6px" }}
          value={Math.round(sel.rotate * 10) / 10}
          onChange={(e) => s.updateAnnot(sel.id, {
            rotate: Math.max(-180, Math.min(180, Number(e.target.value) || 0)),
          } as any, true)}
        />
        {sel.rotate !== 0 && (
          <button className="btn small" onClick={() =>
            s.updateAnnot(sel.id, { rotate: 0 } as any, true)}>
            Straighten
          </button>
        )}
        <span className="cs-label">
          Drag to move · side handles re-wrap the text · double-click to retype
        </span>
      </div>
    );
  }

  // Selection overrides tool: show quick controls for the selected object.
  if (s.tool === "select" && sel) {
    return (
      <div className="ctx-strip">
        <span className="cs-label">Selected: {selLabel(sel.type)}</span>
        {"color" in sel && sel.type !== "note" && (
          <SwatchRow
            colors={sel.type === "highlight" ? HIGHLIGHT_COLORS : TEXT_COLORS}
            value={(sel as any).color}
            onPick={(c) => s.updateAnnot(sel.id, { color: c } as any, true)}
          />
        )}
        {"stroke" in sel && (
          <SwatchRow
            colors={STROKE_COLORS} value={(sel as any).stroke}
            onPick={(c) => s.updateAnnot(sel.id, { stroke: c } as any, true)}
          />
        )}
        {("strokeWidth" in sel || sel.type === "ink") && (
          <WidthSlider
            value={(sel as any).strokeWidth ?? (sel as any).width}
            onChange={(v) =>
              s.updateAnnot(sel.id,
                ("strokeWidth" in sel ? { strokeWidth: v } : { width: v }) as any)}
          />
        )}
        <span className="cs-label">More options in the Properties panel →</span>
      </div>
    );
  }

  switch (s.tool) {
    case "select":
      return <div className="ctx-strip"><span className="cs-label">Click an object to select it · drag to move · Delete to remove</span></div>;
    case "edit-text":
      return (
        <div className="ctx-strip">
          <span className="cs-label">
            Click a text block to pick it up — drag to move, pull the side
            handles to re-wrap, use the knob to rotate, double-click to retype.
            Double-click empty space for a new text box.
          </span>
        </div>
      );
    case "text":
      return (
        <div className="ctx-strip">
          <select
            className="select" style={{ width: 110, padding: "5px 8px" }}
            value={s.opts.fontFamily}
            onChange={(e) => s.setOpts({ fontFamily: e.target.value as any })}
          >
            <option value="helv">Helvetica</option>
            <option value="tiro">Times</option>
            <option value="cour">Courier</option>
          </select>
          <input
            className="input" type="number" min={6} max={96}
            style={{ width: 58, padding: "5px 6px" }}
            value={s.opts.fontSize}
            onChange={(e) => s.setOpts({ fontSize: Number(e.target.value) || 12 })}
          />
          <button
            className={`icon-btn ${s.opts.bold ? "active" : ""}`}
            onClick={() => s.setOpts({ bold: !s.opts.bold })}
          ><Bold size={15} /></button>
          <button
            className={`icon-btn ${s.opts.italic ? "active" : ""}`}
            onClick={() => s.setOpts({ italic: !s.opts.italic })}
          ><Italic size={15} /></button>
          <SwatchRow colors={TEXT_COLORS} value={s.opts.fontColor}
            onPick={(c) => s.setOpts({ fontColor: c })} />
          <span className="cs-label">Click the page to place a text box</span>
        </div>
      );
    case "highlight":
    case "underline":
    case "strikeout":
      return (
        <div className="ctx-strip">
          <SwatchRow colors={HIGHLIGHT_COLORS} value={s.opts.highlightColor}
            onPick={(c) => s.setOpts({ highlightColor: c })} />
          <span className="cs-label">Drag across text on the page, release to apply</span>
        </div>
      );
    case "pen":
      return (
        <div className="ctx-strip">
          <SwatchRow colors={STROKE_COLORS} value={s.opts.color}
            onPick={(c) => s.setOpts({ color: c })} />
          <WidthSlider value={s.opts.strokeWidth}
            onChange={(v) => s.setOpts({ strokeWidth: v })} />
          <span className="cs-label">{s.opts.strokeWidth.toFixed(1)} pt</span>
        </div>
      );
    case "rect":
    case "ellipse":
    case "line":
    case "arrow":
      return (
        <div className="ctx-strip">
          <span className="cs-label">Stroke</span>
          <SwatchRow colors={STROKE_COLORS} value={s.opts.color}
            onPick={(c) => s.setOpts({ color: c })} />
          <WidthSlider value={s.opts.strokeWidth}
            onChange={(v) => s.setOpts({ strokeWidth: v })} />
          {(s.tool === "rect" || s.tool === "ellipse") && (
            <>
              <span className="cs-label">Fill</span>
              <div className="swatch-row">
                <button
                  className={`swatch none ${s.opts.fillColor === null ? "active" : ""}`}
                  title="No fill" onClick={() => s.setOpts({ fillColor: null })}
                />
                {STROKE_COLORS.slice(0, 5).map((c) => (
                  <button key={c} className={`swatch ${s.opts.fillColor === c ? "active" : ""}`}
                    style={{ background: c }} onClick={() => s.setOpts({ fillColor: c })} />
                ))}
              </div>
            </>
          )}
        </div>
      );
    case "image":
      return <div className="ctx-strip"><span className="cs-label">Choose a JPG or PNG — it is placed on the current page</span></div>;
    case "note":
      return (
        <div className="ctx-strip">
          <SwatchRow colors={NOTE_COLORS} value={s.opts.noteColor}
            onPick={(c) => s.setOpts({ noteColor: c })} />
          <span className="cs-label">Click the page to pin a sticky note</span>
        </div>
      );
    case "link":
      return <div className="ctx-strip"><span className="cs-label">Drag a box over text or an image, then enter the URL</span></div>;
    default:
      return null;
  }
}

function selLabel(t: string) {
  const names: Record<string, string> = {
    text: "text box", textblock: "text block", highlight: "highlight",
    underline: "underline", strikeout: "strike-through", ink: "pen stroke",
    rect: "rectangle", ellipse: "ellipse", line: "line", arrow: "arrow",
    image: "image", note: "sticky note", link: "hyperlink",
  };
  return names[t] ?? t;
}

function SwatchRow({ colors, value, onPick }: {
  colors: string[]; value: string; onPick: (c: string) => void;
}) {
  return (
    <div className="swatch-row">
      {colors.map((c) => (
        <button
          key={c} className={`swatch ${value === c ? "active" : ""}`}
          style={{ background: c, border: c === "#ffffff" ? "2px solid #555" : undefined }}
          onClick={() => onPick(c)}
        />
      ))}
    </div>
  );
}

function WidthSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <input
      type="range" min={0.5} max={14} step={0.5} value={value}
      style={{ width: 90 }}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  );
}
