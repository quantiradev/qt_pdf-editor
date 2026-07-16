"use client";
import { MessageSquare, RotateCw, StickyNote, Trash2 } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/api";
import { useEditor } from "@/lib/store";
import type { Annot } from "@/lib/types";
import { fmtBytes, HIGHLIGHT_COLORS, STROKE_COLORS, TEXT_COLORS, uid } from "@/lib/utils";
import FontPicker from "./FontPicker";

export default function RightSidebar() {
  const s = useEditor();
  const pendingNotes = s.annots.filter((a) => a.type === "note");
  const commentCount = pendingNotes.length + s.bakedNotes.length;

  return (
    <div className="sidebar-r">
      <div className="side-tabs">
        <button
          className={`side-tab ${s.rightTab === "props" ? "active" : ""}`}
          onClick={() => s.set({ rightTab: "props" })}
        >Properties</button>
        <button
          className={`side-tab ${s.rightTab === "comments" ? "active" : ""}`}
          onClick={() => s.set({ rightTab: "comments" })}
        >Comments{commentCount ? ` (${commentCount})` : ""}</button>
      </div>
      {s.rightTab === "props" ? <PropsTab /> : <CommentsTab />}
    </div>
  );
}

/* ================================================= properties */

function PropsTab() {
  const s = useEditor();
  const a = s.annots.find((x) => x.id === s.selectedId);
  if (!a) return <DocProps />;
  return (
    <div className="side-body">
      <div className="props-group">
        <h4>{label(a.type)} · page {a.page + 1}</h4>
        <Geometry a={a} />
      </div>
      <TypeProps a={a} />
      <div className="props-group" style={{ borderBottom: "none" }}>
        <button className="btn danger small" style={{ width: "100%", justifyContent: "center" }}
          onClick={() => s.removeAnnot(a.id)}>
          <Trash2 size={14} /> Delete object
        </button>
      </div>
    </div>
  );
}

function label(t: string) {
  return {
    text: "Text box", textblock: "Text block", highlight: "Highlight",
    underline: "Underline", strikeout: "Strike-through", ink: "Pen stroke",
    rect: "Rectangle", ellipse: "Ellipse", line: "Line", arrow: "Arrow",
    image: "Image", note: "Sticky note", link: "Hyperlink",
  }[t] ?? t;
}

function Num({ value, onChange, label: lb }: {
  value: number; onChange: (v: number) => void; label: string;
}) {
  return (
    <label>
      <span>{lb}</span>
      <input
        className="input" type="number" value={Math.round(value * 10) / 10}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
      />
    </label>
  );
}

function Geometry({ a }: { a: Annot }) {
  const s = useEditor();
  const up = (patch: any) => s.updateAnnot(a.id, patch, true);
  if (a.type === "line" || a.type === "arrow") {
    return (
      <div className="num-grid">
        <Num label="x1" value={a.x1} onChange={(v) => up({ x1: v })} />
        <Num label="y1" value={a.y1} onChange={(v) => up({ y1: v })} />
        <Num label="x2" value={a.x2} onChange={(v) => up({ x2: v })} />
        <Num label="y2" value={a.y2} onChange={(v) => up({ y2: v })} />
      </div>
    );
  }
  if ("w" in a && "h" in a) {
    return (
      <div className="num-grid">
        <Num label="X" value={(a as any).x} onChange={(v) => up({ x: v })} />
        <Num label="Y" value={(a as any).y} onChange={(v) => up({ y: v })} />
        <Num label="W" value={(a as any).w} onChange={(v) => up({ w: Math.max(4, v) })} />
        <Num label="H" value={(a as any).h} onChange={(v) => up({ h: Math.max(4, v) })} />
      </div>
    );
  }
  if ("x" in a && "y" in a) {
    return (
      <div className="num-grid">
        <Num label="X" value={(a as any).x} onChange={(v) => up({ x: v })} />
        <Num label="Y" value={(a as any).y} onChange={(v) => up({ y: v })} />
      </div>
    );
  }
  return null;
}

function Swatches({ colors, value, onPick }: {
  colors: string[]; value: string | null; onPick: (c: string) => void;
}) {
  return (
    <div className="swatch-row" style={{ flexWrap: "wrap" }}>
      {colors.map((c) => (
        <button key={c} className={`swatch ${value === c ? "active" : ""}`}
          style={{ background: c, border: c === "#ffffff" ? "2px solid #555" : undefined }}
          onClick={() => onPick(c)} />
      ))}
    </div>
  );
}

function TypeProps({ a }: { a: Annot }) {
  const s = useEditor();
  const up = (patch: any, snap = true) => s.updateAnnot(a.id, patch, snap);

  switch (a.type) {
    case "text":
      return (
        <div className="props-group">
          <h4>Typography</h4>
          <div className="prop-row">
            <span>Content</span>
            <textarea
              className="input" rows={3} value={a.text}
              style={{ resize: "vertical" }}
              onChange={(e) => up({ text: e.target.value }, false)}
            />
          </div>
          <div className="prop-row">
            <span>Font</span>
            <FontPicker value={a.fontFamily} width={150}
              onChange={(v) => up({ fontFamily: v })} />
          </div>
          <div className="prop-row">
            <span>Size</span>
            <input className="input" type="number" min={6} max={120} value={a.fontSize}
              onChange={(e) => up({ fontSize: Number(e.target.value) || 12 })} />
          </div>
          <div className="prop-row">
            <span>Style</span>
            <button className={`icon-btn ${a.bold ? "active" : ""}`}
              onClick={() => up({ bold: !a.bold })}><b>B</b></button>
            <button className={`icon-btn ${a.italic ? "active" : ""}`}
              onClick={() => up({ italic: !a.italic })}><i>I</i></button>
            <select className="select" style={{ width: 88 }} value={a.align ?? "left"}
              onChange={(e) => up({ align: e.target.value })}>
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </div>
          <div className="prop-row">
            <span>Color</span>
            <Swatches colors={TEXT_COLORS} value={a.color} onPick={(c) => up({ color: c })} />
          </div>
          <div className="prop-row">
            <span>Link URL</span>
            <input className="input" placeholder="https:// (optional)" value={a.url ?? ""}
              onChange={(e) => up({ url: e.target.value || undefined }, false)} />
          </div>
        </div>
      );

    case "highlight":
    case "underline":
    case "strikeout":
      return (
        <div className="props-group">
          <h4>Appearance</h4>
          <div className="prop-row">
            <span>Color</span>
            <Swatches colors={HIGHLIGHT_COLORS} value={a.color} onPick={(c) => up({ color: c })} />
          </div>
          {a.type === "highlight" && (
            <div className="prop-row">
              <span>Opacity</span>
              <input type="range" min={0.15} max={0.85} step={0.05} value={a.opacity}
                style={{ flex: 1 }} onChange={(e) => up({ opacity: Number(e.target.value) }, false)} />
            </div>
          )}
        </div>
      );

    case "ink":
      return (
        <div className="props-group">
          <h4>Pen</h4>
          <div className="prop-row">
            <span>Color</span>
            <Swatches colors={STROKE_COLORS} value={a.color} onPick={(c) => up({ color: c })} />
          </div>
          <div className="prop-row">
            <span>Width</span>
            <input type="range" min={0.5} max={14} step={0.5} value={a.width}
              style={{ flex: 1 }} onChange={(e) => up({ width: Number(e.target.value) }, false)} />
            <span style={{ width: 34 }}>{a.width}pt</span>
          </div>
        </div>
      );

    case "rect":
    case "ellipse":
    case "line":
    case "arrow":
      return (
        <div className="props-group">
          <h4>Shape</h4>
          <div className="prop-row">
            <span>Stroke</span>
            <Swatches colors={STROKE_COLORS} value={a.stroke} onPick={(c) => up({ stroke: c })} />
          </div>
          <div className="prop-row">
            <span>Width</span>
            <input type="range" min={0.5} max={14} step={0.5} value={a.strokeWidth}
              style={{ flex: 1 }} onChange={(e) => up({ strokeWidth: Number(e.target.value) }, false)} />
            <span style={{ width: 34 }}>{a.strokeWidth}pt</span>
          </div>
          {(a.type === "rect" || a.type === "ellipse") && (
            <div className="prop-row">
              <span>Fill</span>
              <div className="swatch-row" style={{ flexWrap: "wrap" }}>
                <button className={`swatch none ${a.fill === null ? "active" : ""}`}
                  onClick={() => up({ fill: null })} title="No fill" />
                {STROKE_COLORS.slice(0, 5).map((c) => (
                  <button key={c} className={`swatch ${a.fill === c ? "active" : ""}`}
                    style={{ background: c }} onClick={() => up({ fill: c })} />
                ))}
              </div>
            </div>
          )}
          <div className="prop-row">
            <span>Opacity</span>
            <input type="range" min={0.1} max={1} step={0.05} value={a.opacity}
              style={{ flex: 1 }} onChange={(e) => up({ opacity: Number(e.target.value) }, false)} />
          </div>
        </div>
      );

    case "image":
      return <ImagePropsGroup a={a} />;

    case "note":
      return (
        <div className="props-group">
          <h4>Sticky note</h4>
          <div className="prop-row">
            <span>Color</span>
            <Swatches colors={HIGHLIGHT_COLORS.slice(0, 4)} value={a.color} onPick={(c) => up({ color: c })} />
          </div>
          <div className="prop-row">
            <span>Comment</span>
            <textarea className="input" rows={4} value={a.text} style={{ resize: "vertical" }}
              onChange={(e) => up({ text: e.target.value }, false)} placeholder="Write the comment…" />
          </div>
        </div>
      );

    case "link":
      return (
        <div className="props-group">
          <h4>Hyperlink</h4>
          <div className="prop-row">
            <span>URL</span>
            <input className="input" value={a.url}
              onChange={(e) => up({ url: e.target.value }, false)} />
          </div>
        </div>
      );

    case "textblock":
      return (
        <div className="props-group">
          <h4>Text block</h4>
          <div className="prop-row">
            <span>Rotation</span>
            <input
              className="input" type="number" step={1} min={-180} max={180}
              style={{ width: 70 }}
              value={Math.round(a.rotate * 10) / 10}
              onChange={(e) => up({
                rotate: Math.max(-180, Math.min(180, Number(e.target.value) || 0)),
              })}
            />
            <span>°</span>
          </div>
          <p className="side-hint">
            Existing page text, lifted off the page. Drag it anywhere, pull the
            side handles to re-wrap it, double-click to retype. Fonts and
            colors of the original text are preserved when it is baked back
            into the PDF. Deleting this object cancels the change.
          </p>
        </div>
      );

    default:
      return null;
  }
}

function DocProps() {
  const s = useEditor();
  const size = s.pageSizes[s.currentPage];
  return (
    <div className="side-body">
      <div className="props-group">
        <h4>Document</h4>
        <div className="prop-row"><span>Name</span><div style={{ wordBreak: "break-word" }}>{s.meta?.name}</div></div>
        <div className="prop-row"><span>Pages</span><div>{s.meta?.pages}</div></div>
        <div className="prop-row"><span>Size</span><div>{fmtBytes(s.meta?.size ?? 0)}</div></div>
        {size && (
          <div className="prop-row">
            <span>Page dims</span>
            <div>{Math.round(size.w)} × {Math.round(size.h)} pt</div>
          </div>
        )}
      </div>
      <div className="props-group" style={{ borderBottom: "none", color: "var(--faint)", lineHeight: 1.6 }}>
        <h4>Tips</h4>
        Select an object on the page to edit its properties here.<br />
        <b style={{ color: "var(--muted)" }}>V</b> select · <b style={{ color: "var(--muted)" }}>T</b> text ·{" "}
        <b style={{ color: "var(--muted)" }}>H</b> highlight · <b style={{ color: "var(--muted)" }}>P</b> pen ·{" "}
        <b style={{ color: "var(--muted)" }}>X</b> eraser · <b style={{ color: "var(--muted)" }}>Ctrl+S</b> save
      </div>
    </div>
  );
}

/* ================================================= comments */

function CommentsTab() {
  const s = useEditor();
  const pending = s.annots.filter((a) => a.type === "note") as Extract<Annot, { type: "note" }>[];
  const [busyXref, setBusyXref] = useState<number | null>(null);

  const editBaked = async (xref: number, text: string) => {
    setBusyXref(xref);
    try {
      await api.editNote(s.fileId!, xref, text);
      await s.reloadDoc();
    } catch (e: any) {
      s.toast(`Could not update note: ${e.message}`, "error");
    } finally {
      setBusyXref(null);
    }
  };
  const deleteBaked = async (xref: number) => {
    setBusyXref(xref);
    try {
      await api.deleteNote(s.fileId!, xref);
      await s.reloadDoc();
    } catch (e: any) {
      s.toast(`Could not delete note: ${e.message}`, "error");
    } finally {
      setBusyXref(null);
    }
  };

  if (!pending.length && !s.bakedNotes.length) {
    return (
      <div className="side-body">
        <div style={{ color: "var(--faint)", textAlign: "center", padding: "30px 10px", lineHeight: 1.6 }}>
          <MessageSquare size={22} style={{ marginBottom: 8 }} />
          <div>No comments yet.</div>
          <div>Use the <StickyNote size={13} style={{ verticalAlign: "-2px" }} /> sticky-note tool to pin one on the page.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="side-body">
      {pending.map((n) => (
        <div key={n.id} className="comment-card" style={{ borderColor: s.selectedId === n.id ? "var(--accent)" : undefined }}>
          <div className="cc-head">
            <span className="cc-dot" style={{ background: n.color }} />
            Page {n.page + 1} · unsaved
            <span style={{ flex: 1 }} />
            <button className="icon-btn" style={{ width: 22, height: 22 }} title="Show on page"
              onClick={() => { s.gotoPage(n.page); s.set({ selectedId: n.id }); }}>
              <StickyNote size={13} />
            </button>
            <button className="icon-btn" style={{ width: 22, height: 22 }} title="Delete"
              onClick={() => s.removeAnnot(n.id)}>
              <Trash2 size={13} />
            </button>
          </div>
          <textarea
            value={n.text} placeholder="Write the comment…"
            onFocus={() => s.beginInteract()}
            onBlur={() => s.endInteract()}
            onChange={(e) => s.updateAnnot(n.id, { text: e.target.value } as any, false)}
          />
        </div>
      ))}
      {s.bakedNotes.map((n) => (
        <BakedNoteCard
          key={n.xref} note={n} busy={busyXref === n.xref}
          onJump={() => s.gotoPage(n.page)}
          onSave={(t) => editBaked(n.xref, t)}
          onDelete={() => deleteBaked(n.xref)}
        />
      ))}
    </div>
  );
}

function BakedNoteCard({ note, busy, onJump, onSave, onDelete }: {
  note: { xref: number; page: number; text: string };
  busy: boolean;
  onJump: () => void;
  onSave: (t: string) => void;
  onDelete: () => void;
}) {
  const [value, setValue] = useState(note.text);
  const changed = value !== note.text;
  return (
    <div className="comment-card" style={{ opacity: busy ? 0.55 : 1 }}>
      <div className="cc-head">
        <span className="cc-dot" style={{ background: "#ffd400" }} />
        Page {note.page + 1} · saved in PDF
        <span style={{ flex: 1 }} />
        <button className="icon-btn" style={{ width: 22, height: 22 }} title="Show page" onClick={onJump}>
          <StickyNote size={13} />
        </button>
        <button className="icon-btn" style={{ width: 22, height: 22 }} title="Delete from PDF" onClick={onDelete}>
          <Trash2 size={13} />
        </button>
      </div>
      <textarea value={value} onChange={(e) => setValue(e.target.value)} />
      {changed && (
        <div className="cc-actions">
          <button className="btn small" onClick={() => setValue(note.text)}>Cancel</button>
          <button className="btn primary small" onClick={() => onSave(value)}>Update</button>
        </div>
      )}
    </div>
  );
}

function parsePagesString(str: string, totalPages: number): number[] {
  const pages: number[] = [];
  const parts = str.split(",");
  for (const part of parts) {
    const range = part.trim();
    if (!range) continue;
    if (range.includes("-")) {
      const [startStr, endStr] = range.split("-");
      const start = parseInt(startStr.trim(), 10);
      const end = parseInt(endStr.trim(), 10);
      if (!isNaN(start) && !isNaN(end)) {
        for (let i = start; i <= end; i++) {
          if (i >= 1 && i <= totalPages) {
            pages.push(i - 1); // 0-indexed
          }
        }
      }
    } else {
      const p = parseInt(range, 10);
      if (!isNaN(p) && p >= 1 && p <= totalPages) {
        pages.push(p - 1); // 0-indexed
      }
    }
  }
  return Array.from(new Set(pages)).sort((a, b) => a - b);
}

function ImagePropsGroup({ a: rawAnnot }: { a: Annot }) {
  const a = rawAnnot as any;
  const s = useEditor();
  const up = (patch: any, snap = true) => s.updateAnnot(a.id, patch, snap);
  const [customPages, setCustomPages] = useState("");
  const totalPages = s.pageSizes.length;

  const handleApplyAll = () => {
    const st = useEditor.getState();
    const otherPages = Array.from({ length: totalPages }, (_, i) => i).filter(pno => pno !== a.page);
    
    st.snapshot();
    const newAnnots = [...st.annots];
    for (const pno of otherPages) {
      newAnnots.push({
        ...a,
        id: uid(),
        page: pno,
      });
    }
    st.set({ annots: newAnnots });
    st.scheduleFlush();
    st.toast("Signature applied to all pages", "success");
  };

  const handleApplyCustom = () => {
    if (!customPages.trim()) {
      s.toast("Please enter page numbers (e.g., 2, 4, 6-8)", "error");
      return;
    }
    const targetPages = parsePagesString(customPages, totalPages).filter(pno => pno !== a.page);
    if (targetPages.length === 0) {
      s.toast("No valid target pages entered", "error");
      return;
    }

    const st = useEditor.getState();
    st.snapshot();
    const newAnnots = [...st.annots];
    for (const pno of targetPages) {
      newAnnots.push({
        ...a,
        id: uid(),
        page: pno,
      });
    }
    st.set({ annots: newAnnots });
    st.scheduleFlush();
    s.toast(`Signature applied to pages: ${targetPages.map(p => p + 1).join(", ")}`, "success");
    setCustomPages("");
  };

  return (
    <div className="props-group">
      <h4>Image Options</h4>
      <div className="prop-row">
        <span>Rotation</span>
        <button className="btn small" onClick={() => up({ rotate: (((a.rotate + 90) % 360) as any) })}>
          <RotateCw size={13} /> {a.rotate}°
        </button>
      </div>
      <div className="prop-row">
        <span>Link URL</span>
        <input className="input" placeholder="https:// (optional)" value={a.url ?? ""}
          onChange={(e) => up({ url: e.target.value || undefined }, false)} />
      </div>
      
      <div className="border-t border-zinc-200 dark:border-zinc-800 my-3 pt-3 space-y-2">
        <h5 className="text-xs font-bold text-zinc-500 dark:text-zinc-400">Replicate to Other Pages</h5>
        
        <button 
          className="btn primary small w-full justify-center"
          disabled={totalPages <= 1}
          onClick={handleApplyAll}
        >
          Apply to All Pages ({totalPages - 1} other{totalPages - 1 === 1 ? "" : "s"})
        </button>
        
        <div className="space-y-1 pt-1">
          <span className="text-[10px] text-zinc-450 dark:text-zinc-500">Custom pages (e.g. 1, 3, 5-7):</span>
          <div className="flex gap-1.5">
            <input 
              type="text"
              placeholder="e.g. 2, 4-6"
              className="input flex-1 py-1 text-xs"
              value={customPages}
              onChange={(e) => setCustomPages(e.target.value)}
            />
            <button 
              className="btn small"
              disabled={totalPages <= 1}
              onClick={handleApplyCustom}
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


