"use client";
import { ArrowLeft, Download, Eye, PanelLeft, Pencil } from "lucide-react";
import Link from "next/link";
import { useEditor } from "@/lib/store";
import { api } from "@/lib/api";

export default function PreviewTopBar() {
  const s = useEditor();

  const download = () => {
    if (s.fileId) {
      window.location.href = api.downloadUrl(s.fileId);
    }
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
      <span className="saved-chip">
        <Eye size={13} /> Reader Mode
      </span>

      <div style={{ flex: 1 }} />

      <button className="btn" onClick={download} title="Download the PDF file">
        <Download size={15} /> Download
      </button>

      <Link
        href={`/editor/${s.fileId}`}
        className="btn primary"
        title="Switch to PDF editor mode"
      >
        <Pencil size={15} /> Edit PDF
      </Link>
    </div>
  );
}
