"use client";
import {
  ArrowLeft, Check, Download, Eye, FileOutput, GitCompare, Loader2, PanelLeft, PanelRight,
  Save,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useDirty, useEditor } from "@/lib/store";

/**
 * Title row: navigation left, file name centred, document actions right (where
 * Docs parks Share). Left and right rails both flex:1, which is what keeps the
 * name optically centred whatever each rail contains.
 */
export default function TopBar() {
  const s = useEditor();
  const dirty = useDirty();
  const router = useRouter();

  const download = async () => {
    if (!(await s.ensureSaved())) return;
    window.location.href = api.downloadUrl(s.fileId!);
  };
  const preview = async () => {
    if (dirty && !(await s.save())) return;
    router.push(`/preview/${s.fileId}`);
  };

  return (
    <div className="topbar">
      <div className="tb-left">
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
      </div>

      <div className="tb-center">
        <span className="fname" title={s.meta?.name}>{s.meta?.name}</span>
      </div>

      <div className="tb-right">
        {dirty || s.saving ? (
          <span className="saved-chip" title="Edits are being written into the PDF">
            <Loader2 size={12} className="spin" /> Writing to PDF…
          </span>
        ) : (
          <span className="saved-chip"><Check size={13} /> All changes in the PDF</span>
        )}
        <div className="divider-v" />

        <button className="icon-btn" title="Export" onClick={() => s.set({ modal: "export" })}>
          <FileOutput size={16} />
        </button>
        <button className="icon-btn" title="Download the PDF file" onClick={download}>
          <Download size={16} />
        </button>
        <button className="icon-btn" title="Compare PDF versions" onClick={async () => {
          if (dirty) await s.save();
          router.push(`/tools/compare?originalId=${s.fileId}&compareVersions=true`);
        }}>
          <GitCompare size={16} />
        </button>
        <button className="icon-btn" title="Switch to preview/viewer mode" onClick={preview}>
          <Eye size={16} />
        </button>
        <button
          className="btn primary small" onClick={() => s.save()}
          disabled={s.saving || !dirty}
          title="Edits are written to the PDF automatically — this forces it right now"
        >
          {s.saving ? <Loader2 size={14} className="spin" /> : <Save size={14} />}
          {s.saving ? "Saving…" : "Save"}
        </button>

        <div className="divider-v" />
        <button
          className={`icon-btn ${s.rightOpen ? "active" : ""}`}
          title="Toggle properties panel"
          onClick={() => s.set({ rightOpen: !s.rightOpen })}
        >
          <PanelRight size={16} />
        </button>
      </div>
    </div>
  );
}
