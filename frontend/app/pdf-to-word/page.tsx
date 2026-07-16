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

const ShieldCheckIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg fill="currentColor" viewBox="0 0 24 24" {...props}>
    <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" />
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

type FileState = { id: string; name: string; size: number } | null;

export default function PdfToWordPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<FileState>(null);
  const [toast, setToast] = useState<{ msg: string; kind: "success" | "error" } | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultName, setResultName] = useState("");

  const showToast = (msg: string, kind: "success" | "error") => {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 4500);
  };

  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [passwordValue, setPasswordValue] = useState("");
  const [passwordErrorMsg, setPasswordErrorMsg] = useState<string | null>(null);
  const [pendingFileState, setPendingFileState] = useState<{ id: string; name: string } | null>(null);

  const convertFile = async (uploadedFile: { id: string; name: string }, password?: string) => {
    setIsConverting(true);
    setError(null);
    try {
      const url = `${API_URL}/api/files/${uploadedFile.id}/pdf-to-word` + (password ? `?password=${encodeURIComponent(password)}` : "");
      const res = await fetch(url, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401 || data.detail === "password_required" || data.detail === "invalid_password") {
          const isInvalid = data.detail === "invalid_password";
          setPendingFileState(uploadedFile);
          setPasswordErrorMsg(isInvalid ? "Incorrect password. Please try again." : null);
          setPasswordModalOpen(true);
          return;
        }
        throw new Error(data.error || data.detail || "Conversion failed");
      }
      
      const newName = uploadedFile.name.replace(/\.pdf$/i, "") + ".docx";
      setResultUrl(`${API_URL}/api/files/${uploadedFile.id}/download-word`);
      setResultName(newName);
      showToast("Conversion successful! Your Word document is ready.", "success");
    } catch (err: any) {
      setError(err.message || "Failed to convert PDF to Word");
      showToast(err.message || "Conversion failed", "error");
    } finally {
      setIsConverting(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingFileState) return;
    const pwd = passwordValue;
    setPasswordModalOpen(false);
    setPasswordValue("");
    setPasswordErrorMsg(null);
    await convertFile(pendingFileState, pwd);
  };

  const handlePasswordCancel = () => {
    setPasswordModalOpen(false);
    setPasswordValue("");
    setPasswordErrorMsg(null);
    setPendingFileState(null);
    setError("Password required to convert this PDF file.");
    showToast("Password required to convert this PDF file.", "error");
  };

  const uploadFile = useCallback(async (f: File) => {
    if (!f || f.type !== "application/pdf") {
      setError("Please select a valid PDF file.");
      return;
    }
    setIsUploading(true);
    setError(null);
    setFile(null);
    setResultUrl(null);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const res = await fetch(`${API_URL}/api/files/upload`, { method: "POST", body: fd });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.detail || `Upload failed (${res.status})`);
      }
      const meta = await res.json();
      const uploaded = { id: meta.id, name: meta.name, size: meta.size };
      setFile(uploaded);
      
      // Auto-trigger conversion
      await convertFile(uploaded);
    } catch (err: any) {
      setError(err.message || "Upload failed");
    } finally {
      setIsUploading(false);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) uploadFile(f);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) uploadFile(f);
  };

  const resetState = () => {
    setFile(null);
    setResultUrl(null);
    setResultName("");
    setError(null);
  };

  // Helper to format bytes
  const formatBytes = (bytes: number, decimals = 2) => {
    if (!bytes) return "0 Bytes";
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 font-sans relative overflow-x-hidden">
      {/* Background blobs */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-indigo-500/5 dark:bg-indigo-600/5 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-[30%] right-10 w-[400px] h-[400px] bg-violet-500/5 dark:bg-violet-600/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-xl border text-sm font-semibold transition-all ${
          toast.kind === "success"
            ? "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300"
            : "bg-red-50 dark:bg-red-950/60 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300"
        }`}>
          {toast.kind === "success" ? (
            <svg className="w-4 h-4 flex-none" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
          ) : (
            <svg className="w-4 h-4 flex-none" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
          )}
          {toast.msg}
        </div>
      )}

      {/* Upload/Convert progress overlay */}
      {(isUploading || isConverting) && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex flex-col items-center justify-center gap-4">
          <div className="w-14 h-14 border-4 border-indigo-400/30 border-t-indigo-500 rounded-full animate-spin" />
          <p className="text-white font-semibold text-lg">
            {isUploading ? "Uploading PDF…" : "Converting PDF to Word…"}
          </p>
          <p className="text-white/60 text-sm">
            {isUploading ? "Getting file details" : "Analyzing layout, text and graphics"}
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
            <svg className="w-4 h-4 text-indigo-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm-1 7V3.5L18.5 9H13v5.5zm-4 4h8v2H8v-2z" />
            </svg>
            PDF to Word
          </span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-14">
        {/* Hero */}
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 text-xs font-semibold border border-indigo-200/50 dark:border-indigo-900/30 mb-6">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 100-6 3 3 0 000 6z" />
            </svg>
            Advanced Layout & Typography Reconstruction
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-zinc-900 dark:text-white mb-4">
            Convert <span className="text-indigo-600 dark:text-indigo-400">PDF to Word</span>
          </h1>
          <p className="text-base text-zinc-500 dark:text-zinc-400 max-w-xl mx-auto leading-relaxed">
            Transform your static PDF documents into fully editable Microsoft Word (.docx) files. All formatting, text alignments, and tables will be accurately preserved.
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div className="max-w-xl mx-auto mb-6 flex items-center gap-3 px-5 py-3 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm font-semibold">
            <svg className="w-4 h-4 flex-none" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
            {error}
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">✕</button>
          </div>
        )}

        <div className="max-w-xl mx-auto space-y-8">
          {/* Upload zone or Result display */}
          {!resultUrl ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`relative w-full py-20 px-8 rounded-3xl border-2 border-dashed cursor-pointer transition-all duration-300 select-none text-center group
                bg-white/60 dark:bg-zinc-950/40 backdrop-blur-sm shadow-xl
                ${isDragging
                  ? "border-indigo-500 bg-indigo-50/30 dark:bg-indigo-500/5 scale-[1.01]"
                  : "border-zinc-300 dark:border-zinc-800 hover:border-indigo-400 dark:hover:border-indigo-600"
                }`}
            >
              <input ref={fileInputRef} type="file" accept=".pdf" onChange={handleFileChange} className="hidden" />
              <div className="absolute top-0 right-0 w-60 h-60 bg-indigo-500/10 rounded-full blur-[80px] pointer-events-none opacity-30 group-hover:opacity-70 transition-opacity" />
              <div className="relative z-10 flex flex-col items-center">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5 transition-transform duration-300 group-hover:scale-110 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z"/>
                  </svg>
                </div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-white mb-2">Drop your PDF here</h3>
                <p className="text-sm text-zinc-550 dark:text-zinc-400 mb-6">or click to browse your device</p>
                <div className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors shadow-md shadow-indigo-600/20">
                  Select PDF File
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 rounded-3xl bg-white/60 dark:bg-zinc-950/40 border border-zinc-200/50 dark:border-zinc-900/50 backdrop-blur-sm shadow-xl space-y-6">
              <div className="flex items-center gap-4 pb-6 border-b border-zinc-200/50 dark:border-zinc-900/50">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-white mb-0.5">Conversion Completed!</h3>
                  <p className="text-xs text-zinc-550 dark:text-zinc-400 truncate max-w-[320px]">
                    Source file: {file?.name} ({file ? formatBytes(file.size) : ""})
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <a
                  href={resultUrl}
                  download={resultName}
                  className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm transition-all shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/30 flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download Word Document (.docx)
                </a>

                <button
                  onClick={resetState}
                  className="w-full py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-700 dark:text-zinc-200 text-xs font-semibold transition-all"
                >
                  Convert Another File
                </button>
              </div>
            </div>
          )}

          {/* Quick specs banner */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: FileTextIcon, label: "Word (.docx)" },
              { icon: SparklesIcon, label: "Layout Kept" },
              { icon: ShieldCheckIcon, label: "100% Secure" },
            ].map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.label} className="flex flex-col items-center gap-2.5 py-3.5 px-2 rounded-xl bg-white/60 dark:bg-zinc-900/40 border border-zinc-200/50 dark:border-zinc-800/50 text-center">
                  <div className="text-indigo-650 dark:text-indigo-400">
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-bold text-zinc-650 dark:text-zinc-400">{f.label}</span>
                </div>
              );
            })}
          </div>

          {/* How it works steps */}
          <div className="pt-8 border-t border-zinc-200/50 dark:border-zinc-900/50 grid sm:grid-cols-3 gap-6">
            {[
              {
                step: "01",
                title: "Upload PDF",
                desc: "Drop or choose the PDF document you want to convert.",
                icon: UploadIcon,
              },
              {
                step: "02",
                title: "Processing",
                desc: "Our engine parses text layout and forms editable blocks.",
                icon: SettingsIcon,
              },
              {
                step: "03",
                title: "Download DOCX",
                desc: "Download the converted Word document instantly.",
                icon: DownloadIcon,
              },
            ].map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.step} className="p-5 rounded-2xl bg-white/40 dark:bg-zinc-900/20 border border-zinc-200/50 dark:border-zinc-800/50 flex flex-col items-start">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="text-xs font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-widest mb-1.5">{s.step}</div>
                  <h4 className="text-xs font-bold text-zinc-900 dark:text-white mb-1">{s.title}</h4>
                  <p className="text-[11px] text-zinc-550 dark:text-zinc-400 leading-normal">{s.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      {/* Password Modal */}
      {passwordModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-2xl space-y-6 relative overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Background Glow */}
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-indigo-500/10 rounded-full blur-[40px] pointer-events-none" />
            
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-650 dark:text-indigo-400 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-white">Password Protected PDF</h3>
                <p className="text-xs text-zinc-550 dark:text-zinc-400">Enter password to decrypt and convert</p>
              </div>
            </div>

            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-550 dark:text-zinc-400 uppercase tracking-wider mb-2">
                  PDF Password
                </label>
                <input
                  type="password"
                  autoFocus
                  required
                  value={passwordValue}
                  onChange={(e) => setPasswordValue(e.target.value)}
                  placeholder="Enter document password"
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm placeholder-zinc-400 text-zinc-900 dark:text-zinc-100 transition-all"
                />
                {passwordErrorMsg && (
                  <p className="text-xs font-semibold text-red-650 dark:text-red-400 mt-2 flex items-center gap-1.5 animate-pulse">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {passwordErrorMsg}
                  </p>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handlePasswordCancel}
                  className="flex-1 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-700 dark:text-zinc-200 font-bold text-sm transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-xl bg-indigo-650 hover:bg-indigo-500 text-white font-bold text-sm transition-all shadow-lg shadow-indigo-600/20"
                >
                  Convert PDF
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
