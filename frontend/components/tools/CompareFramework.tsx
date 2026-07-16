"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  UploadCloud, FileText, AlertCircle, ArrowLeft,
  Download, ExternalLink, Loader2,
  ChevronLeft, ChevronRight, Play, ZoomIn, ZoomOut,
  Columns, Layers, Search, Check, MousePointer, Link2, Link2Off, Trash2, X
} from "lucide-react";
import { loadDocument } from "@/lib/pdf";
import { api } from "@/lib/api";
import { downloadBlob } from "@/lib/utils";
import type { ComparisonResult, DiffItem, PageDiff } from "@/lib/types";

// Local alias so the rest of the file is unchanged
type CompareResult = ComparisonResult;

// ─── Annotation helpers ───────────────────────────────────────────────────────

function getAnnotationStyle(d: DiffItem) {
  if (d.type === "addition") {
    return {
      kind: "rect" as const,
      bg: "bg-[rgba(34,197,94,0.18)]",
      border: "border border-[#22c55e]",
      activeBg: "bg-[rgba(34,197,94,0.25)] border-2 border-[#22c55e]",
      tooltip: "bg-emerald-600",
      label: "Addition",
    };
  }
  if (d.type === "deletion") {
    return {
      kind: "rect" as const,
      bg: "bg-[rgba(239,68,68,0.18)]",
      border: "border border-[#ef4444]",
      activeBg: "bg-[rgba(239,68,68,0.25)] border-2 border-[#ef4444]",
      tooltip: "bg-red-600",
      label: "Deleted",
    };
  }
  return {
    kind: "rect" as const,
    bg: "bg-[rgba(245,158,11,0.18)]",
    border: "border border-[#f59e0b]",
    activeBg: "bg-[rgba(245,158,11,0.25)] border-2 border-[#f59e0b]",
    tooltip: "bg-amber-600",
    label: "Modified",
  };
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CompareFramework() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const originalId = searchParams.get("originalId");
  const compareVersions = searchParams.get("compareVersions") === "true";

  // Files
  const [origFile, setOrigFile] = useState<File | null>(null);
  const [revFile, setRevFile] = useState<File | null>(null);
  const [origDragging, setOrigDragging] = useState(false);
  const [revDragging, setRevDragging] = useState(false);
  const [originalName, setOriginalName] = useState<string | null>(null);
  const [autoTriggered, setAutoTriggered] = useState(false);

  useEffect(() => {
    if (originalId) {
      api.meta(originalId)
        .then((meta) => {
          setOriginalName(meta.name);
        })
        .catch((err) => {
          console.error("Failed to load original file meta:", err);
        });
    }
  }, [originalId]);

  useEffect(() => {
    if (originalId && compareVersions && !autoTriggered && originalName) {
      setAutoTriggered(true);
      (async () => {
        setError(null);
        setStep("processing");
        setProgress(30);
        setProgressText("Analyzing differences between initial version and current edited version...");
        try {
          const result = await api.compare(null, null, originalId, true);
          setDiffResult(result);
          setProgress(70);
          setProgressText("Loading document versions...");

          const urlOrig = api.contentUrl(result.file_id_original, result.meta_original.version);
          const urlRev = api.contentUrl(result.file_id_revised, result.meta_revised.version);

          const loadedOrig = await loadDocument(urlOrig);
          const loadedRev = await loadDocument(urlRev);

          setDocOrig(loadedOrig);
          setDocRev(loadedRev);

          const pages = Math.max(loadedOrig.numPages, loadedRev.numPages);
          setPdfPagesCount(pages);

          const diffs: { pageIndex: number; diffIndex: number; item: DiffItem }[] = [];
          result.pages.forEach((p: PageDiff) => {
            p.differences.forEach((d: DiffItem, idx: number) => {
              diffs.push({ pageIndex: p.page_index, diffIndex: idx, item: d });
            });
          });
          setFlatDiffs(diffs);
          if (diffs.length > 0) {
            setActiveDiffIdx(0);
            setCurrentPage(diffs[0].pageIndex);
          } else {
            setActiveDiffIdx(-1);
            setCurrentPage(0);
          }

          setProgress(100);
          setStep("results");
        } catch (err: any) {
          setError(err.message || "Comparison failed. Check if files are corrupted.");
          setStep("error");
        }
      })();
    }
  }, [originalId, compareVersions, autoTriggered, originalName]);

  // Flow State
  const [step, setStep] = useState<"upload" | "processing" | "results" | "error">("upload");
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Comparison Results
  const [diffResult, setDiffResult] = useState<CompareResult | null>(null);
  const [docOrig, setDocOrig] = useState<any>(null);
  const [docRev, setDocRev] = useState<any>(null);
  const [pdfPagesCount, setPdfPagesCount] = useState(0);

  // Navigation & Zoom
  const [currentPage, setCurrentPage] = useState(0);
  const [zoom, setZoom] = useState(1.1);
  const [flatDiffs, setFlatDiffs] = useState<{ pageIndex: number; diffIndex: number; item: DiffItem }[]>([]);
  const [activeDiffIdx, setActiveDiffIdx] = useState<number>(-1);
  const [isExporting, setIsExporting] = useState(false);
  const [mobileTab, setMobileTab] = useState<"original" | "revised">("original");

  // Custom states matching iLovePDF UI
  const [activeTab, setActiveTab] = useState<"text" | "overlay">("text");
  const [scrollSync, setScrollSync] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [overlayOpacity, setOverlayOpacity] = useState(0.5);

  // Sync scroll refs
  const origContainerRef = useRef<HTMLDivElement>(null);
  const revContainerRef = useRef<HTMLDivElement>(null);
  const singleContainerRef = useRef<HTMLDivElement>(null);
  const isSyncingOrig = useRef(false);
  const isSyncingRev = useRef(false);

  // Scroll sync
  const handleOrigScroll = () => {
    if (!scrollSync || isSyncingRev.current) return;
    isSyncingOrig.current = true;
    if (origContainerRef.current && revContainerRef.current) {
      revContainerRef.current.scrollTop = origContainerRef.current.scrollTop;
      revContainerRef.current.scrollLeft = origContainerRef.current.scrollLeft;
    }
    isSyncingOrig.current = false;
  };

  const handleRevScroll = () => {
    if (!scrollSync || isSyncingOrig.current) return;
    isSyncingRev.current = true;
    if (origContainerRef.current && revContainerRef.current) {
      origContainerRef.current.scrollTop = revContainerRef.current.scrollTop;
      origContainerRef.current.scrollLeft = revContainerRef.current.scrollLeft;
    }
    isSyncingRev.current = false;
  };

  // Upload handlers
  const handleDropOrig = (e: React.DragEvent) => {
    e.preventDefault();
    setOrigDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type === "application/pdf") setOrigFile(file);
  };

  const handleDropRev = (e: React.DragEvent) => {
    e.preventDefault();
    setRevDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type === "application/pdf") setRevFile(file);
  };

  // Compare
  const handleCompare = async () => {
    if (!origFile && !originalId) {
      setError("Please upload the original PDF document.");
      return;
    }
    if (!revFile) {
      setError("Please upload the revised PDF document.");
      return;
    }
    setError(null);
    setStep("processing");
    setProgress(20);
    setProgressText("Uploading PDF files to comparison engine...");

    try {
      const result = await api.compare(origFile, revFile, originalId || undefined);
      setDiffResult(result);
      setProgress(60);
      setProgressText("Loading PDF documents in viewer...");

      const urlOrig = api.contentUrl(result.file_id_original, result.meta_original.version);
      const urlRev = api.contentUrl(result.file_id_revised, result.meta_revised.version);

      const loadedOrig = await loadDocument(urlOrig);
      const loadedRev = await loadDocument(urlRev);

      setDocOrig(loadedOrig);
      setDocRev(loadedRev);

      const pages = Math.max(loadedOrig.numPages, loadedRev.numPages);
      setPdfPagesCount(pages);

      const diffs: { pageIndex: number; diffIndex: number; item: DiffItem }[] = [];
      result.pages.forEach((p: PageDiff) => {
        p.differences.forEach((d: DiffItem, idx: number) => {
          diffs.push({ pageIndex: p.page_index, diffIndex: idx, item: d });
        });
      });
      setFlatDiffs(diffs);
      if (diffs.length > 0) {
        setActiveDiffIdx(0);
        setCurrentPage(diffs[0].pageIndex);
      } else {
        setActiveDiffIdx(-1);
        setCurrentPage(0);
      }

      setProgress(100);
      setStep("results");
    } catch (err: any) {
      setError(err.message || "Comparison failed. Check if files are corrupted or password protected.");
      setStep("error");
    }
  };

  const fitToWidth = async () => {
    const doc = docOrig || docRev;
    if (!doc) return;
    try {
      const page = await doc.getPage(1);
      const viewport = page.getViewport({ scale: 1.0 });
      const containerWidth = activeTab === "overlay" 
        ? (singleContainerRef.current?.clientWidth || 600)
        : (origContainerRef.current?.clientWidth || revContainerRef.current?.clientWidth || 450);
      const targetZoom = (containerWidth - 48) / viewport.width;
      setZoom(Math.max(0.3, Math.min(2.0, parseFloat(targetZoom.toFixed(2)))));
    } catch (err) {
      console.error("Error in fitToWidth:", err);
    }
  };

  useEffect(() => {
    if (step !== "results") return;
    const timer = setTimeout(() => {
      fitToWidth();
    }, 150);

    const handleResize = () => {
      fitToWidth();
    };

    window.addEventListener("resize", handleResize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", handleResize);
    };
  }, [step, docOrig, docRev, activeTab]);

  // Page navigation
  const handlePrevPage = () => setCurrentPage(p => Math.max(0, p - 1));
  const handleNextPage = () => setCurrentPage(p => Math.min(pdfPagesCount - 1, p + 1));

  const handleSelectDiff = (flatIdx: number) => {
    setActiveDiffIdx(flatIdx);
    const diff = flatDiffs[flatIdx];
    setCurrentPage(diff.pageIndex);
    
    // Auto-switch mobile view depending on diff type
    if (diff.item.type === "deletion") {
      setMobileTab("original");
    } else {
      setMobileTab("revised");
    }

    setTimeout(() => {
      const rect = diff.item.rect;
      if (!rect) return;

      // Use pure zoom (logical scale = CSS pixels per PDF pt) for scroll targeting
      const scale = zoom;
      const top  = (rect.y ?? 0) * scale - (revContainerRef.current?.clientHeight ?? 0) / 2 + ((rect.h ?? 0) * scale) / 2;
      const left = (rect.x ?? 0) * scale - (revContainerRef.current?.clientWidth  ?? 0) / 2 + ((rect.w ?? 0) * scale) / 2;

      if (activeTab === "overlay") {
        singleContainerRef.current?.scrollTo({ top: Math.max(0, top), left: Math.max(0, left), behavior: "smooth" });
      } else {
        revContainerRef.current?.scrollTo({ top: Math.max(0, top), left: Math.max(0, left), behavior: "smooth" });
        origContainerRef.current?.scrollTo({ top: Math.max(0, top), left: Math.max(0, left), behavior: "smooth" });
      }
    }, 120);
  };

  const handlePrevDiff = () => {
    if (!flatDiffs.length) return;
    handleSelectDiff(activeDiffIdx <= 0 ? flatDiffs.length - 1 : activeDiffIdx - 1);
  };

  const handleNextDiff = () => {
    if (!flatDiffs.length) return;
    handleSelectDiff(activeDiffIdx >= flatDiffs.length - 1 ? 0 : activeDiffIdx + 1);
  };

  const handleExportReport = async () => {
    if (!diffResult) return;
    setIsExporting(true);
    try {
      const blob = await api.exportCompareReport(diffResult);
      downloadBlob("Comparison_Report.pdf", blob);
    } catch {
      setError("Failed to export report.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleOpenWorkspace = (fileId: string) => router.push(`/editor/${fileId}`);

  const reset = () => {
    setOrigFile(null); setRevFile(null); setStep("upload"); setDiffResult(null);
    setDocOrig(null); setDocRev(null); setPdfPagesCount(0);
    setFlatDiffs([]); setActiveDiffIdx(-1); setCurrentPage(0); setError(null);
    if (originalId) {
      router.replace("/tools/compare");
    }
  };

  const handleRemoveOriginal = () => {
    setOrigFile(null);
    setDocOrig(null);
    setStep("upload");
    if (originalId) {
      router.replace("/tools/compare");
    }
  };

  const handleRemoveRevised = () => {
    setRevFile(null);
    setDocRev(null);
    setStep("upload");
  };

  const activeDiff = flatDiffs[activeDiffIdx] ?? null;

  // Filter diffs based on search text input
  const filteredDiffs = flatDiffs.filter(d => 
    d.item.text?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.item.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.item.category?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-55 flex flex-col overflow-hidden relative">
      
      {/* ── HEADER ── */}
      <header className="h-14 border-b border-zinc-200/60 dark:border-zinc-900/60 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md flex items-center justify-between px-6 z-25 shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:bg-indigo-500 transition-colors">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <span className="text-sm font-black text-zinc-900 dark:text-white">QT PDF Editor</span>
          </Link>
          <span className="text-zinc-300 dark:text-zinc-700 select-none">/</span>
          <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
            Compare PDF
          </span>
        </div>
        
        {step === "results" && (
          <div className="flex items-center gap-3">
            {/* Legend Stats */}
            <div className="hidden sm:flex items-center gap-2">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10">
                {diffResult?.summary.additions || 0} Added
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded border border-red-500/30 text-red-650 dark:text-red-400 bg-red-500/10">
                {diffResult?.summary.deletions || 0} Deleted
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded border border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/10">
                {diffResult?.summary.modifications || 0} Modified
              </span>
            </div>
          </div>
        )}
      </header>

      {/* ── CONTENT CONTAINER ── */}
      <div className="flex-1 flex min-h-0 relative">
        
        {/* ── UPLOAD VIEW ── */}
        {step === "upload" && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 overflow-y-auto">
            <div className="max-w-3xl text-center mb-10 shrink-0">
              <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-zinc-900 dark:text-white mb-4">
                Compare PDF Documents
              </h1>
              <p className="text-zinc-550 dark:text-zinc-400 text-sm sm:text-base leading-relaxed">
                Compare two versions of a PDF document side-by-side to highlight text additions, removals, and changes.
              </p>
            </div>
            
            <div className="w-full max-w-4xl glass-panel p-8 rounded-3xl border border-zinc-200 dark:border-zinc-900 bg-white/40 dark:bg-zinc-900/10 backdrop-blur-md shadow-2xl flex flex-col justify-between min-h-[400px]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Original */}
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2.5">1. Original Document</span>
                  <div
                    onDragOver={(e) => { e.preventDefault(); if (!originalId) setOrigDragging(true); }}
                    onDragLeave={() => setOrigDragging(false)}
                    onDrop={(e) => { if (!originalId) handleDropOrig(e); }}
                    onClick={() => { if (!originalId) document.getElementById("file-orig")?.click(); }}
                    className={`py-14 px-6 border-2 border-dashed rounded-2xl text-center transition-all duration-200 flex flex-col items-center justify-center min-h-[220px] ${
                      originalId
                        ? "border-zinc-200 bg-zinc-50/20 dark:border-zinc-800/10 cursor-default"
                        : origDragging
                          ? "border-indigo-500 bg-indigo-50/20 dark:bg-indigo-950/20 cursor-pointer"
                          : "border-zinc-300 hover:border-indigo-500/85 dark:border-zinc-800 bg-zinc-50/40 dark:bg-zinc-900/10 cursor-pointer"
                    }`}
                  >
                    <input id="file-orig" type="file" accept=".pdf" onChange={(e) => { const f = e.target.files?.[0]; if (f) setOrigFile(f); }} className="hidden" />
                    {originalId && originalName ? (
                      <div className="flex flex-col items-center relative w-full">
                        <FileText className="text-indigo-500 mb-3.5" size={42} />
                        <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 mb-1">Pre-loaded from workspace</span>
                        <span className="text-sm font-bold text-zinc-900 dark:text-white truncate max-w-[240px]">{originalName}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            router.replace("/tools/compare");
                          }}
                          className="text-[10px] text-zinc-400 hover:text-zinc-655 mt-3 underline"
                        >
                          Use a different file
                        </button>
                      </div>
                    ) : origFile ? (
                      <div className="flex flex-col items-center">
                        <FileText className="text-indigo-500 mb-3.5" size={42} />
                        <span className="text-sm font-bold text-zinc-900 dark:text-white truncate max-w-[240px]">{origFile.name}</span>
                        <span className="text-xs text-zinc-400 mt-1">{(origFile.size / 1024).toFixed(1)} KB</span>
                      </div>
                    ) : (
                      <>
                        <UploadCloud className="text-zinc-400 mb-3" size={32} />
                        <span className="text-sm font-bold text-zinc-850 dark:text-zinc-200">Choose Original PDF</span>
                        <span className="text-[11px] text-zinc-400 mt-1">Drag and drop file here</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Revised */}
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2.5">2. Revised Document</span>
                  <div
                    onDragOver={(e) => { e.preventDefault(); setRevDragging(true); }}
                    onDragLeave={() => setRevDragging(false)}
                    onDrop={handleDropRev}
                    onClick={() => document.getElementById("file-rev")?.click()}
                    className={`py-14 px-6 border-2 border-dashed rounded-2xl text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center min-h-[220px] ${revDragging ? "border-indigo-500 bg-indigo-50/20 dark:bg-indigo-950/20"
                        : "border-zinc-300 hover:border-indigo-500/85 dark:border-zinc-800 bg-zinc-50/40 dark:bg-zinc-900/10"
                      }`}
                  >
                    <input id="file-rev" type="file" accept=".pdf" onChange={(e) => { const f = e.target.files?.[0]; if (f) setRevFile(f); }} className="hidden" />
                    {revFile ? (
                      <div className="flex flex-col items-center">
                        <FileText className="text-indigo-500 mb-3.5" size={42} />
                        <span className="text-sm font-bold text-zinc-900 dark:text-white truncate max-w-[240px]">{revFile.name}</span>
                        <span className="text-xs text-zinc-400 mt-1">{(revFile.size / 1024).toFixed(1)} KB</span>
                      </div>
                    ) : (
                      <>
                        <UploadCloud className="text-zinc-400 mb-3" size={32} />
                        <span className="text-sm font-bold text-zinc-850 dark:text-zinc-200">Choose Revised PDF</span>
                        <span className="text-[11px] text-zinc-400 mt-1">Drag and drop file here</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end items-center gap-4 mt-8 border-t border-zinc-200/50 dark:border-zinc-800/50 pt-6">
                {error && <span className="text-xs text-red-500 flex items-center gap-1 mr-auto"><AlertCircle size={14} />{error}</span>}
                <button onClick={handleCompare} disabled={(!origFile && !originalId) || !revFile}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-sm shadow shadow-indigo-600/15 flex items-center gap-1.5 cursor-pointer">
                  Analyze Differences <Play size={14} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── PROCESSING VIEW ── */}
        {step === "processing" && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 overflow-y-auto">
            <div className="w-full max-w-xl glass-panel p-10 rounded-3xl border border-zinc-200 dark:border-zinc-900 bg-white/40 dark:bg-zinc-900/10 backdrop-blur-md shadow-2xl flex flex-col items-center text-center">
              <Loader2 className="animate-spin text-indigo-650 mb-6" size={42} />
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">Analyzing PDFs…</h3>
              <p className="text-xs text-zinc-400 mb-6">{progressText}</p>
              <div className="w-full h-2 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-600 transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
            </div>
          </div>
        )}

        {/* ── ERROR VIEW ── */}
        {step === "error" && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 overflow-y-auto">
            <div className="w-full max-w-xl glass-panel p-10 rounded-3xl border border-zinc-200 dark:border-zinc-900 bg-white/40 dark:bg-zinc-900/10 backdrop-blur-md shadow-2xl flex flex-col items-center text-center">
              <AlertCircle className="text-red-500 mb-5" size={48} />
              <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">Analysis Failed</h3>
              <p className="text-sm text-red-550 mb-8 leading-relaxed">{error}</p>
              <div className="flex gap-3">
                <button onClick={reset} className="btn secondary">Choose New Files</button>
                <button onClick={handleCompare} className="btn primary">Retry Comparison</button>
              </div>
            </div>
          </div>
        )}

        {/* ── RESULTS WORKSPACE ── */}
        {step === "results" && diffResult && (
          <div className="flex-1 flex flex-col min-h-0 relative">
            
            {/* SUB-HEADER TOOLBAR (Matching iLovePDF style) */}
            <div className="h-12 border-b border-zinc-200 dark:border-zinc-900 bg-zinc-50 dark:bg-zinc-950 flex items-center justify-between px-4 shrink-0 select-none">
              <div className="flex items-center gap-3">
                <button onClick={reset} className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors font-bold mr-1">
                  <ArrowLeft size={14} /> Back
                </button>
                <div className="h-4 w-px bg-zinc-300 dark:bg-zinc-800" />
                
                {/* Mouse Pointer Tool */}
                <button className="p-1.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-900 text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer" title="Pointer">
                  <MousePointer size={15} />
                </button>

                {/* Scroll Sync Toggle */}
                <button
                  onClick={() => setScrollSync(!scrollSync)}
                  className={`px-2.5 py-1 rounded text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    scrollSync 
                      ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900"
                      : "text-zinc-500 hover:text-zinc-850 hover:bg-zinc-200 dark:hover:bg-zinc-900"
                  }`}
                  title="Toggle Synchronized Scrolling"
                >
                  {scrollSync ? <Link2 size={13} className="text-emerald-500" /> : <Link2Off size={13} />}
                  <span>Scroll sync</span>
                </button>
              </div>

              {/* Page Selector & Zoom controls in Sub-header */}
              <div className="flex items-center gap-3.5">
                {/* Page Navigation */}
                <div className="flex items-center gap-1.5">
                  <button onClick={handlePrevPage} disabled={currentPage === 0} className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-900 disabled:opacity-30 cursor-pointer">
                    <ChevronLeft size={16} />
                  </button>
                  <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    Page {currentPage + 1} of {pdfPagesCount}
                  </span>
                  <button onClick={handleNextPage} disabled={currentPage === pdfPagesCount - 1} className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-900 disabled:opacity-30 cursor-pointer">
                    <ChevronRight size={16} />
                  </button>
                </div>
                
                <div className="h-4 w-px bg-zinc-300 dark:bg-zinc-800" />
                
                {/* Difference navigation */}
                {flatDiffs.length > 0 && (
                  <div className="flex items-center gap-2">
                    <button onClick={handlePrevDiff} className="px-2 py-0.5 rounded border border-zinc-300 dark:border-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-900 text-[10px] font-bold cursor-pointer">
                      Prev
                    </button>
                    <span className="text-[10px] font-bold font-mono text-zinc-500">
                      {activeDiffIdx + 1} / {flatDiffs.length}
                    </span>
                    <button onClick={handleNextDiff} className="px-2 py-0.5 rounded border border-zinc-300 dark:border-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-900 text-[10px] font-bold cursor-pointer">
                      Next
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* MAIN RESULTS LAYOUT (Splits into 80% documents grid, 20% right sidebar) */}
            <div className="flex-1 flex min-h-0 relative">
              
              {/* DOCUMENT VIEWER(S) PANE */}
              <div className="flex-1 flex flex-col min-w-0 bg-zinc-100 dark:bg-zinc-950/20 relative p-6 overflow-y-auto">
                
                {/* Mobile tab buttons */}
                {activeTab === "text" && (
                  <div className="flex md:hidden bg-zinc-200/50 dark:bg-zinc-900/50 p-1.5 rounded-xl gap-1.5 mb-4 shrink-0 select-none">
                    <button
                      onClick={() => setMobileTab("original")}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                        mobileTab === "original"
                          ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm"
                          : "text-zinc-500"
                      }`}
                    >
                      Original
                    </button>
                    <button
                      onClick={() => setMobileTab("revised")}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                        mobileTab === "revised"
                          ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm"
                          : "text-zinc-500"
                      }`}
                    >
                      Revised
                    </button>
                  </div>
                )}

                {/* VIEWPORT CONTROLS */}
                {activeTab === "text" ? (
                  /* SIDE-BY-SIDE VIEW */
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 min-w-0 flex-1">
                    
                    {/* ORIGINAL DOCUMENT */}
                    <div className={`flex flex-col relative bg-zinc-200/40 dark:bg-zinc-900/20 rounded-2xl border border-zinc-200/50 dark:border-zinc-900/50 min-h-0 overflow-hidden shadow-sm ${
                      mobileTab === "original" ? "flex" : "hidden md:flex"
                    }`}>
                      {/* Viewport header */}
                      <div className="h-9 px-3 border-b border-zinc-200 dark:border-zinc-900 bg-white/60 dark:bg-zinc-950/60 flex items-center justify-between text-[11px] font-bold select-none shrink-0">
                        <span className="truncate max-w-[200px] text-zinc-500">ORIGINAL: {origFile?.name || originalName || "document.pdf"}</span>
                        <div className="flex items-center gap-2">
                          <button onClick={() => handleOpenWorkspace(diffResult.file_id_original)} className="text-indigo-650 hover:underline flex items-center gap-0.5">
                            Edit <ExternalLink size={10} />
                          </button>
                          <button onClick={handleRemoveOriginal} className="text-zinc-400 hover:text-zinc-650 cursor-pointer" title="Replace original document">
                            <X size={12} />
                          </button>
                        </div>
                      </div>
                      
                      {/* Document Scroll Canvas */}
                      <div ref={origContainerRef} onScroll={handleOrigScroll} className="flex-1 overflow-auto p-6 flex items-start justify-center">
                        {currentPage < diffResult.page_count_original ? (
                          <ComparePageView
                            doc={docOrig}
                            pageIndex={currentPage}
                            zoom={zoom}
                            diffs={diffResult.pages[currentPage]?.differences.filter(d => d.type === "deletion") || []}
                            activeDiffItem={
                              activeDiff?.pageIndex === currentPage && activeDiff?.item?.type === "deletion" ? activeDiff.item : null
                            }
                            side="original"
                          />
                        ) : (
                          <div className="aspect-[1/1.41] w-full max-w-[450px] bg-zinc-200/50 border border-dashed border-zinc-300 dark:bg-zinc-900/10 dark:border-zinc-800 rounded-xl flex items-center justify-center text-xs text-zinc-400 font-semibold italic p-4">
                            Page does not exist in original version
                          </div>
                        )}
                      </div>
                      
                      {/* Floating bottom zoom bar */}
                      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-zinc-950/85 backdrop-blur text-white py-1.5 px-3 rounded-full flex items-center gap-2.5 shadow-lg border border-zinc-800 text-[10px] font-bold z-10 select-none">
                        <button onClick={() => setZoom(z => Math.max(0.4, z - 0.1))} className="text-zinc-400 hover:text-white transition-colors"><ZoomOut size={13} /></button>
                        <span className="font-mono min-w-[36px] text-center">{Math.round(zoom * 100)}%</span>
                        <button onClick={() => setZoom(z => Math.min(2.5, z + 0.1))} className="text-zinc-400 hover:text-white transition-colors"><ZoomIn size={13} /></button>
                        <div className="w-px h-3 bg-zinc-800" />
                        <button onClick={fitToWidth} className="text-indigo-400 hover:text-indigo-300 transition-colors">FIT</button>
                      </div>
                    </div>

                    {/* REVISED DOCUMENT */}
                    <div className={`flex flex-col relative bg-zinc-200/40 dark:bg-zinc-900/20 rounded-2xl border border-zinc-200/50 dark:border-zinc-900/50 min-h-0 overflow-hidden shadow-sm ${
                      mobileTab === "revised" ? "flex" : "hidden md:flex"
                    }`}>
                      {/* Viewport header */}
                      <div className="h-9 px-3 border-b border-zinc-200 dark:border-zinc-900 bg-white/60 dark:bg-zinc-950/60 flex items-center justify-between text-[11px] font-bold select-none shrink-0">
                        <span className="truncate max-w-[200px] text-zinc-500">REVISED: {revFile?.name || "document (edited).pdf"}</span>
                        <div className="flex items-center gap-2">
                          <button onClick={() => handleOpenWorkspace(diffResult.file_id_revised)} className="text-indigo-650 hover:underline flex items-center gap-0.5">
                            Edit <ExternalLink size={10} />
                          </button>
                          <button onClick={handleRemoveRevised} className="text-zinc-400 hover:text-zinc-650 cursor-pointer" title="Replace revised document">
                            <X size={12} />
                          </button>
                        </div>
                      </div>
                      
                      {/* Document Scroll Canvas */}
                      <div ref={revContainerRef} onScroll={handleRevScroll} className="flex-1 overflow-auto p-6 flex items-start justify-center">
                        {currentPage < diffResult.page_count_revised ? (
                          <ComparePageView
                            doc={docRev}
                            pageIndex={currentPage}
                            zoom={zoom}
                            diffs={diffResult.pages[currentPage]?.differences.filter(d => d.type !== "deletion") || []}
                            activeDiffItem={
                              activeDiff?.pageIndex === currentPage && activeDiff?.item?.type !== "deletion" ? activeDiff.item : null
                            }
                            side="revised"
                          />
                        ) : (
                          <div className="aspect-[1/1.41] w-full max-w-[450px] bg-zinc-200/50 border border-dashed border-zinc-300 dark:bg-zinc-900/10 dark:border-zinc-800 rounded-xl flex items-center justify-center text-xs text-zinc-400 font-semibold italic p-4">
                            Page does not exist in revised version
                          </div>
                        )}
                      </div>
                      
                      {/* Floating bottom zoom bar */}
                      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-zinc-950/85 backdrop-blur text-white py-1.5 px-3 rounded-full flex items-center gap-2.5 shadow-lg border border-zinc-800 text-[10px] font-bold z-10 select-none">
                        <button onClick={() => setZoom(z => Math.max(0.4, z - 0.1))} className="text-zinc-400 hover:text-white transition-colors"><ZoomOut size={13} /></button>
                        <span className="font-mono min-w-[36px] text-center">{Math.round(zoom * 100)}%</span>
                        <button onClick={() => setZoom(z => Math.min(2.5, z + 0.1))} className="text-zinc-400 hover:text-white transition-colors"><ZoomIn size={13} /></button>
                        <div className="w-px h-3 bg-zinc-800" />
                        <button onClick={fitToWidth} className="text-indigo-400 hover:text-indigo-300 transition-colors">FIT</button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* CONTENT OVERLAY BLEND VIEW */
                  <div className="flex-1 flex flex-col items-center justify-between min-h-0 relative">
                    
                    {/* Viewport header */}
                    <div className="w-full max-w-2xl h-9 px-3 border border-zinc-200 dark:border-zinc-900 bg-white/60 dark:bg-zinc-950/60 rounded-t-2xl flex items-center justify-between text-[11px] font-bold select-none shrink-0">
                      <span className="truncate text-zinc-550">Visual Overlap Mode (Mix-blend)</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-zinc-400 font-bold">Zoom: {Math.round(zoom * 100)}%</span>
                        <button onClick={fitToWidth} className="text-indigo-650 hover:underline">Fit Width</button>
                      </div>
                    </div>
                    
                    {/* Overlaid Canvas Container */}
                    <div ref={singleContainerRef} className="w-full max-w-2xl flex-1 border-x border-b border-zinc-200 dark:border-zinc-900 bg-zinc-50 dark:bg-zinc-950/30 overflow-auto p-8 flex items-start justify-center min-h-0 rounded-b-2xl scrollbar-thin">
                      <div className="relative">
                        {/* Original behind */}
                        {currentPage < diffResult.page_count_original && (
                          <ComparePageView
                            doc={docOrig}
                            pageIndex={currentPage}
                            zoom={zoom}
                            diffs={diffResult.pages[currentPage]?.differences.filter(d => d.type === "deletion") || []}
                            activeDiffItem={null}
                            side="original"
                            opacity={1 - overlayOpacity}
                          />
                        )}
                        
                        {/* Revised in front overlaid */}
                        {currentPage < diffResult.page_count_revised && (
                          <div className="absolute inset-0 pointer-events-none mix-blend-multiply dark:mix-blend-screen">
                            <ComparePageView
                              doc={docRev}
                              pageIndex={currentPage}
                              zoom={zoom}
                              diffs={diffResult.pages[currentPage]?.differences.filter(d => d.type !== "deletion") || []}
                              activeDiffItem={activeDiff?.pageIndex === currentPage ? activeDiff.item : null}
                              side="revised"
                              opacity={overlayOpacity}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Floating Opacity Slider at bottom center */}
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white/90 dark:bg-zinc-900/90 backdrop-blur border border-zinc-200 dark:border-zinc-800 py-2.5 px-5 rounded-2xl shadow-xl flex items-center gap-3.5 z-10 select-none">
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Original</span>
                      <input
                        type="range"
                        min="0.0"
                        max="1.0"
                        step="0.05"
                        value={overlayOpacity}
                        onChange={(e) => setOverlayOpacity(parseFloat(e.target.value))}
                        className="w-36 h-1 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-650 focus:outline-none"
                      />
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Revised</span>
                    </div>
                  </div>
                )}
              </div>

              {/* CONTROL SIDEBAR (Right-hand Panel matching iLovePDF style) */}
              <div className="w-80 border-l border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950 flex flex-col min-h-0 shrink-0 shadow-xl z-20">
                
                {/* Sidebar Header */}
                <div className="p-4 border-b border-zinc-200 dark:border-zinc-900 bg-zinc-50/40 dark:bg-zinc-900/10 shrink-0">
                  <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Compare PDF</h2>
                </div>

                {/* Tab buttons */}
                <div className="p-3.5 border-b border-zinc-200 dark:border-zinc-900 flex gap-2 shrink-0 select-none">
                  <button
                    onClick={() => setActiveTab("text")}
                    className={`flex-1 py-2.5 px-2 rounded-xl border text-[11px] font-bold transition-all flex flex-col items-center gap-1.5 cursor-pointer ${
                      activeTab === "text"
                        ? "bg-indigo-50 border-indigo-500 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300"
                        : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 text-zinc-500"
                    }`}
                  >
                    <Columns size={15} />
                    <span>Semantic Text</span>
                  </button>
                  <button
                    onClick={() => setActiveTab("overlay")}
                    className={`flex-1 py-2.5 px-2 rounded-xl border text-[11px] font-bold transition-all flex flex-col items-center gap-1.5 cursor-pointer ${
                      activeTab === "overlay"
                        ? "bg-indigo-50 border-indigo-500 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300"
                        : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 text-zinc-500"
                    }`}
                  >
                    <Layers size={15} />
                    <span>Content Overlay</span>
                  </button>
                </div>

                {/* Tab explanatory note */}
                <div className="px-4 py-2.5 bg-indigo-50/40 dark:bg-indigo-950/10 border-b border-zinc-200 dark:border-zinc-900 text-[10px] text-indigo-650 dark:text-indigo-400 font-semibold shrink-0">
                  {activeTab === "text" 
                    ? "Compare text changes between two PDFs." 
                    : "Overlay original and revised versions to visually inspect changes."}
                </div>

                {/* Search Text Box */}
                <div className="p-3.5 border-b border-zinc-200 dark:border-zinc-900 shrink-0">
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 text-zinc-400" size={14} />
                    <input
                      type="text"
                      placeholder="Search text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-8.5 pr-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-850 bg-zinc-50 dark:bg-zinc-950/60 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400"
                    />
                  </div>
                </div>

                {/* Change Report Scroll List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[10px] font-black text-zinc-450 uppercase tracking-widest">
                      Change report ({filteredDiffs.length})
                    </h3>
                  </div>
                  
                  {filteredDiffs.map((diff, flatIdx) => {
                    const isActive = activeDiffIdx === flatIdx;
                    const d = diff.item;
                    const typeColor =
                      d.type === "addition" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                        : d.type === "deletion" ? "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20"
                          : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20";
                    return (
                      <div key={flatIdx} onClick={() => handleSelectDiff(flatIdx)}
                        className={`p-3 rounded-xl border text-left transition-all duration-200 cursor-pointer ${isActive ? "bg-indigo-500/10 border-indigo-500 shadow-sm scale-[1.01]"
                            : "bg-white/20 dark:bg-zinc-900/5 border-zinc-200/50 dark:border-zinc-850/50 hover:bg-zinc-100/40 dark:hover:bg-zinc-900/30"
                          }`}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[9px] font-bold text-zinc-400 uppercase">Page {diff.pageIndex + 1}</span>
                          <span className={`px-1.5 py-0.5 rounded border text-[8px] uppercase tracking-wider font-extrabold ${typeColor}`}>{d.type}</span>
                        </div>
                        <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200 truncate-2-lines leading-snug">
                          {d.text || d.description}
                        </p>
                      </div>
                    );
                  })}
                  
                  {filteredDiffs.length === 0 && (
                    <div className="text-center py-10 text-zinc-400 text-xs italic font-semibold">
                      No differences found!
                    </div>
                  )}
                </div>

                {/* Bottom Brand Indigo Download Report Button */}
                <div className="p-4 border-t border-zinc-200 dark:border-zinc-900 bg-zinc-50/40 dark:bg-zinc-950/20 shrink-0">
                  <button onClick={handleExportReport} disabled={isExporting}
                    className="w-full py-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs transition-all shadow-md shadow-indigo-600/15 hover:shadow-indigo-650/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 uppercase tracking-widest select-none">
                    {isExporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                    <span>Download report</span>
                  </button>
                </div>
              </div>

            </div>

          </div>
        )}
      </div>

    </div>
  );
}

// ─── ComparePageView ──────────────────────────────────────────────────────────

interface PageViewProps {
  doc: any;
  pageIndex: number;
  zoom: number;
  diffs: DiffItem[];
  activeDiffItem: DiffItem | null;
  side: "original" | "revised";
  opacity?: number;
  mixBlendMode?: React.CSSProperties["mixBlendMode"];
}

function ComparePageView({ doc, pageIndex, zoom, diffs, activeDiffItem, opacity, mixBlendMode }: PageViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // logicalSize: CSS pixel dimensions of the page container (what annotations use)
  const [logicalSize, setLogicalSize] = useState<{ w: number; h: number } | null>(null);
  // physicalSize: actual canvas backing store dimensions (logical * DPR)
  const [physicalSize, setPhysicalSize] = useState<{ w: number; h: number } | null>(null);
  // logicalScale: the zoom scale used to map PDF pts → CSS px (without DPR)
  const [logicalScale, setLogicalScale] = useState<number | null>(null);

  // Effect 1: Compute viewport sizes from the PDF page
  useEffect(() => {
    if (!doc) return;
    let cancelled = false;

    (async () => {
      try {
        const page = await doc.getPage(pageIndex + 1);
        if (cancelled) return;

        const dpr = window.devicePixelRatio || 1;
        // logicalScale renders the PDF in CSS pixels — what the eye sees
        const lScale = zoom;
        // physicalScale renders into the canvas backing store at full sharpness
        const pScale = zoom * dpr;

        const logicalVp = page.getViewport({ scale: lScale });
        const physicalVp = page.getViewport({ scale: pScale });

        setLogicalSize({ w: logicalVp.width, h: logicalVp.height });
        setPhysicalSize({ w: physicalVp.width, h: physicalVp.height });
        setLogicalScale(lScale);
      } catch (err) {
        console.error("Error loading PDF page size:", err);
      }
    })();

    return () => { cancelled = true; };
  }, [doc, pageIndex, zoom]);

  // Effect 2: Render the PDF page at physical resolution into the canvas
  useEffect(() => {
    if (!doc || !physicalSize || !logicalSize) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;
    let task: any = null;

    (async () => {
      try {
        const page = await doc.getPage(pageIndex + 1);
        if (cancelled) return;

        const dpr = window.devicePixelRatio || 1;
        const pScale = zoom * dpr;
        const physicalVp = page.getViewport({ scale: pScale });

        // Set the canvas backing store to physical pixel dimensions
        canvas.width = physicalVp.width;
        canvas.height = physicalVp.height;

        const ctx = canvas.getContext("2d");
        if (!ctx || cancelled) return;

        task = page.render({
          canvasContext: ctx,
          viewport: physicalVp,
          intent: "display",
        });
        await task.promise;
      } catch (err) {
        if (!cancelled) console.error("Error rendering PDF page:", err);
      }
    })();

    return () => {
      cancelled = true;
      task?.cancel?.();
    };
  }, [doc, pageIndex, physicalSize, zoom]);

  // Deduplication: strip coordinate-identical boxes of the same type
  const dedupedDiffs = diffs.reduce((acc, current) => {
    const isDupe = acc.some(existing =>
      Math.abs(existing.rect.x - current.rect.x) < 4 &&
      Math.abs(existing.rect.y - current.rect.y) < 4 &&
      existing.type === current.type
    );
    if (!isDupe) acc.push(current);
    return acc;
  }, [] as DiffItem[]);

  return (
    <div
      className="relative shadow-lg border border-zinc-200 dark:border-zinc-800 bg-white overflow-hidden shrink-0"
      style={{
        // Container is sized in CSS (logical) pixels so scrolling & overlay math work correctly
        width: logicalSize ? `${logicalSize.w}px` : "auto",
        height: logicalSize ? `${logicalSize.h}px` : "auto",
        opacity: opacity,
        mixBlendMode: mixBlendMode,
      }}
    >
      {/* Canvas is stretched to fill the CSS container via 100%/100%, while its
          backing store (width/height attributes) is set at physical resolution */}
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%", display: "block" }}
      />

      {/* Overlay annotations — coordinates are in PDF pt, scaled by logicalScale to CSS px */}
      {logicalScale !== null && dedupedDiffs.map((d, i) => {
        const rx = d.rect?.x ?? 0;
        const ry = d.rect?.y ?? 0;
        const rw = d.rect?.w ?? 0;
        const rh = d.rect?.h ?? 0;

        // Map PDF pt → CSS px using the logical (non-DPR) scale
        const left   = rx * logicalScale;
        const top    = ry * logicalScale;
        const width  = rw * logicalScale;
        const height = rh * logicalScale;

        if (width < 1 || height < 1) return null;

        const isActive =
          activeDiffItem != null &&
          activeDiffItem.rect != null &&
          d.rect != null &&
          Math.abs(activeDiffItem.rect.x - d.rect.x) < 1 &&
          Math.abs(activeDiffItem.rect.y - d.rect.y) < 1 &&
          activeDiffItem.type === d.type;

        const style = getAnnotationStyle(d);
        const H_PAD = 2;
        const V_PAD = 1;

        return (
          <div
            key={i}
            className={`absolute rounded-[4px] transition-all duration-200 cursor-help ${
              isActive
                ? `${style.activeBg} z-20`
                : `${style.bg} ${style.border}`
            }`}
            style={{
              left:   `${Math.max(0, left  - H_PAD)}px`,
              top:    `${Math.max(0, top   - V_PAD)}px`,
              width:  `${width  + H_PAD * 2}px`,
              height: `${height + V_PAD * 2}px`,
              borderWidth: "1.5px",
              boxSizing: "border-box",
              pointerEvents: "auto",
              zIndex: isActive ? 20 : 10,
            }}
            title={`${style.label}: "${d.text}"\n${d.description}`}
          />
        );
      })}
    </div>
  );
}