"use client";
import {
  ArrowDown, ArrowUp, FileImage, FileText, Loader2, X,
} from "lucide-react";
import { useEffect, useState } from "react";
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
  const [format, setFormat] = useState<"pdf" | "png" | "jpg">("pdf");
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
        {(["pdf", "png", "jpg"] as const).map((f) => (
          <button key={f} className={`radio-card ${format === f ? "active" : ""}`}
            onClick={() => setFormat(f)}>
            {f === "pdf" ? <FileText size={19} /> : <FileImage size={19} />}
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
      {format !== "pdf" && (
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
        {format === "pdf"
          ? "Exports the selected pages as a PDF download. Unsaved edits are saved first."
          : "Multiple pages are downloaded as a ZIP of images. Unsaved edits are saved first."}
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
              <a className="btn small" href={`/editor?id=${f.id}`}>Open</a>
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
      window.location.href = `/editor?id=${meta.id}`;
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
