"use client";
import {
  ArrowLeft, Check, ChevronDown, Download, Eye, FileOutput, GitMerge,
  Loader2, PanelLeft, PanelRight, Redo2, Save, Scissors, Stamp, Undo2,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useDirty, useEditor } from "@/lib/store";

export default function TopBar() {
  const s = useEditor();
  const dirty = useDirty();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [menuOpen]);

  const download = async () => {
    if (!(await s.ensureSaved())) return;
    window.location.href = api.downloadUrl(s.fileId!);
  };

  const handlePreview = async () => {
    if (dirty) {
      const saved = await s.save();
      if (!saved) return;
    }
    router.push(`/preview/${s.fileId}`);
  };

  return (
    <div className="topbar">
      <Link href="/" className="icon-btn" title="Back to library">
        <ArrowLeft size={17} />
      </Link>
      <button
        className={`icon-btn ${s.leftOpen ? "active" : ""}`}
        title="Toggle pages panel"
        onClick={() => s.set({ leftOpen: !s.leftOpen })}
      >
        <PanelLeft size={16} />
      </button>

      <span className="fname" title={s.meta?.name}>{s.meta?.name}</span>
      {dirty || s.saving ? (
        <span className="saved-chip" title="Edits are being written into the PDF">
          <Loader2 size={12} className="spin" /> Writing to PDF…
        </span>
      ) : (
        <span className="saved-chip"><Check size={13} /> All changes in the PDF</span>
      )}

      <div style={{ flex: 1 }} />

      <button
        className="icon-btn" title="Undo (Ctrl+Z)"
        disabled={!s.past.length && !s.meta?.can_undo}
        onClick={() => s.undo()}
      >
        <Undo2 size={16} />
      </button>
      <button
        className="icon-btn" title="Redo (Ctrl+Y)"
        disabled={!s.future.length && !s.meta?.can_redo}
        onClick={() => s.redo()}
      >
        <Redo2 size={16} />
      </button>
      <div className="divider-v" />

      <div className="menu-wrap" ref={menuRef}>
        <button className="btn" onClick={() => setMenuOpen(!menuOpen)}>
          Organize <ChevronDown size={14} />
        </button>
        {menuOpen && (
          <div className="menu-pop">
            <button onClick={() => { setMenuOpen(false); s.set({ modal: "split" }); }}>
              <Scissors size={15} /> Split document…
            </button>
            <button onClick={() => { setMenuOpen(false); s.set({ modal: "merge" }); }}>
              <GitMerge size={15} /> Merge documents…
            </button>
            <button onClick={() => { setMenuOpen(false); s.set({ modal: "watermark" }); }}>
              <Stamp size={15} /> Add watermark…
            </button>
            <div className="hint">Page rotate / delete / duplicate / extract live in the Pages panel</div>
          </div>
        )}
      </div>

      <button className="btn" onClick={() => s.set({ modal: "export" })}>
        <FileOutput size={15} /> Export
      </button>
      <button className="btn" onClick={download} title="Download the PDF file">
        <Download size={15} /> Download
      </button>
      <button
        className="btn"
        onClick={handlePreview}
        title="Switch to preview/viewer mode"
      >
        <Eye size={15} /> Preview
      </button>
      <button
        className="btn primary" onClick={() => s.save()}
        disabled={s.saving || !dirty}
        title="Edits are written to the PDF automatically — this forces it right now"
      >
        {s.saving ? <Loader2 size={15} className="spin" /> : <Save size={15} />}
        {s.saving ? "Writing…" : "Save now"}
      </button>
      <button
        className={`icon-btn ${s.rightOpen ? "active" : ""}`}
        title="Toggle properties panel"
        onClick={() => s.set({ rightOpen: !s.rightOpen })}
      >
        <PanelRight size={16} />
      </button>
    </div>
  );
}
