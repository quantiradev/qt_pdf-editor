"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";

const LockIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg fill="currentColor" viewBox="0 0 24 24" {...props}>
    <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
  </svg>
);

const UnlockIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg fill="currentColor" viewBox="0 0 24 24" {...props}>
    <path d="M12 17c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm6-9h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6h1.9c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm0 12H6V10h12v10z" />
  </svg>
);

const ShieldCheckIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg fill="currentColor" viewBox="0 0 24 24" {...props}>
    <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" />
  </svg>
);

const ZapIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg fill="currentColor" viewBox="0 0 24 24" {...props}>
    <path d="M7 2v11h3v9l7-12h-4l4-8z" />
  </svg>
);

const KeyIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg fill="currentColor" viewBox="0 0 24 24" {...props}>
    <path d="M12.65 10C11.83 7.67 9.61 6 7 6c-3.87 0-7 3.13-7 7s3.13 7 7 7c2.61 0 4.83-1.67 5.65-4H17v4h4v-4h3v-4H12.65zM7 15c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z" />
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

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

type Mode = "idle" | "protect" | "unprotect";
type FileState = { id: string; name: string; isProtected: boolean } | null;

function strengthLabel(pw: string): { label: string; color: string; width: string } {
  if (!pw) return { label: "", color: "bg-zinc-200 dark:bg-zinc-800", width: "w-0" };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { label: "Weak", color: "bg-red-500", width: "w-1/4" };
  if (score <= 2) return { label: "Fair", color: "bg-orange-400", width: "w-2/4" };
  if (score <= 3) return { label: "Good", color: "bg-yellow-400", width: "w-3/4" };
  return { label: "Strong", color: "bg-emerald-500", width: "w-full" };
}

export default function ProtectPDFPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [file, setFile] = useState<FileState>(null);
  const [mode, setMode] = useState<Mode>("idle");

  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);

  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ msg: string; kind: "success" | "error" } | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultName, setResultName] = useState("");

  const showToast = (msg: string, kind: "success" | "error") => {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 4500);
  };

  const uploadFile = useCallback(async (f: File) => {
    if (!f || f.type !== "application/pdf") {
      setUploadError("Please select a valid PDF file.");
      return;
    }
    setIsUploading(true);
    setUploadError(null);
    setFile(null);
    setMode("idle");
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
      setFile({ id: meta.id, name: meta.name, isProtected: meta.is_protected ?? false });
      setMode("protect");
    } catch (err: any) {
      setUploadError(err.message || "Upload failed");
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

  const handleProtect = async () => {
    if (!file) return;
    if (password.length < 4) { showToast("Password must be at least 4 characters", "error"); return; }
    if (password !== confirm) { showToast("Passwords do not match", "error"); return; }
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/files/${file.id}/protect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.detail || "Encryption failed");
      setResultUrl(`${API_URL}/api/files/${file.id}/download`);
      setResultName(file.name.replace(/\.pdf$/i, "") + " (protected).pdf");
      setFile((f) => f ? { ...f, isProtected: true } : f);
      showToast("PDF protected with AES-256 encryption!", "success");
      setPassword(""); setConfirm("");
    } catch (err: any) {
      showToast(err.message || "Encryption failed", "error");
    } finally {
      setBusy(false);
    }
  };

  const handleUnprotect = async () => {
    if (!file) return;
    if (!password) { showToast("Enter the current password to remove protection", "error"); return; }
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/files/${file.id}/unprotect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.detail || "Decryption failed");
      setResultUrl(`${API_URL}/api/files/${file.id}/download`);
      setResultName(file.name.replace(/\.pdf$/i, "") + " (unlocked).pdf");
      setFile((f) => f ? { ...f, isProtected: false } : f);
      showToast("Password removed — PDF is now unlocked!", "success");
      setPassword("");
    } catch (err: any) {
      showToast(err.message || "Decryption failed", "error");
    } finally {
      setBusy(false);
    }
  };

  const strength = strengthLabel(password);

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

      {/* Upload overlay */}
      {isUploading && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex flex-col items-center justify-center gap-4">
          <div className="w-14 h-14 border-4 border-indigo-400/30 border-t-indigo-500 rounded-full animate-spin" />
          <p className="text-white font-semibold text-lg">Uploading PDF…</p>
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
              <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
            </svg>
            Protect PDF
          </span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-14">
        {/* Hero */}
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 text-xs font-semibold border border-indigo-200/50 dark:border-indigo-900/30 mb-6">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
            </svg>
            AES-256 Military-Grade Encryption
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-zinc-900 dark:text-white mb-4">
            Protect your <span className="text-indigo-600 dark:text-indigo-400">PDF</span> files
          </h1>
          <p className="text-base text-zinc-500 dark:text-zinc-400 max-w-xl mx-auto leading-relaxed">
            Add or remove password protection from any PDF using industry-standard AES-256 encryption. Passwords are never stored — only a secure hash is kept for verification.
          </p>
        </div>

        {/* Upload error */}
        {uploadError && (
          <div className="mb-6 flex items-center gap-3 px-5 py-3 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm font-semibold">
            <svg className="w-4 h-4 flex-none" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
            {uploadError}
            <button onClick={() => setUploadError(null)} className="ml-auto text-red-400 hover:text-red-600">✕</button>
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left: Upload zone */}
          <div>
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`relative w-full py-16 px-8 rounded-3xl border-2 border-dashed cursor-pointer transition-all duration-300 select-none text-center group
                bg-white/60 dark:bg-zinc-950/40 backdrop-blur-sm shadow-xl
                ${isDragging
                  ? "border-indigo-500 bg-indigo-50/30 dark:bg-indigo-500/5 scale-[1.01]"
                  : "border-zinc-300 dark:border-zinc-800 hover:border-indigo-400 dark:hover:border-indigo-600"
                }`}
            >
              <input ref={fileInputRef} type="file" accept=".pdf" onChange={handleFileChange} className="hidden" />
              <div className="absolute top-0 right-0 w-60 h-60 bg-indigo-500/10 rounded-full blur-[80px] pointer-events-none opacity-30 group-hover:opacity-70 transition-opacity" />
              <div className="relative z-10 flex flex-col items-center">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-5 transition-transform duration-300 group-hover:scale-110
                  ${file ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"}`}>
                  {file ? (
                    <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm-2 16l-4-4 1.41-1.41L12 15.17l6.59-6.58L20 10l-8 8z"/>
                    </svg>
                  ) : (
                    <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z"/>
                    </svg>
                  )}
                </div>
                {file ? (
                  <>
                    <p className="text-base font-bold text-zinc-900 dark:text-white mb-1 truncate max-w-[220px]">{file.name}</p>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">Click to replace with a different PDF</p>
                    {file.isProtected && (
                      <span className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 text-xs font-bold border border-amber-200/50 dark:border-amber-900/30">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>
                        Protected
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    <h3 className="text-base font-bold text-zinc-900 dark:text-white mb-2">Drop your PDF here</h3>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">or click to browse your device</p>
                    <div className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors shadow-md shadow-indigo-600/20">
                      Select PDF File
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Feature pills */}
            <div className="mt-6 grid grid-cols-3 gap-3">
              {[
                { icon: LockIcon, label: "AES-256" },
                { icon: ShieldCheckIcon, label: "Zero Storage" },
                { icon: ZapIcon, label: "Instant" },
              ].map((f) => {
                const Icon = f.icon;
                return (
                  <div key={f.label} className="flex flex-col items-center gap-2 py-3.5 px-2 rounded-xl bg-white/60 dark:bg-zinc-900/40 border border-zinc-200/50 dark:border-zinc-800/50 text-center">
                    <div className="text-indigo-650 dark:text-indigo-400">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-[11px] font-bold text-zinc-650 dark:text-zinc-450">{f.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: Controls */}
          <div className="space-y-4">
            {/* Mode selector */}
            {file && (
              <div className="flex p-1 bg-zinc-100 dark:bg-zinc-900/80 rounded-xl">
                <button
                  onClick={() => { setMode("protect"); setPassword(""); setConfirm(""); setResultUrl(null); }}
                  className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${mode === "protect" ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm" : "text-zinc-450 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"}`}
                >
                  <LockIcon className="w-4 h-4" /> Add Password
                </button>
                <button
                  onClick={() => { setMode("unprotect"); setPassword(""); setConfirm(""); setResultUrl(null); }}
                  className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${mode === "unprotect" ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm" : "text-zinc-450 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"}`}
                >
                  <UnlockIcon className="w-4 h-4" /> Remove Password
                </button>
              </div>
            )}

            {/* Password form */}
            {file && mode !== "idle" && (
              <div className="p-6 rounded-2xl bg-white/60 dark:bg-zinc-900/50 border border-zinc-200/50 dark:border-zinc-800/50 backdrop-blur-sm space-y-5 shadow-xl">
                <div>
                  <h2 className="text-base font-bold text-zinc-900 dark:text-white mb-1">
                    {mode === "protect" ? "Set a strong password" : "Enter the current password"}
                  </h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {mode === "protect"
                      ? "Your password is used to encrypt the PDF. Only the hash is stored — the plain text is never saved."
                      : "The password is hashed and verified against the stored hash to remove protection."}
                  </p>
                </div>

                {/* Password field */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                    {mode === "protect" ? "New Password" : "Current Password"}
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-zinc-400 pointer-events-none">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>
                    </span>
                    <input
                      type={showPw ? "text" : "password"}
                      placeholder={mode === "protect" ? "Enter a strong password" : "Enter current password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/40 dark:bg-zinc-950/20 text-sm placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:text-white transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((v) => !v)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                    >
                      {showPw ? (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/></svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                      )}
                    </button>
                  </div>

                  {/* Strength meter - only for protect mode */}
                  {mode === "protect" && password && (
                    <div className="mt-2 space-y-1">
                      <div className="h-1.5 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-500 ${strength.color} ${strength.width}`} />
                      </div>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        Strength: <span className="font-bold">{strength.label}</span>
                      </p>
                    </div>
                  )}
                </div>

                {/* Confirm password - only for protect mode */}
                {mode === "protect" && (
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Confirm Password</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-zinc-400 pointer-events-none">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
                      </span>
                      <input
                        type={showConfirm ? "text" : "password"}
                        placeholder="Confirm password"
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        className={`w-full pl-10 pr-10 py-2.5 rounded-xl border bg-white/40 dark:bg-zinc-950/20 text-sm placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:text-white transition-all ${
                          confirm && password !== confirm ? "border-red-400 dark:border-red-600" : "border-zinc-200 dark:border-zinc-800"
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm((v) => !v)}
                        className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                      >
                        {showConfirm ? (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/></svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                        )}
                      </button>
                    </div>
                    {confirm && password !== confirm && (
                      <p className="text-[11px] text-red-500">Passwords do not match</p>
                    )}
                  </div>
                )}

                {/* Action button */}
                <button
                  onClick={mode === "protect" ? handleProtect : handleUnprotect}
                  disabled={busy || !password || (mode === "protect" && password !== confirm)}
                  className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm transition-all shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/30 flex items-center justify-center gap-2"
                >
                  {busy ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Processing…
                    </>
                  ) : mode === "protect" ? (
                    <>
                      <LockIcon className="w-4 h-4" />
                      Protect PDF with AES-256
                    </>
                  ) : (
                    <>
                      <UnlockIcon className="w-4 h-4" />
                      Remove Password Protection
                    </>
                  )}
                </button>
              </div>
            )}

            {/* No file selected placeholder */}
            {!file && (
              <div className="p-8 rounded-2xl bg-white/40 dark:bg-zinc-900/30 border border-dashed border-zinc-200 dark:border-zinc-800 text-center">
                <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center text-zinc-400">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>
                </div>
                <p className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">Upload a PDF to get started</p>
                <p className="text-xs text-zinc-400 dark:text-zinc-600 mt-1">Password controls will appear here</p>
              </div>
            )}

            {/* Result download card */}
            {resultUrl && (
              <div className="p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 flex items-center gap-4 shadow-lg">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm-2 16l-4-4 1.41-1.41L12 15.17l6.59-6.58L20 10l-8 8z"/></svg>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-emerald-800 dark:text-emerald-200">Ready to download</p>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 truncate">{resultName}</p>
                </div>
                <a
                  href={resultUrl}
                  download={resultName}
                  className="shrink-0 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold transition-colors shadow-md shadow-emerald-600/20 flex items-center gap-1.5"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                  Download
                </a>
              </div>
            )}
          </div>
        </div>

        {/* How it works */}
        <div className="mt-20 grid sm:grid-cols-3 gap-6">
          {[
            {
              step: "01",
              title: "Upload your PDF",
              desc: "Drag and drop or click to select any PDF file from your device.",
              icon: UploadIcon,
            },
            {
              step: "02",
              title: "Set a password",
              desc: "Choose Add Password or Remove Password, then enter a strong password.",
              icon: KeyIcon,
            },
            {
              step: "03",
              title: "Download result",
              desc: "Get the encrypted or decrypted PDF instantly with AES-256 encryption applied.",
              icon: DownloadIcon,
            },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.step} className="p-6 rounded-2xl bg-white/60 dark:bg-zinc-900/40 border border-zinc-200/50 dark:border-zinc-800/50 flex flex-col items-start">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40">
                  <Icon className="w-5 h-5" />
                </div>
                <div className="text-xs font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-widest mb-2">{s.step}</div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white mb-1">{s.title}</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">{s.desc}</p>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
