"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";

const FileTextIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg fill="currentColor" viewBox="0 0 24 24" {...props}>
    <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm-1 7V3.5L18.5 9H13v5.5zm-4 4h8v2H8v-2zm0 4h8v2H8v-2z" />
  </svg>
);

const SparklesIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg fill="currentColor" viewBox="0 0 24 24" {...props}>
    <path d="M19 9 20.25 6.25 23 5 20.25 3.75 19 1 17.75 3.75 15 5 17.75 6.25 19 9zm-7.5 2.5L9 6 6.5 11.5 1 14l5.5 2.5L9 22l2.5-5.5L17 14l-5.5-2.5zm7.5 7.5-1.25 2.75L15 23l2.75 1.25L19 27l1.25-2.75L23 23l-2.75-1.25L19 19z" />
  </svg>
);

const TableIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg fill="currentColor" viewBox="0 0 24 24" {...props}>
    <path d="M20 2H4c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM8 20H4v-4h4v4zm0-6H4v-4h4v4zm0-6H4V4h4v4zm6 12h-4v-4h4v4zm0-6h-4v-4h4v4zm0-6h-4V4h4v4zm6 12h-4v-4h4v4zm0-6h-4v-4h4v4zm0-6h-4V4h4v4z" />
  </svg>
);

const UploadIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg fill="currentColor" viewBox="0 0 24 24" {...props}>
    <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z" />
  </svg>
);

const SettingsIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg fill="currentColor" viewBox="0 0 24 24" {...props}>
    <path d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3-1.07-3-3s1.07-3 3-3 3 1.07 3 3-1.07 3-3 3z" />
  </svg>
);

const DownloadIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg fill="currentColor" viewBox="0 0 24 24" {...props}>
    <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13l-5 5-5-5h3V9h4v4h3z" />
  </svg>
);

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

type ConvertedFile = { id: string; name: string; size: number; pages: number } | null;

export default function WordToPdfPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStep, setProcessStep] = useState<"uploading" | "converting">("uploading");
  const [error, setError] = useState<string | null>(null);
  const [sourceFile, setSourceFile] = useState<{ name: string; size: number } | null>(null);
  const [converted, setConverted] = useState<ConvertedFile>(null);
  const [toast, setToast] = useState<{ msg: string; kind: "success" | "error" } | null>(null);

  const showToast = (msg: string, kind: "success" | "error") => {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 4500);
  };

  const formatBytes = (bytes: number, decimals = 2) => {
    if (!bytes) return "0 Bytes";
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
  };

  const processFile = useCallback(async (f: File) => {
    const name = f.name.toLowerCase();
    if (!name.endsWith(".docx") && !name.endsWith(".doc")) {
      setError("Please select a valid Word file (.doc or .docx).");
      return;
    }

    setIsProcessing(true);
    setProcessStep("uploading");
    setError(null);
    setConverted(null);
    setSourceFile({ name: f.name, size: f.size });

    try {
      setProcessStep("converting");
      const fd = new FormData();
      fd.append("file", f);
      const res = await fetch(`${API_URL}/api/convert/word-to-pdf`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.detail || "Conversion failed");
      }
      setConverted({ id: data.file_id, name: data.name, size: data.size, pages: data.pages });
      showToast("Conversion successful! Your PDF is ready to download.", "success");
    } catch (err: any) {
      setError(err.message || "Conversion failed. Please try again.");
      showToast(err.message || "Conversion failed", "error");
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) processFile(f);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) processFile(f);
  };

  const resetState = () => {
    setConverted(null);
    setSourceFile(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 font-sans relative overflow-x-hidden">
      {/* Background blobs */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-violet-500/5 dark:bg-violet-600/5 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-[30%] right-10 w-[400px] h-[400px] bg-indigo-500/5 dark:bg-indigo-600/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-xl border text-sm font-semibold transition-all ${
          toast.kind === "success"
            ? "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300"
            : "bg-red-50 dark:bg-red-950/60 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300"
        }`}>
          {toast.kind === "success" ? (
            <svg className="w-4 h-4 flex-none" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
            </svg>
          ) : (
            <svg className="w-4 h-4 flex-none" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
            </svg>
          )}
          {toast.msg}
        </div>
      )}

      {/* Processing overlay */}
      {isProcessing && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex flex-col items-center justify-center gap-4">
          {/* Multi-ring spinner */}
          <div className="relative w-20 h-20">
            <div className="absolute inset-0 border-4 border-violet-400/20 border-t-violet-500 rounded-full animate-spin" />
            <div className="absolute inset-2 border-4 border-indigo-400/20 border-t-indigo-400 rounded-full animate-spin" style={{ animationDuration: "0.8s", animationDirection: "reverse" }} />
          </div>
          <p className="text-white font-semibold text-lg">
            {processStep === "uploading" ? "Uploading Word file…" : "Converting to PDF…"}
          </p>
          <p className="text-white/60 text-sm">
            {processStep === "converting" ? "Parsing layout, styles and tables" : "Reading document structure"}
          </p>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-zinc-200/50 dark:border-zinc-900/50 bg-white/70 dark:bg-zinc-950/70 backdrop-blur-md">
        <div className="max-w-5xl mx-auto h-16 px-6 flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:bg-indigo-500 transition-colors">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <span className="text-sm font-bold text-zinc-900 dark:text-white">QT PDF Editor</span>
          </Link>
          <span className="text-zinc-300 dark:text-zinc-700 select-none">/</span>
          <span className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
            {/* Word "W" icon */}
            <svg className="w-4 h-4 text-indigo-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M2.859 2.877l12.57-1.795a.5.5 0 01.571.495v19.846a.5.5 0 01-.57.495L2.858 20.123A1 1 0 012 19.135V3.864a1 1 0 01.859-.987zM17 4h3.5a.5.5 0 01.5.5v15a.5.5 0 01-.5.5H17V4zm-5.268 4.205L10.5 15l-1.232-6.795L8 15l-1.268-6.795L5.5 8.5 7.5 17h2l1-6 1 6h2l2-8.5-1.768-.295z"/>
            </svg>
            Word to PDF
          </span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-14">
        {/* Hero */}
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 text-xs font-semibold border border-violet-200/50 dark:border-violet-900/30 mb-6">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Preserves Headings, Text Styles &amp; Tables
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-zinc-900 dark:text-white mb-4">
            Convert <span className="text-violet-600 dark:text-violet-400">Word to PDF</span>
          </h1>
          <p className="text-base text-zinc-500 dark:text-zinc-400 max-w-xl mx-auto leading-relaxed">
            Turn your <strong className="text-zinc-700 dark:text-zinc-300">.docx</strong> and <strong className="text-zinc-700 dark:text-zinc-300">.doc</strong> Word documents into clean, portable PDF files instantly — headings, bold/italic text, and tables all preserved.
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div className="max-w-xl mx-auto mb-6 flex items-center gap-3 px-5 py-3 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm font-semibold">
            <svg className="w-4 h-4 flex-none" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
            </svg>
            {error}
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">✕</button>
          </div>
        )}

        <div className="max-w-xl mx-auto space-y-8">
          {/* Upload zone or Result card */}
          {!converted ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`relative w-full py-20 px-8 rounded-3xl border-2 border-dashed cursor-pointer transition-all duration-300 select-none text-center group
                bg-white/60 dark:bg-zinc-950/40 backdrop-blur-sm shadow-xl
                ${isDragging
                  ? "border-violet-500 bg-violet-50/30 dark:bg-violet-500/5 scale-[1.01]"
                  : "border-zinc-300 dark:border-zinc-800 hover:border-violet-400 dark:hover:border-violet-600"
                }`}
            >
              <input ref={fileInputRef} type="file" accept=".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={handleFileChange} className="hidden" />
              <div className="absolute top-0 right-0 w-60 h-60 bg-violet-500/10 rounded-full blur-[80px] pointer-events-none opacity-30 group-hover:opacity-70 transition-opacity" />
              <div className="relative z-10 flex flex-col items-center">
                {/* Word document icon */}
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5 transition-transform duration-300 group-hover:scale-110 bg-violet-500/10 text-violet-600 dark:text-violet-400">
                  <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 2c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6H6zm0 2h7v5h5v11H6V4zm2 8v2h8v-2H8zm0 4v2h5v-2H8z"/>
                  </svg>
                </div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-white mb-2">Drop your Word file here</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-2">Supports <span className="font-semibold text-zinc-700 dark:text-zinc-300">.docx</span> and <span className="font-semibold text-zinc-700 dark:text-zinc-300">.doc</span></p>
                <p className="text-xs text-zinc-400 dark:text-zinc-600 mb-6">or click to browse your device</p>
                <div className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition-colors shadow-md shadow-violet-600/20">
                  Select Word File
                </div>
              </div>
            </div>
          ) : (
            /* Success result card */
            <div className="p-8 rounded-3xl bg-white/60 dark:bg-zinc-950/40 border border-zinc-200/50 dark:border-zinc-900/50 backdrop-blur-sm shadow-xl space-y-6">
              {/* Header */}
              <div className="flex items-start gap-4 pb-6 border-b border-zinc-200/50 dark:border-zinc-900/50">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-white mb-1">Conversion Completed!</h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                    {sourceFile?.name} → <span className="text-indigo-600 dark:text-indigo-400 font-semibold">{converted.name}</span>
                  </p>
                </div>
              </div>

              {/* PDF info pills */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Format", value: "PDF" },
                  { label: "Pages", value: String(converted.pages) },
                  { label: "Size", value: formatBytes(converted.size) },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200/50 dark:border-zinc-800/50 p-3 text-center">
                    <p className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1">{item.label}</p>
                    <p className="text-sm font-bold text-zinc-900 dark:text-white">{item.value}</p>
                  </div>
                ))}
              </div>

              {/* Action buttons */}
              <div className="space-y-3">
                <a
                  href={`${API_URL}/api/files/${converted.id}/download`}
                  download={converted.name}
                  className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm transition-all shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/30 flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download PDF
                </a>
                <Link
                  href={`/preview/${converted.id}`}
                  className="w-full py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-700 dark:text-zinc-300 text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  Preview in Editor
                </Link>
                <button
                  onClick={resetState}
                  className="w-full py-2.5 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 text-zinc-500 dark:text-zinc-400 text-xs font-semibold transition-all"
                >
                  Convert Another File
                </button>
              </div>
            </div>
          )}

          {/* Feature pills */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: FileTextIcon, label: "PDF Output" },
              { icon: SparklesIcon, label: "Styles Kept" },
              { icon: TableIcon, label: "Tables OK" },
            ].map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.label} className="flex flex-col items-center gap-2.5 py-3.5 px-2 rounded-xl bg-white/60 dark:bg-zinc-900/40 border border-zinc-200/50 dark:border-zinc-800/50 text-center">
                  <div className="text-violet-600 dark:text-violet-400">
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-bold text-zinc-650 dark:text-zinc-400">{f.label}</span>
                </div>
              );
            })}
          </div>

          {/* How it works */}
          <div className="pt-8 border-t border-zinc-200/50 dark:border-zinc-900/50 grid sm:grid-cols-3 gap-6">
            {[
              { step: "01", title: "Upload .docx", desc: "Drop or pick your Word document from your device.", icon: UploadIcon },
              { step: "02", title: "Auto Convert", desc: "We parse your document structure, headings, and tables.", icon: SettingsIcon },
              { step: "03", title: "Download PDF", desc: "Get a clean, portable PDF file instantly.", icon: DownloadIcon },
            ].map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.step} className="p-5 rounded-2xl bg-white/40 dark:bg-zinc-900/20 border border-zinc-200/50 dark:border-zinc-800/50 flex flex-col items-start">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/40">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="text-xs font-black text-violet-500 dark:text-violet-400 uppercase tracking-widest mb-1.5">{s.step}</div>
                  <h4 className="text-xs font-bold text-zinc-900 dark:text-white mb-1">{s.title}</h4>
                  <p className="text-[11px] text-zinc-550 dark:text-zinc-400 leading-normal">{s.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
