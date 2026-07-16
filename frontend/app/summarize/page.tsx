"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

type SummaryMode = "short" | "medium" | "detailed";

export default function SummarizePage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fileName, setFileName] = useState<string | null>(null);
  const [fileId, setFileId] = useState<string | null>(null);
  const [mode, setMode] = useState<SummaryMode>("medium");
  const [summary, setSummary] = useState<string | null>(null);

  const [toast, setToast] = useState<{ msg: string; kind: "success" | "error" } | null>(null);

  const showToast = (msg: string, kind: "success" | "error") => {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 4500);
  };

  const uploadFile = useCallback(async (file: File) => {
    if (!file || file.type !== "application/pdf") {
      setError("Please select a valid PDF file.");
      return;
    }
    setIsUploading(true);
    setError(null);
    setSummary(null);
    setFileName(file.name);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${API_URL}/api/files/upload`, { method: "POST", body: fd });
      if (!res.ok) {
        let msg = `Upload failed (${res.status})`;
        try { const j = await res.json(); if (j?.detail) msg = j.detail; } catch {}
        throw new Error(msg);
      }
      const meta = await res.json();
      setFileId(meta.id);
      showToast("PDF uploaded successfully!", "success");
    } catch (err: any) {
      setError(err.message || "Upload failed");
    } finally {
      setIsUploading(false);
    }
  }, []);

  const handleSummarize = async (overrideMode?: SummaryMode) => {
    if (!fileId) return;
    const activeMode = overrideMode || mode;
    setIsSummarizing(true);
    setError(null);
    setSummary(null);
    try {
      const res = await fetch(`${API_URL}/api/files/${fileId}/summarize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: activeMode }),
      });
      if (!res.ok) {
        let msg = `Summarization failed (${res.status})`;
        try { const j = await res.json(); if (j?.detail) msg = j.detail; } catch {}
        throw new Error(msg);
      }
      const data = await res.json();
      setSummary(data.summary);
      showToast("Summary generated!", "success");
    } catch (err: any) {
      setError(err.message || "Summarization failed");
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  };
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = "";
  };
  const reset = () => {
    setFileId(null); setFileName(null); setSummary(null); setError(null);
  };

  const copyToClipboard = () => {
    if (!summary) return;
    navigator.clipboard.writeText(summary).then(() => showToast("Copied to clipboard!", "success"));
  };

  const downloadSummary = async (format: "pdf" | "docx") => {
    if (!summary) return;
    try {
      const exportName = `${(fileName || "document").replace(/\.pdf$/i, "")}_summary`;
      const res = await fetch(`${API_URL}/api/files/summarize/export?format=${format}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          markdown: summary,
          filename: exportName
        }),
      });
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${exportName}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      showToast(`Downloaded ${format.toUpperCase()} summary successfully!`, "success");
    } catch (err: any) {
      showToast(err.message || "Failed to download summary", "error");
    }
  };


  // Simple markdown-to-HTML renderer for display
  const renderMarkdown = (md: string) => {
    const lines = md.split("\n");
    const html: string[] = [];
    let inList = false;

    const parseInline = (s: string) => {
      const escaped = escHtml(s);
      return escaped
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        .replace(/__(.*?)__/g, "<strong>$1</strong>")
        .replace(/\*(.*?)\*/g, "<em>$1</em>")
        .replace(/_(.*?)_/g, "<em>$1</em>");
    };

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        if (inList) { html.push("</ul>"); inList = false; }
        html.push("<br/>");
        continue;
      }

      if (trimmed.startsWith("# ")) {
        if (inList) { html.push("</ul>"); inList = false; }
        html.push(`<h1 class="text-2xl font-extrabold text-zinc-900 dark:text-white mt-6 mb-2">${parseInline(trimmed.slice(2))}</h1>`);
      } else if (trimmed.startsWith("## ")) {
        if (inList) { html.push("</ul>"); inList = false; }
        html.push(`<h2 class="text-lg font-bold text-zinc-800 dark:text-zinc-100 mt-5 mb-2 border-b border-zinc-200 dark:border-zinc-800 pb-1">${parseInline(trimmed.slice(3))}</h2>`);
      } else if (trimmed.startsWith("### ")) {
        if (inList) { html.push("</ul>"); inList = false; }
        html.push(`<h3 class="text-sm font-bold text-indigo-600 dark:text-indigo-400 mt-4 mb-1">${parseInline(trimmed.slice(4))}</h3>`);
      } else if (trimmed.startsWith("- [ ] ")) {
        if (!inList) { html.push('<ul class="space-y-1.5 my-2">'); inList = true; }
        html.push(`<li class="flex items-start gap-2 text-xs text-zinc-600 dark:text-zinc-300"><input type="checkbox" disabled class="mt-0.5 accent-indigo-600"/><span>${parseInline(trimmed.slice(6))}</span></li>`);
      } else if (trimmed.startsWith("- ")) {
        if (!inList) { html.push('<ul class="space-y-1.5 my-2">'); inList = true; }
        html.push(`<li class="flex items-start gap-2 text-xs text-zinc-600 dark:text-zinc-300"><span class="text-indigo-500 mt-0.5">•</span><span>${parseInline(trimmed.slice(2))}</span></li>`);
      } else if (trimmed.startsWith("*") && trimmed.endsWith("*")) {
        if (inList) { html.push("</ul>"); inList = false; }
        html.push(`<p class="text-xs italic text-zinc-400 mb-2">${parseInline(trimmed.replace(/^\*+|\*+$/g, ""))}</p>`);
      } else {
        if (inList) { html.push("</ul>"); inList = false; }
        html.push(`<p class="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed mb-2">${parseInline(trimmed)}</p>`);
      }
    }
    if (inList) html.push("</ul>");
    return html.join("\n");
  };

  const escHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const modes: { id: SummaryMode; label: string; desc: string }[] = [
    { id: "short", label: "Short", desc: "Executive overview with top key points" },
    { id: "medium", label: "Medium", desc: "Balanced summary with sections & entities" },
    { id: "detailed", label: "Detailed", desc: "Comprehensive analysis with all extracted data" },
  ];

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 transition-colors font-sans relative overflow-x-hidden">
      {/* Background blobs */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-indigo-500/5 dark:bg-indigo-600/5 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-0 right-10 w-[500px] h-[500px] bg-violet-500/5 dark:bg-violet-600/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-xl border ${
          toast.kind === "success"
            ? "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300"
            : "bg-red-50 dark:bg-red-950/60 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300"
        }`}>
          <span className="text-sm font-semibold">{toast.msg}</span>
        </div>
      )}

      {/* Header */}
      <header className="relative z-10 px-6 py-5 flex items-center justify-between max-w-7xl mx-auto">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-indigo-600/20 group-hover:shadow-indigo-600/40 transition-shadow">
            <svg className="w-4.5 h-4.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <span className="text-lg font-extrabold tracking-tight">QT PDF Editor</span>
        </Link>
        <Link href="/" className="text-xs font-semibold text-zinc-500 hover:text-indigo-600 transition-colors">
          ← Back to Home
        </Link>
      </header>

      <main className="relative z-10 max-w-5xl mx-auto px-6 pb-24">
        {/* Hero */}
        <div className="text-center mb-12 pt-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 mb-4">
            <svg className="w-3.5 h-3.5 text-indigo-600" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2L9 9 2 12l7 3 3 7 3-7 7-3-7-3-3-7z" />
            </svg>
            <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300">AI-Powered Summarization</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-zinc-900 dark:text-white">
            Summarize any PDF instantly
          </h1>
          <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400 max-w-lg mx-auto leading-relaxed">
            Upload your document and get an executive summary with key insights, important dates, figures, names, and actionable next steps — all in seconds.
          </p>
        </div>

        {/* Upload & Controls */}
        {!summary ? (
          <div className="max-w-2xl mx-auto space-y-8">
            {/* Upload Zone */}
            {!fileId ? (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all group ${
                  isDragging
                    ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30 scale-[1.01]"
                    : "border-zinc-300 dark:border-zinc-800 hover:border-indigo-400 dark:hover:border-indigo-700 bg-white/60 dark:bg-zinc-950/40 hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20"
                }`}
              >
                <input ref={fileInputRef} type="file" accept=".pdf" onChange={handleFileChange} className="hidden" />
                {isUploading ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-12 h-12 border-4 border-indigo-400/30 border-t-indigo-500 rounded-full animate-spin" />
                    <p className="text-sm font-semibold text-zinc-600 dark:text-zinc-300">Uploading PDF…</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-14 h-14 rounded-2xl bg-indigo-100 dark:bg-indigo-950/60 flex items-center justify-center group-hover:scale-105 transition-transform">
                      <svg className="w-7 h-7 text-indigo-600" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-zinc-700 dark:text-zinc-200">
                        Drop your PDF here or <span className="text-indigo-600">browse files</span>
                      </p>
                      <p className="text-xs text-zinc-400 mt-1">Supports all standard PDF documents</p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* File uploaded — show mode selection & summarize button */
              <div className="bg-white/70 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 space-y-6">
                {/* File info */}
                <div className="flex items-center gap-3 p-4 rounded-xl bg-zinc-100/80 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800">
                  <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-950/40 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm-1 7V3.5L18.5 9H13v5.5z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-zinc-900 dark:text-white truncate">{fileName}</p>
                    <p className="text-xs text-zinc-400">Ready for summarization</p>
                  </div>
                  <button onClick={reset} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer" title="Remove file">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                    </svg>
                  </button>
                </div>

                {/* Summary Mode Selector */}
                <div>
                  <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-3">Summary Mode</label>
                  <div className="grid grid-cols-3 gap-3">
                    {modes.map(m => (
                      <button
                        key={m.id}
                        onClick={() => setMode(m.id)}
                        className={`p-4 rounded-xl border-2 transition-all cursor-pointer text-left ${
                          mode === m.id
                            ? "border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/30 shadow-sm"
                            : "border-zinc-200 dark:border-zinc-800 hover:border-indigo-300 dark:hover:border-indigo-700"
                        }`}
                      >
                        <p className={`text-sm font-bold ${mode === m.id ? "text-indigo-700 dark:text-indigo-300" : "text-zinc-700 dark:text-zinc-300"}`}>
                          {m.label}
                        </p>
                        <p className="text-[10px] text-zinc-400 mt-0.5 leading-snug">{m.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Summarize Button */}
                <button
                  onClick={() => handleSummarize()}
                  disabled={isSummarizing}
                  className="w-full py-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-sm transition-all shadow-md shadow-indigo-600/15 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 uppercase tracking-widest select-none"
                >
                  {isSummarizing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Analyzing document…
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2L9 9 2 12l7 3 3 7 3-7 7-3-7-3-3-7z" />
                      </svg>
                      Generate Summary
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="flex items-center gap-3 px-5 py-3 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300">
                <svg className="w-4 h-4 flex-none" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span className="text-sm font-semibold">{error}</span>
              </div>
            )}
          </div>
        ) : (
          /* Summary Results */
          <div className="space-y-6">
            {/* Controls bar */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <button onClick={reset} className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-950/40 text-xs font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-all cursor-pointer">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                  New Document
                </button>
                <div className="flex items-center gap-1 bg-zinc-100/80 dark:bg-zinc-900/60 rounded-xl p-0.5">
                  {modes.map(m => (
                    <button
                      key={m.id}
                      onClick={() => { setMode(m.id); handleSummarize(m.id); }}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider cursor-pointer transition-all ${
                        mode === m.id
                          ? "bg-indigo-600 text-white shadow-sm"
                          : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={copyToClipboard} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-950/40 text-xs font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-all cursor-pointer">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy
                </button>
                <button onClick={() => downloadSummary("pdf")} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-sm cursor-pointer">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download PDF
                </button>
                <button onClick={() => downloadSummary("docx")} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-bold transition-all shadow-sm cursor-pointer border border-zinc-300/40 dark:border-zinc-800">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download Word
                </button>
              </div>
            </div>

            {/* Summary Card Styled like a PDF Document Page */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 rounded-lg p-10 sm:p-14 shadow-2xl max-w-3xl mx-auto min-h-[850px] flex flex-col justify-between relative">
              {/* PDF Sheet Header watermark */}
              <div className="flex justify-between items-center text-[10px] text-zinc-400 border-b border-zinc-100 dark:border-zinc-800 pb-3 mb-8 select-none">
                <span className="font-bold tracking-wider uppercase">QT PDF Studio — Summary Report</span>
                <span className="font-mono">{new Date().toLocaleDateString()}</span>
              </div>

              {isSummarizing ? (
                <div className="flex-1 flex flex-col items-center justify-center py-16 gap-4">
                  <div className="w-12 h-12 border-4 border-indigo-400/30 border-t-indigo-500 rounded-full animate-spin" />
                  <p className="text-sm font-semibold text-zinc-500">Regenerating summary…</p>
                </div>
              ) : (
                <div className="flex-1">
                  <div
                    className="prose prose-sm dark:prose-invert max-w-none prose-headings:text-zinc-900 dark:prose-headings:text-white prose-p:leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(summary) }}
                  />
                </div>
              )}

              {/* PDF Sheet Footer watermark */}
              <div className="flex justify-between items-center text-[9px] text-zinc-450 border-t border-zinc-100 dark:border-zinc-800 pt-3 mt-12 select-none">
                <span className="truncate max-w-[280px]">Source: {fileName}</span>
                <span className="font-bold tracking-widest uppercase">Page 1 of 1</span>
              </div>
            </div>

            {/* File info */}
            <div className="text-center text-xs text-zinc-400">
              Summarized from <span className="font-bold text-zinc-500">{fileName}</span> · {mode.charAt(0).toUpperCase() + mode.slice(1)} mode
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
