"use client";
import {
  AlignCenter, AlignJustify, AlignLeft, AlignRight, ArrowUpRight, Baseline,
  Bold, ChevronDown, ChevronsUpDown, Circle, Droplet, Eraser, FormInput, GitMerge,
  Highlighter, Image as ImageIcon, Italic, LayoutGrid, Link2, Magnet, Maximize,
  Minus, MoreHorizontal, MousePointer2, MoveHorizontal, PaintBucket, Palette,
  Pencil, PenTool, Plus, Redo2, Rows3, Scissors, Shapes, Square, Stamp,
  StickyNote, Strikethrough, TextCursorInput, Type, Underline as UnderlineIcon,
  Undo2, File as SinglePageIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useEditor } from "@/lib/store";
import type { Tool } from "@/lib/types";
import {
  HIGHLIGHT_COLORS, NOTE_COLORS, STROKE_COLORS, TEXT_COLORS,
} from "@/lib/utils";
import FontPicker from "./FontPicker";

/**
 * Google-Docs-style toolbar: one flat row, no tabs and no group captions.
 * Commands are clustered behind thin dividers, and anything that would need a
 * second row (shapes, alignment, spacing, zoom, page ops) collapses into a
 * dropdown instead.
 */

const ICO = 16;

const T: Record<Tool, { icon: React.ReactNode; label: string; key: string }> = {
  select: { icon: <MousePointer2 size={ICO} />, label: "Select", key: "V" },
  "edit-text": { icon: <TextCursorInput size={ICO} />, label: "Edit text", key: "E" },
  form: { icon: <FormInput size={ICO} />, label: "Fill form", key: "F" },
  text: { icon: <Type size={ICO} />, label: "Text box", key: "T" },
  highlight: { icon: <Highlighter size={ICO} />, label: "Highlight", key: "H" },
  underline: { icon: <UnderlineIcon size={ICO} />, label: "Underline", key: "U" },
  strikeout: { icon: <Strikethrough size={ICO} />, label: "Strikethrough", key: "S" },
  pen: { icon: <Pencil size={ICO} />, label: "Pen", key: "P" },
  eraser: { icon: <Eraser size={ICO} />, label: "Eraser", key: "X" },
  rect: { icon: <Square size={ICO} />, label: "Rectangle", key: "R" },
  ellipse: { icon: <Circle size={ICO} />, label: "Ellipse", key: "O" },
  line: { icon: <Minus size={ICO} />, label: "Line", key: "L" },
  arrow: { icon: <ArrowUpRight size={ICO} />, label: "Arrow", key: "A" },
  image: { icon: <ImageIcon size={ICO} />, label: "Image", key: "" },
  sign: { icon: <PenTool size={ICO} />, label: "Signature", key: "" },
  note: { icon: <StickyNote size={ICO} />, label: "Comment", key: "N" },
  link: { icon: <Link2 size={ICO} />, label: "Link", key: "K" },
};

const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const LINE_STEPS = [1, 1.15, 1.5, 2];

export default function Toolbar() {
  const s = useEditor();
  const fileRef = useRef<HTMLInputElement>(null);

  // context: font controls drive the selected text object, else the defaults
  const sel = s.annots.find((a) => a.id === s.selectedId);
  const txt = sel && (sel.type === "text" || sel.type === "textblock") ? sel : null;
  const mk = sel && (sel.type === "highlight" || sel.type === "underline"
    || sel.type === "strikeout") ? sel : null;
  const up = (patch: any) => s.updateAnnot((txt ?? mk)!.id, patch, true);

  const size = txt ? txt.fontSize : s.opts.fontSize;
  const bold = txt ? !!txt.bold : s.opts.bold;
  const italic = txt ? !!txt.italic : s.opts.italic;
  const fontColor = txt ? txt.color : s.opts.fontColor;
  const hlColor = mk ? mk.color : s.opts.highlightColor;
  const isBlock = txt?.type === "textblock";
  const alignVal = (txt ? (txt as any).align ?? "left" : s.opts.align) as string;
  const lineRatio = isBlock
    ? (txt as any).leading / ((txt as any).fontSize || 1) : 1.15;
  const nearestLine = LINE_STEPS.reduce(
    (a, b) => (Math.abs(b - lineRatio) < Math.abs(a - lineRatio) ? b : a), 1.15);

  const setSize = (v: number) => {
    const n = Math.max(6, Math.min(96, v));
    txt ? up({ fontSize: n }) : s.setOpts({ fontSize: n });
  };
  const setAlign = (al: "left" | "center" | "right" | "justify") => {
    if (!txt) return s.setOpts({ align: (al === "justify" ? "left" : al) as any });
    up({ align: txt.type === "textblock" ? al : al === "justify" ? "left" : al });
  };

  const pickImage = () => fileRef.current?.click();
  const onImageChosen = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => useEditor.getState().placeImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  const fit = (mode: "width" | "page") => {
    const el = s.stageEl;
    const dim = s.pageSizes[s.currentPage];
    if (!el || !dim) return;
    const availW = el.clientWidth - 72;
    const availH = el.clientHeight - 56;
    s.setZoom(mode === "width" ? availW / dim.w
      : Math.min(availW / dim.w, availH / dim.h));
  };

  return (
    <div className="tbar-wrap">
      <div className="tbar">
        <TBtn icon={<Undo2 size={ICO} />} title="Undo (Ctrl+Z)"
          disabled={!s.past.length && !s.meta?.can_undo} onClick={() => s.undo()} />
        <TBtn icon={<Redo2 size={ICO} />} title="Redo (Ctrl+Y)"
          disabled={!s.future.length && !s.meta?.can_redo} onClick={() => s.redo()} />

        <Sep />

        <Menu title="Zoom" width={150} label={`${Math.round(s.zoom * 100)}%`}>
          {(close) => (
            <>
              {ZOOMS.map((z) => (
                <MenuItem key={z} label={`${z * 100}%`} active={Math.abs(s.zoom - z) < 0.01}
                  onClick={() => { s.setZoom(z); close(); }} />
              ))}
              <MenuSep />
              <MenuItem icon={<MoveHorizontal size={15} />} label="Fit width"
                onClick={() => { fit("width"); close(); }} />
              <MenuItem icon={<Maximize size={14} />} label="Fit page"
                onClick={() => { fit("page"); close(); }} />
            </>
          )}
        </Menu>

        <Sep />

        <FontPicker value={txt ? txt.fontFamily : s.opts.fontFamily} width={132}
          onChange={(v) => (txt ? up({ fontFamily: v }) : s.setOpts({ fontFamily: v }))} />

        <Sep />

        <TBtn icon={<Minus size={ICO} />} title="Decrease font size"
          onClick={() => setSize(size - 1)} />
        <input
          className="tb-size" type="number" min={6} max={96} value={size}
          onKeyDown={(e) => e.stopPropagation()}
          onChange={(e) => setSize(Number(e.target.value) || 12)}
        />
        <TBtn icon={<Plus size={ICO} />} title="Increase font size"
          onClick={() => setSize(size + 1)} />

        <Sep />

        <TBtn icon={<Bold size={ICO} />} title="Bold" active={bold}
          onClick={() => (txt ? up({ bold: !bold }) : s.setOpts({ bold: !bold }))} />
        <TBtn icon={<Italic size={ICO} />} title="Italic" active={italic}
          onClick={() => (txt ? up({ italic: !italic }) : s.setOpts({ italic: !italic }))} />
        <ColorDropdown icon={<Baseline size={ICO} />} title="Text colour"
          colors={TEXT_COLORS} value={fontColor}
          onPick={(c) => (txt ? up({ color: c }) : s.setOpts({ fontColor: c! }))} />
        <ColorDropdown icon={<Droplet size={ICO} />} title="Highlight colour"
          colors={HIGHLIGHT_COLORS} value={hlColor}
          onPick={(c) => (mk ? up({ color: c }) : s.setOpts({ highlightColor: c! }))} />

        <Sep />

        <ToolBtn tool="select" />
        <ToolBtn tool="edit-text" />
        <ToolBtn tool="text" />
        <ToolBtn tool="form" />

        <Sep />

        <ToolBtn tool="highlight" />
        <ToolBtn tool="underline" />
        <ToolBtn tool="strikeout" />

        <Sep />

        <ToolBtn tool="pen" />
        <ToolBtn tool="eraser" />
        <Menu title="Shapes" width={170}
          icon={<Shapes size={ICO} />}
          active={["rect", "ellipse", "line", "arrow"].includes(s.tool)}>
          {(close) => (
            <>
              {(["rect", "ellipse", "line", "arrow"] as Tool[]).map((t) => (
                <MenuItem key={t} icon={T[t].icon} label={T[t].label}
                  active={s.tool === t}
                  onClick={() => { s.setTool(t); close(); }} />
              ))}
              <MenuSep />
              <MenuRow label="Stroke">
                <ColorDropdown icon={<Palette size={15} />} title="Stroke colour"
                  colors={STROKE_COLORS} value={s.opts.color}
                  onPick={(c) => s.setOpts({ color: c! })} />
              </MenuRow>
              <MenuRow label="Fill">
                <ColorDropdown icon={<PaintBucket size={15} />} title="Fill colour" allowNone
                  colors={STROKE_COLORS.slice(0, 6)} value={s.opts.fillColor}
                  onPick={(c) => s.setOpts({ fillColor: c })} />
              </MenuRow>
            </>
          )}
        </Menu>

        <Sep />

        <TBtn icon={T.image.icon} title="Insert image" active={s.tool === "image"}
          onClick={() => { s.setTool("image"); pickImage(); }} />
        <TBtn icon={T.sign.icon} title="Signature"
          onClick={() => s.set({ modal: "sign" })} />
        <ToolBtn tool="note" />
        <ToolBtn tool="link" />

        <Sep />

        <Menu title="Alignment" width={150}
          icon={alignVal === "center" ? <AlignCenter size={ICO} />
            : alignVal === "right" ? <AlignRight size={ICO} />
              : alignVal === "justify" ? <AlignJustify size={ICO} />
                : <AlignLeft size={ICO} />}>
          {(close) => (
            <>
              <MenuItem icon={<AlignLeft size={15} />} label="Left" active={alignVal === "left"}
                onClick={() => { setAlign("left"); close(); }} />
              <MenuItem icon={<AlignCenter size={15} />} label="Centre" active={alignVal === "center"}
                onClick={() => { setAlign("center"); close(); }} />
              <MenuItem icon={<AlignRight size={15} />} label="Right" active={alignVal === "right"}
                onClick={() => { setAlign("right"); close(); }} />
              <MenuItem icon={<AlignJustify size={15} />} label="Justify" active={alignVal === "justify"}
                onClick={() => { setAlign("justify"); close(); }} />
            </>
          )}
        </Menu>

        <Menu title={isBlock ? "Line spacing" : "Line spacing — select a text block"}
          width={140} icon={<ChevronsUpDown size={ICO} />}>
          {(close) => (
            <>
              {LINE_STEPS.map((r) => (
                <MenuItem key={r} label={r.toFixed(2).replace(/0$/, "")}
                  active={isBlock && nearestLine === r}
                  disabled={!isBlock}
                  onClick={() => {
                    if (isBlock) up({ leading: r * (txt as any).fontSize });
                    close();
                  }} />
              ))}
            </>
          )}
        </Menu>

        <Sep />

        <Menu title="More" width={190} icon={<MoreHorizontal size={ICO} />}>
          {(close) => (
            <>
              <MenuItem icon={<Scissors size={15} />} label="Split document…"
                onClick={() => { s.set({ modal: "split" }); close(); }} />
              <MenuItem icon={<GitMerge size={15} />} label="Merge documents…"
                onClick={() => { s.set({ modal: "merge" }); close(); }} />
              <MenuItem icon={<Stamp size={15} />} label="Add watermark…"
                onClick={() => { s.set({ modal: "watermark" }); close(); }} />
              <MenuSep />
              <MenuItem icon={<Rows3 size={15} />} label="Continuous scroll"
                active={s.viewMode === "continuous"}
                onClick={() => { s.set({ viewMode: "continuous" }); close(); }} />
              <MenuItem icon={<SinglePageIcon size={15} />} label="Single page"
                active={s.viewMode === "single"}
                onClick={() => { s.set({ viewMode: "single" }); close(); }} />
              <MenuSep />
              <MenuItem icon={<LayoutGrid size={15} />} label="Layout grid"
                active={s.showGrid}
                onClick={() => { s.set({ showGrid: !s.showGrid }); close(); }} />
              <MenuItem icon={<Magnet size={15} />} label="Snap to grid"
                active={s.snap}
                onClick={() => { s.set({ snap: !s.snap }); close(); }} />
            </>
          )}
        </Menu>
      </div>

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

/* ------------------------------------------------------------------ pieces */

function Sep() {
  return <div className="tb-sep" />;
}

function TBtn({ icon, title, active, disabled, onClick }: {
  icon: React.ReactNode; title: string;
  active?: boolean; disabled?: boolean; onClick?: () => void;
}) {
  return (
    <button className={`tb-btn ${active ? "active" : ""}`}
      title={title} disabled={disabled} onClick={onClick}>
      {icon}
    </button>
  );
}

function ToolBtn({ tool }: { tool: Tool }) {
  const s = useEditor();
  const def = T[tool];
  return (
    <TBtn
      icon={def.icon}
      title={def.key ? `${def.label} (${def.key})` : def.label}
      active={s.tool === tool}
      onClick={() => {
        if (tool === "form" && !s.formFields.length)
          s.toast("This document has no fillable form fields", "info");
        s.setTool(tool);
      }}
    />
  );
}

/** Anchored dropdown. Fixed-positioned so the scrolling toolbar can't clip it. */
function Menu({ title, icon, label, width = 180, active, children }: {
  title: string; icon?: React.ReactNode; label?: string; width?: number;
  active?: boolean;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

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
        left: Math.max(6, Math.min(r.left, window.innerWidth - width - 8)),
      });
    }
    setOpen(true);
  };

  return (
    <div className="tb-menu" ref={ref}>
      <button ref={btnRef}
        className={`tb-btn tb-drop ${open || active ? "active" : ""}`}
        title={title} onClick={toggle}>
        {icon}
        {label && <span className="tb-lbl">{label}</span>}
        <ChevronDown size={12} className="tb-caret" />
      </button>
      {open && (
        <div className="tb-pop" style={{ top: pos.top, left: pos.left, width }}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

function MenuItem({ icon, label, active, disabled, onClick }: {
  icon?: React.ReactNode; label: string;
  active?: boolean; disabled?: boolean; onClick: () => void;
}) {
  return (
    <button className={`tb-item ${active ? "active" : ""}`}
      disabled={disabled} onClick={onClick}>
      <span className="tb-item-ico">{icon}</span>
      {label}
    </button>
  );
}

function MenuSep() {
  return <div className="tb-item-sep" />;
}

function MenuRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="tb-item-row">
      <span>{label}</span>
      {children}
    </div>
  );
}

/** Compact colour control: swatch grid + a native picker for anything else. */
function ColorDropdown({ icon, colors, value, onPick, title, allowNone }: {
  icon: React.ReactNode; colors: string[]; value: string | null;
  onPick: (c: string | null) => void; title: string; allowNone?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const customRef = useRef<HTMLInputElement>(null);
  const pickRef = useRef(onPick);
  pickRef.current = onPick;

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [open]);

  // native `change` fires once when the OS picker closes; React's onChange maps
  // to `input`, which fires every drag frame and would spam undo + re-bakes
  useEffect(() => {
    const el = customRef.current;
    if (!open || !el) return;
    const commit = () => { pickRef.current(el.value); setOpen(false); };
    el.addEventListener("change", commit);
    return () => el.removeEventListener("change", commit);
  }, [open]);

  const toggle = () => {
    if (open) { setOpen(false); return; }
    const r = btnRef.current?.getBoundingClientRect();
    if (r) {
      setPos({
        top: r.bottom + 6,
        left: Math.max(6, Math.min(r.left, window.innerWidth - 252)),
      });
    }
    setOpen(true);
  };

  return (
    <div className="tb-menu" ref={ref}>
      <button ref={btnRef} className="tb-btn tb-color" title={title} onClick={toggle}>
        {icon}
        <span className={`tb-color-bar ${value === null ? "none" : ""}`}
          style={value ? { background: value } : undefined} />
      </button>
      {open && (
        <div className="rbn-cdd-pop" style={{ top: pos.top, left: pos.left }}>
          {allowNone && (
            <button className={`swatch none ${value === null ? "active" : ""}`}
              title="No fill" onClick={() => { onPick(null); setOpen(false); }} />
          )}
          {colors.map((c) => (
            <button key={c} className={`swatch ${value === c ? "active" : ""}`}
              style={{ background: c, border: c === "#ffffff" ? "2px solid #555" : undefined }}
              onClick={() => { onPick(c); setOpen(false); }} />
          ))}
          <label className="rbn-cdd-more" title="Custom colour…">
            <input ref={customRef} type="color" defaultValue={value ?? "#000000"} />
            More…
          </label>
        </div>
      )}
    </div>
  );
}
