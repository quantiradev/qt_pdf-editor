"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface DashboardHeroProps {
  userName: string;
  userEmail: string;
  isDragging: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onTriggerFileSelect: (e: React.MouseEvent) => void;
}

interface WorkspaceDoc {
  id: string;
  name: string;
  uploadedAt: string;
  size: string;
}

export default function DashboardHero({
  userName,
  userEmail,
  isDragging,
  onDragOver,
  onDragLeave,
  onDrop,
  fileInputRef,
  onFileChange,
  onTriggerFileSelect,
}: DashboardHeroProps) {
  const router = useRouter();
  
  const [documents, setDocuments] = useState<WorkspaceDoc[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);

  useEffect(() => {
    // Fetch real files from the Python PDF backend
    fetch("/api/files")
      .then((r) => r.json())
      .then((files: any[]) => {
        const active = (files || []).filter((f) => !f.deleted).slice(0, 20);
        setDocuments(
          active.map((f) => ({
            id: f.id,
            name: f.name,
            uploadedAt: new Date(f.opened_at * 1000).toLocaleString(undefined, {
              month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
            }),
            size: f.size >= 1024 * 1024
              ? `${(f.size / 1024 / 1024).toFixed(1)} MB`
              : `${Math.round(f.size / 1024)} KB`,
          }))
        );
      })
      .catch(() => setDocuments([]))
      .finally(() => setLoadingDocs(false));
  }, []);

  const handleOpenDoc = (id: string) => {
    router.push(`/editor/${id}`);
  };

  const handleDeleteDoc = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    fetch(`/api/files/${id}`, { method: "DELETE" })
      .then(() => setDocuments((prev) => prev.filter((doc) => doc.id !== id)))
      .catch(() => setDocuments((prev) => prev.filter((doc) => doc.id !== id)));
  };


  return (
    <section className="pt-32 pb-16 px-6 max-w-7xl mx-auto">
      {/* Welcome Tagline */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-8 border-b border-zinc-200/60 dark:border-zinc-900/60">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 text-xs font-bold border border-indigo-200/50 dark:border-indigo-900/30 mb-3">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-indigo-500"></span>
            </span>
            Active User Workspace
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
            Welcome back, <span className="text-indigo-600 dark:text-indigo-400">{userName || userEmail || "Editor"}</span>!
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-405 mt-2">
            Select a PDF tool, open a recent document, or upload a new file below to start editing.
          </p>
        </div>

        {/* Dashboard Status Metadata badges */}
        <div className="flex flex-wrap gap-2.5 shrink-0">
          <div className="px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-850 bg-white/50 dark:bg-zinc-900/30 text-center">
            <p className="text-[10px] uppercase font-bold tracking-wider text-zinc-400">Account Tier</p>
            <p className="text-xs font-extrabold text-indigo-600 dark:text-indigo-400 mt-0.5">Professional Pro</p>
          </div>
        </div>
      </div>

      {/* Workspace Dashboard Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-10">
        {/* Left Side: Recent Documents Table */}
        <div className="lg:col-span-7 flex flex-col justify-between p-6 rounded-3xl border border-zinc-200 dark:border-zinc-900 bg-white/40 dark:bg-zinc-905/10 backdrop-blur-md">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-zinc-200/50 dark:border-zinc-900/50 mb-4">
              <h2 className="text-base font-bold text-zinc-900 dark:text-white">Recent Workspace Documents</h2>
              <span className="text-[10px] font-bold px-2 py-0.5 bg-zinc-100 dark:bg-zinc-900 rounded text-zinc-500">
                {documents.length} Files
              </span>
            </div>

            {loadingDocs ? (
              <div className="flex items-center justify-center py-10 gap-3 text-zinc-400">
                <div className="w-5 h-5 border-2 border-zinc-300 border-t-indigo-500 rounded-full animate-spin" />
                <span className="text-xs font-semibold">Loading documents…</span>
              </div>
            ) : documents.length > 0 ? (
              <div className="space-y-3">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    onClick={() => handleOpenDoc(doc.id)}
                    className="flex items-center justify-between p-3.5 rounded-xl border border-zinc-200/50 dark:border-zinc-900/50 hover:border-indigo-500 dark:hover:border-indigo-500/40 bg-white/30 dark:bg-zinc-900/10 hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30 transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-9 h-9 rounded-lg bg-indigo-500/10 text-indigo-650 dark:text-indigo-400 flex items-center justify-center shrink-0">
                        <svg className="w-5.5 h-5.5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white truncate group-hover:text-indigo-650 dark:group-hover:text-indigo-450 transition-colors">
                          {doc.name}
                        </p>
                        <p className="text-[10px] text-zinc-400 mt-0.5">
                          {doc.uploadedAt} &bull; {doc.size}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button className="px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-900 hover:bg-indigo-600 dark:hover:bg-indigo-600 hover:text-white text-zinc-700 dark:text-zinc-300 text-xs font-bold transition-colors cursor-pointer">
                        Open
                      </button>
                      <button
                        onClick={(e) => handleDeleteDoc(doc.id, e)}
                        className="p-1.5 rounded-lg hover:bg-red-500/10 text-zinc-400 hover:text-red-500 transition-colors cursor-pointer"
                        title="Remove Document"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10">
                <svg className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-xs text-zinc-400 font-semibold">No recent documents available.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Compact Dropzone Uploader */}
        <div className="lg:col-span-5">
          <div
            onClick={onTriggerFileSelect}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            className={`w-full h-full p-8 rounded-3xl border-2 border-dashed glass-panel text-center cursor-pointer transition-all duration-300 shadow-lg relative overflow-hidden group select-none flex flex-col justify-center items-center ${
              isDragging
                ? "border-indigo-500 bg-indigo-550/5 dark:bg-indigo-500/5 scale-[1.01]"
                : "border-zinc-300 hover:border-indigo-500/80 dark:border-zinc-800 dark:hover:border-indigo-500/40"
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              accept=".pdf"
              onChange={onFileChange}
              className="hidden"
            />
            <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-500/5 rounded-full blur-[60px] pointer-events-none opacity-40 group-hover:opacity-80 transition-opacity" />

            <div className="relative z-10 flex flex-col items-center justify-center">
              {/* Solid Cloud Upload Icon */}
              <div className="w-12 h-12 bg-indigo-500/10 text-indigo-650 dark:text-indigo-400 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z" />
                </svg>
              </div>

              <h3 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-white mb-1.5">
                Upload New Document
              </h3>
              <p className="text-xs text-zinc-550 dark:text-zinc-400 mb-5 max-w-[200px] mx-auto leading-relaxed">
                Drag and drop a PDF file here, or click to choose from device.
              </p>

              <div className="px-4.5 py-2.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 font-semibold text-xs transition-all shadow-md shadow-indigo-600/10 hover:shadow-indigo-600/20 active:scale-[0.98]">
                Select PDF File
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
