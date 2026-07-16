"use client";
import {
  ArrowDown, ArrowUp, FileImage, FileText, Loader2, PenTool, Presentation, Type, X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useEditor } from "@/lib/store";
import type { FileMeta } from "@/lib/types";
import { downloadBlob, parseRanges } from "@/lib/utils";

export default function Modals() {
  const modal = useEditor((s) => s.modal);
  if (!modal) return null;
  return (
    <div className="modal-backdrop" onMouseDown={(e) => {
      if (e.target === e.currentTarget) useEditor.getState().set({ modal: null });
    }}>
      {modal === "export" && <ExportModal />}
      {modal === "split" && <SplitModal />}
      {modal === "merge" && <MergeModal />}
      {modal === "watermark" && <WatermarkModal />}
      {modal === "sign" && <SignModal />}
    </div>
  );
}

function Shell({ title, children, foot }: {
  title: string; children: React.ReactNode; foot: React.ReactNode;
}) {
  const s = useEditor();
  return (
    <div className="modal">
      <div className="modal-head">
        <h3>{title}</h3>
        <button className="icon-btn" onClick={() => s.set({ modal: null })}><X size={16} /></button>
      </div>
      <div className="modal-body">{children}</div>
      <div className="modal-foot">{foot}</div>
    </div>
  );
}

/* ------------------------------------------------ export */

function ExportModal() {
  const s = useEditor();
  const pages = s.meta?.pages ?? 1;
  const [format, setFormat] = useState<"pdf" | "docx" | "pptx" | "png" | "jpg">("pdf");
  const [scope, setScope] = useState<"all" | "current" | "custom">("all");
  const [ranges, setRanges] = useState("");
  const [dpi, setDpi] = useState(150);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const run = async () => {
    setErr(null);
    let spec = "all";
    if (scope === "current") spec = String(s.currentPage + 1);
    if (scope === "custom") {
      try { parseRanges(ranges, pages); spec = ranges; }
      catch (e: any) { setErr(e.message); return; }
    }
    setBusy(true);
    try {
      if (!(await s.ensureSaved())) return;
      const { blob, name } = await api.exportBlob(s.fileId!, format, spec, dpi);
      downloadBlob(name, blob);
      s.set({ modal: null });
      s.toast("Export downloaded", "success");
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const getIcon = (f: string) => {
    if (f === "pdf" || f === "docx") return <FileText size={19} />;
    if (f === "pptx") return <Presentation size={19} />;
    return <FileImage size={19} />;
  };

  return (
    <Shell
      title="Export"
      foot={
        <>
          <button className="btn" onClick={() => s.set({ modal: null })}>Cancel</button>
          <button className="btn primary" onClick={run} disabled={busy}>
            {busy && <Loader2 size={14} className="spin" />} Export
          </button>
        </>
      }
    >
      <div className="radio-cards">
        {(["pdf", "docx", "pptx", "png", "jpg"] as const).map((f) => (
          <button key={f} className={`radio-card ${format === f ? "active" : ""}`}
            onClick={() => setFormat(f)}>
            {getIcon(f)}
            {f.toUpperCase()}
          </button>
        ))}
      </div>

      <label className="field">
        <span>Pages</span>
        <select className="select" value={scope} onChange={(e) => setScope(e.target.value as any)}>
          <option value="all">All pages (1–{pages})</option>
          <option value="current">Current page ({s.currentPage + 1})</option>
          <option value="custom">Custom range…</option>
        </select>
      </label>
      {scope === "custom" && (
        <label className="field">
          <span>Range — e.g. 1-5, 8, 11-</span>
          <input className="input" value={ranges} placeholder="1-5, 10"
            onChange={(e) => setRanges(e.target.value)} autoFocus />
        </label>
      )}
      {(format === "png" || format === "jpg") && (
        <label className="field">
          <span>Image quality</span>
          <select className="select" value={dpi} onChange={(e) => setDpi(Number(e.target.value))}>
            <option value={96}>Screen (96 dpi)</option>
            <option value={150}>Good (150 dpi)</option>
            <option value={300}>Print (300 dpi)</option>
          </select>
        </label>
      )}
      <div style={{ color: "var(--faint)", fontSize: 12, lineHeight: 1.5 }}>
        {format === "pdf" && "Exports the selected pages as a PDF download. Unsaved edits are saved first."}
        {format === "docx" && "Converts and exports the selected pages as an editable Word document (.docx)."}
        {format === "pptx" && "Exports the selected pages as a PowerPoint presentation (.pptx)."}
        {(format === "png" || format === "jpg") && "Multiple pages are downloaded as a ZIP of images. Unsaved edits are saved first."}
      </div>
      {err && <div style={{ color: "var(--danger)", marginTop: 10 }}>{err}</div>}
    </Shell>
  );
}

/* ------------------------------------------------ split */

function SplitModal() {
  const s = useEditor();
  const pages = s.meta?.pages ?? 1;
  const [ranges, setRanges] = useState(`1-${Math.ceil(pages / 2)}, ${Math.ceil(pages / 2) + 1}-${pages}`);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<FileMeta[] | null>(null);

  const run = async () => {
    setErr(null);
    for (const part of ranges.split(",")) {
      try { parseRanges(part, pages); }
      catch (e: any) { setErr(`Segment "${part.trim()}": ${e.message}`); return; }
    }
    setBusy(true);
    try {
      if (!(await s.ensureSaved())) return;
      setResult(await api.split(s.fileId!, ranges));
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell
      title="Split document"
      foot={
        result ? (
          <button className="btn primary" onClick={() => s.set({ modal: null })}>Done</button>
        ) : (
          <>
            <button className="btn" onClick={() => s.set({ modal: null })}>Cancel</button>
            <button className="btn primary" onClick={run} disabled={busy}>
              {busy && <Loader2 size={14} className="spin" />} Split
            </button>
          </>
        )
      }
    >
      {result ? (
        <>
          <div style={{ marginBottom: 10 }}>Created {result.length} new document{result.length > 1 ? "s" : ""} in your library:</div>
          {result.map((f) => (
            <div key={f.id} className="merge-row">
              <FileText size={15} style={{ flex: "none", color: "var(--accent)" }} />
              <span className="mr-name">{f.name}</span>
              <span className="mr-pages">{f.pages} pages</span>
              <Link className="btn small" href={`/editor/${f.id}`} onClick={() => s.set({ modal: null })}>Open</Link>
            </div>
          ))}
        </>
      ) : (
        <>
          <label className="field">
            <span>Page ranges — each comma-separated segment becomes its own PDF</span>
            <input className="input" value={ranges} onChange={(e) => setRanges(e.target.value)} autoFocus />
          </label>
          <div style={{ color: "var(--faint)", fontSize: 12, lineHeight: 1.6 }}>
            This document has {pages} pages. Example: <code>1-3, 4-6, 7-</code> creates three PDFs.
            The original document is not changed.
          </div>
          {err && <div style={{ color: "var(--danger)", marginTop: 10 }}>{err}</div>}
        </>
      )}
    </Shell>
  );
}

/* ------------------------------------------------ merge */

function MergeModal() {
  const s = useEditor();
  const [library, setLibrary] = useState<FileMeta[] | null>(null);
  const [order, setOrder] = useState<string[]>([s.fileId!]);
  const [name, setName] = useState("Merged document");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.list().then(setLibrary).catch((e) => setErr(e.message));
  }, []);

  const byId = new Map((library ?? []).map((f) => [f.id, f]));
  const toggle = (id: string) =>
    setOrder((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]));
  const move = (id: string, dir: -1 | 1) =>
    setOrder((o) => {
      const i = o.indexOf(id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= o.length) return o;
      const next = [...o];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const run = async () => {
    setBusy(true);
    setErr(null);
    try {
      if (!(await s.ensureSaved())) return;
      const meta = await api.merge(order, name);
      s.set({ modal: null });
      s.toast(`Merged ${order.length} documents into "${meta.name}"`, "success");
      window.location.href = `/editor/${meta.id}`;
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell
      title="Merge documents"
      foot={
        <>
          <button className="btn" onClick={() => s.set({ modal: null })}>Cancel</button>
          <button className="btn primary" onClick={run} disabled={busy || order.length < 2}>
            {busy && <Loader2 size={14} className="spin" />} Merge {order.length} files
          </button>
        </>
      }
    >
      <label className="field">
        <span>New document name</span>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
      </label>

      <div style={{ color: "var(--muted)", fontSize: 12, margin: "4px 0 8px" }}>
        Merge order — pages are appended in this sequence:
      </div>
      {order.map((id, i) => (
        <div key={id} className="merge-row" style={{ borderColor: "var(--accent)" }}>
          <b style={{ color: "var(--accent)", width: 16 }}>{i + 1}</b>
          <span className="mr-name">{byId.get(id)?.name ?? id}{id === s.fileId ? " (this file)" : ""}</span>
          <span className="mr-pages">{byId.get(id)?.pages ?? "?"} p</span>
          <button className="icon-btn" style={{ width: 22, height: 22 }} onClick={() => move(id, -1)} disabled={i === 0}><ArrowUp size={13} /></button>
          <button className="icon-btn" style={{ width: 22, height: 22 }} onClick={() => move(id, 1)} disabled={i === order.length - 1}><ArrowDown size={13} /></button>
          <button className="icon-btn" style={{ width: 22, height: 22 }} onClick={() => toggle(id)} disabled={order.length === 1 && id === s.fileId}><X size={13} /></button>
        </div>
      ))}

      <div style={{ color: "var(--muted)", fontSize: 12, margin: "12px 0 8px" }}>
        Add from your library:
      </div>
      {library === null ? (
        <Loader2 size={16} className="spin" />
      ) : (
        library.filter((f) => !order.includes(f.id)).map((f) => (
          <div key={f.id} className="merge-row" style={{ cursor: "pointer" }} onClick={() => toggle(f.id)}>
            <FileText size={15} style={{ flex: "none", color: "var(--muted)" }} />
            <span className="mr-name">{f.name}</span>
            <span className="mr-pages">{f.pages} p</span>
            <span style={{ color: "var(--accent)", fontSize: 12 }}>+ add</span>
          </div>
        ))
      )}
      {library && library.filter((f) => !order.includes(f.id)).length === 0 && (
        <div style={{ color: "var(--faint)", fontSize: 12 }}>No other documents — upload more from the library page.</div>
      )}
      {err && <div style={{ color: "var(--danger)", marginTop: 10 }}>{err}</div>}
    </Shell>
  );
}

/* ------------------------------------------------ sign */

const SIG_KEY = "qt_signature";
const SIG_FONT = '"Snell Roundhand", "Segoe Script", "Brush Script MT", cursive';

/** Crop a canvas to its inked pixels (+pad) and return a transparent PNG. */
function trimToDataUrl(canvas: HTMLCanvasElement, pad = 8): string | null {
  const ctx = canvas.getContext("2d")!;
  const { width, height } = canvas;
  const px = ctx.getImageData(0, 0, width, height).data;
  let x0 = width, y0 = height, x1 = -1, y1 = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (px[(y * width + x) * 4 + 3] > 10) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return null; // nothing drawn
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad);
  x1 = Math.min(width - 1, x1 + pad); y1 = Math.min(height - 1, y1 + pad);
  const out = document.createElement("canvas");
  out.width = x1 - x0 + 1;
  out.height = y1 - y0 + 1;
  out.getContext("2d")!.drawImage(canvas, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  return out.toDataURL("image/png");
}

function SignModal() {
  const s = useEditor();
  const [tab, setTab] = useState<"draw" | "type">("draw");
  const [ink, setInk] = useState("#111111");
  const [typed, setTyped] = useState("");
  const [hasStrokes, setHasStrokes] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  useEffect(() => {
    try { setSaved(localStorage.getItem(SIG_KEY)); } catch {}
  }, []);

  // backing store at 2x for crisp strokes
  useEffect(() => {
    const c = canvasRef.current;
    if (!c || tab !== "draw") return;
    c.width = c.offsetWidth * 2;
    c.height = c.offsetHeight * 2;
    const ctx = c.getContext("2d")!;
    ctx.scale(2, 2);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    setHasStrokes(false);
  }, [tab]);

  const pos = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const strokeStart = (e: React.PointerEvent) => {
    const ctx = canvasRef.current!.getContext("2d")!;
    const p = pos(e);
    drawing.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  };
  const strokeMove = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const p = pos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    setHasStrokes(true);
  };
  const strokeEnd = () => { drawing.current = false; };

  const clear = () => {
    const c = canvasRef.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    setHasStrokes(false);
  };

  const buildDataUrl = (): string | null => {
    if (tab === "draw") {
      return hasStrokes ? trimToDataUrl(canvasRef.current!) : null;
    }
    const name = typed.trim();
    if (!name) return null;
    const c = document.createElement("canvas");
    c.width = Math.max(300, name.length * 64);
    c.height = 200;
    const ctx = c.getContext("2d")!;
    ctx.font = `86px ${SIG_FONT}`;
    ctx.fillStyle = ink;
    ctx.textBaseline = "middle";
    ctx.fillText(name, 20, 100);
    return trimToDataUrl(c);
  };

  const apply = (src: string | null) => {
    if (!src) {
      s.toast(tab === "draw" ? "Draw your signature first" : "Type your name first", "error");
      return;
    }
    try { localStorage.setItem(SIG_KEY, src); } catch {}
    s.set({ modal: null });
    s.placeImage(src, "Signature placed — drag it into position, then it is stamped into the PDF");
  };

  return (
    <Shell
      title="Sign document"
      foot={
        <>
          <button className="btn" onClick={() => s.set({ modal: null })}>Cancel</button>
          <button className="btn primary" onClick={() => apply(buildDataUrl())}>
            Place signature
          </button>
        </>
      }
    >
      <div className="radio-cards" style={{ marginBottom: 12 }}>
        <button className={`radio-card ${tab === "draw" ? "active" : ""}`} onClick={() => setTab("draw")}>
          <PenTool size={18} /> Draw
        </button>
        <button className={`radio-card ${tab === "type" ? "active" : ""}`} onClick={() => setTab("type")}>
          <Type size={18} /> Type
        </button>
      </div>

      {tab === "draw" ? (
        <>
          <canvas
            ref={canvasRef}
            style={{
              width: "100%", height: 170, touchAction: "none", cursor: "crosshair",
              background: "#fff", border: "1.5px dashed var(--border, #ccc)", borderRadius: 8,
            }}
            onPointerDown={strokeStart}
            onPointerMove={strokeMove}
            onPointerUp={strokeEnd}
            onPointerCancel={strokeEnd}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>Ink</span>
            <div className="swatch-row">
              {["#111111", "#1e40af"].map((c) => (
                <button key={c} className={`swatch ${ink === c ? "active" : ""}`}
                  style={{ background: c }} onClick={() => setInk(c)} />
              ))}
            </div>
            <div style={{ flex: 1 }} />
            <button className="btn small" onClick={clear}>Clear</button>
          </div>
        </>
      ) : (
        <>
          <label className="field">
            <span>Full name</span>
            <input className="input" value={typed} autoFocus placeholder="Your name"
              onChange={(e) => setTyped(e.target.value)} />
          </label>
          <div style={{
            height: 96, display: "flex", alignItems: "center", justifyContent: "center",
            background: "#fff", border: "1.5px dashed var(--border, #ccc)", borderRadius: 8,
            fontFamily: SIG_FONT, fontSize: 42, color: ink, overflow: "hidden",
          }}>
            {typed.trim() || <span style={{ opacity: 0.3, fontSize: 26 }}>Signature preview</span>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>Ink</span>
            <div className="swatch-row">
              {["#111111", "#1e40af"].map((c) => (
                <button key={c} className={`swatch ${ink === c ? "active" : ""}`}
                  style={{ background: c }} onClick={() => setInk(c)} />
              ))}
            </div>
          </div>
        </>
      )}

      {saved && (
        <div className="merge-row" style={{ marginTop: 14, cursor: "pointer" }} onClick={() => apply(saved)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={saved} alt="Saved signature" style={{ height: 30, maxWidth: 150, objectFit: "contain" }} />
          <span className="mr-name">Use saved signature</span>
          <button
            className="icon-btn" style={{ width: 22, height: 22 }}
            onClick={(e) => {
              e.stopPropagation();
              try { localStorage.removeItem(SIG_KEY); } catch {}
              setSaved(null);
            }}
            title="Delete saved signature"
          ><X size={13} /></button>
        </div>
      )}
      <div style={{ color: "var(--faint)", fontSize: 12, marginTop: 10, lineHeight: 1.5 }}>
        The signature is placed on page {s.currentPage + 1} as a movable, resizable object
        and is stamped permanently into the PDF when you deselect it.
      </div>
    </Shell>
  );
}

/* ------------------------------------------------ watermark */

function WatermarkModal() {
  const s = useEditor();
  const pages = s.meta?.pages ?? 1;
  const [text, setText] = useState("CONFIDENTIAL");
  const [color, setColor] = useState("#c0392b");
  const [opacity, setOpacity] = useState(0.18);
  const [rotate, setRotate] = useState(-45);
  const [scope, setScope] = useState<"all" | "current" | "custom">("all");
  const [ranges, setRanges] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const run = async () => {
    setErr(null);
    let spec = "all";
    if (scope === "current") spec = String(s.currentPage + 1);
    if (scope === "custom") {
      try { parseRanges(ranges, pages); spec = ranges; }
      catch (e: any) { setErr(e.message); return; }
    }
    const ok = await s.runOp("Applying watermark", () =>
      api.watermark(s.fileId!, {
        text, color, opacity, fontSize: null, rotate, pages: spec,
      }));
    if (ok) {
      s.set({ modal: null });
      s.toast("Watermark applied", "success");
    }
  };

  return (
    <Shell
      title="Add watermark"
      foot={
        <>
          <button className="btn" onClick={() => s.set({ modal: null })}>Cancel</button>
          <button className="btn primary" onClick={run}>Apply watermark</button>
        </>
      }
    >
      <label className="field">
        <span>Text</span>
        <input className="input" value={text} onChange={(e) => setText(e.target.value)} autoFocus />
      </label>
      <div style={{ display: "flex", gap: 10 }}>
        <label className="field" style={{ flex: 1 }}>
          <span>Direction</span>
          <select className="select" value={rotate} onChange={(e) => setRotate(Number(e.target.value))}>
            <option value={-45}>Diagonal ↗</option>
            <option value={45}>Diagonal ↘</option>
            <option value={0}>Horizontal</option>
          </select>
        </label>
        <label className="field" style={{ flex: 1 }}>
          <span>Color</span>
          <div className="swatch-row" style={{ paddingTop: 6 }}>
            {["#c0392b", "#7f8c8d", "#2563eb", "#111111"].map((c) => (
              <button key={c} className={`swatch ${color === c ? "active" : ""}`}
                style={{ background: c }} onClick={() => setColor(c)} />
            ))}
          </div>
        </label>
      </div>
      <label className="field">
        <span>Opacity — {Math.round(opacity * 100)}%</span>
        <input type="range" min={0.05} max={0.6} step={0.01} value={opacity}
          style={{ width: "100%" }} onChange={(e) => setOpacity(Number(e.target.value))} />
      </label>
      <label className="field">
        <span>Pages</span>
        <select className="select" value={scope} onChange={(e) => setScope(e.target.value as any)}>
          <option value="all">All pages</option>
          <option value="current">Current page ({s.currentPage + 1})</option>
          <option value="custom">Custom range…</option>
        </select>
      </label>
      {scope === "custom" && (
        <label className="field">
          <span>Range — e.g. 1-5, 8</span>
          <input className="input" value={ranges} onChange={(e) => setRanges(e.target.value)} />
        </label>
      )}
      <div style={{ color: "var(--faint)", fontSize: 12 }}>
        The watermark is stamped into the PDF immediately (unsaved edits are saved first).
      </div>
      {err && <div style={{ color: "var(--danger)", marginTop: 8 }}>{err}</div>}
    </Shell>
  );
}
