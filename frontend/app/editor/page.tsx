"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const PencilIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg fill="currentColor" viewBox="0 0 24 24" {...props}>
    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
  </svg>
);

const ImageIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg fill="currentColor" viewBox="0 0 24 24" {...props}>
    <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
  </svg>
);

const CommentIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg fill="currentColor" viewBox="0 0 24 24" {...props}>
    <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
  </svg>
);

const UploadIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg fill="currentColor" viewBox="0 0 24 24" {...props}>
    <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z" />
  </svg>
);

const DownloadIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg fill="currentColor" viewBox="0 0 24 24" {...props}>
    <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13l-5 5-5-5h3V9h4v4h3z" />
  </svg>
);

const FileTextIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg fill="currentColor" viewBox="0 0 24 24" {...props}>
    <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm-1 7V3.5L18.5 9H13v5.5zm-4 4h8v2H8v-2zm0 4h8v2H8v-2z" />
  </svg>
);

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

export default function EditPDFPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadAndEdit = useCallback(async (f: File) => {
    if (!f || f.type !== "application/pdf") {
      setError("Please select a valid PDF file.");
      return;
    }
    setIsUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const res = await fetch(`${API_URL}/api/files/upload`, { method: "POST", body: fd });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.detail || `Upload failed (${res.status})`);
      }
      const meta = await res.json();
      router.push(`/preview/${meta.id}`);
    } catch (err: any) {
      setError(err.message || "Upload failed. Please try again.");
      setIsUploading(false);
    }
  }, [router]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      if (f.type !== "application/pdf") {
        setError("Please select a valid PDF file.");
        return;
      }
      setFile(f);
      setError(null);
    }
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) {
      if (f.type !== "application/pdf") {
        setError("Please select a valid PDF file.");
        return;
      }
      setFile(f);
      setError(null);
    }
  };

  const clearFile = () => {
    setFile(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 font-sans relative overflow-x-hidden">
      {/* Background blobs */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-indigo-500/5 dark:bg-indigo-600/5 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-violet-500/5 dark:bg-violet-600/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Upload overlay */}
      {isUploading && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex flex-col items-center justify-center gap-4">
          <div className="w-14 h-14 border-4 border-indigo-400/30 border-t-indigo-500 rounded-full animate-spin" />
          <p className="text-white font-semibold text-lg">Uploading PDF…</p>
          <p className="text-white/60 text-sm">Opening editor in a moment</p>
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
              <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
            </svg>
            Edit PDF
          </span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-14">
        {/* Hero */}
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 text-xs font-semibold border border-indigo-200/50 dark:border-indigo-900/30 mb-6">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
            </svg>
            Text · Images · Shapes · Annotations
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-zinc-900 dark:text-white mb-4">
            Edit your <span className="text-indigo-600 dark:text-indigo-400">PDF</span> files
          </h1>
          <p className="text-base text-zinc-500 dark:text-zinc-400 max-w-xl mx-auto leading-relaxed">
            Upload any PDF to open it in the full-featured editor. Modify text, insert images, add shapes, highlights, annotations and more — then download your updated file.
          </p>
        </div>

        {/* Error banner */}
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
          {/* Drop zone or Selected file card */}
          {!file ? (
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
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleFileChange}
                className="hidden"
              />
              {/* Glow blob */}
              <div className="absolute top-0 right-0 w-60 h-60 bg-indigo-500/10 rounded-full blur-[80px] pointer-events-none opacity-30 group-hover:opacity-70 transition-opacity" />

              <div className="relative z-10 flex flex-col items-center">
                {/* Animated icon */}
                <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 transition-transform duration-300 group-hover:scale-110">
                  <UploadIcon className="w-10 h-10" />
                </div>

                <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">
                  {isDragging ? "Release to upload" : "Drop your PDF here"}
                </h2>
                <p className="text-sm text-zinc-555 dark:text-zinc-400 mb-8">
                  or click to browse from your device
                </p>

                <div className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all shadow-lg shadow-indigo-600/25 hover:shadow-indigo-600/40 group-hover:-translate-y-0.5">
                  Select PDF File
                </div>

                <p className="mt-4 text-xs text-zinc-400 dark:text-zinc-600">
                  Supports any standard PDF · No file size limit
                </p>
              </div>
            </div>
          ) : (
            <div className="p-8 rounded-3xl bg-white/60 dark:bg-zinc-950/40 border border-zinc-200/50 dark:border-zinc-900/50 backdrop-blur-sm shadow-xl space-y-6">
              <div className="flex items-center gap-4 pb-6 border-b border-zinc-200/50 dark:border-zinc-900/50">
                <div className="w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                  <FileTextIcon className="w-6 h-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-white mb-0.5">PDF File Selected</h3>
                  <p className="text-xs text-zinc-550 dark:text-zinc-400 truncate max-w-[320px]">
                    {file.name}
                  </p>
                </div>
                <button
                  onClick={clearFile}
                  className="shrink-0 p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:text-zinc-600 transition-colors"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => uploadAndEdit(file)}
                  className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm transition-all shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/30 flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                  </svg>
                  Edit PDF File
                </button>

                <button
                  onClick={clearFile}
                  className="w-full py-2.5 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 text-zinc-700 dark:text-zinc-200 text-xs font-semibold transition-all"
                >
                  Choose Different File
                </button>
              </div>
            </div>
          )}

          {/* Feature pills */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: PencilIcon, label: "Edit Text" },
              { icon: ImageIcon, label: "Add Images" },
              { icon: CommentIcon, label: "Annotate" },
            ].map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.label} className="flex flex-col items-center gap-2 py-3.5 px-2 rounded-xl bg-white/60 dark:bg-zinc-900/40 border border-zinc-200/50 dark:border-zinc-800/50 text-center">
                  <div className="text-indigo-650 dark:text-indigo-400">
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
              { step: "01", title: "Upload PDF", desc: "Drop or choose your PDF document to begin.", icon: UploadIcon },
              { step: "02", title: "Edit Freely", desc: "Use the full suite of editing tools on any page.", icon: PencilIcon },
              { step: "03", title: "Download", desc: "Save your edited PDF directly to your device.", icon: DownloadIcon },
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
    </div>
  );
}
