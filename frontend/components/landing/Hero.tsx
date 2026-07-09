"use client";

import React from "react";

interface HeroProps {
  isDragging: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onTriggerFileSelect: (e: React.MouseEvent) => void;
}

export default function Hero({
  isDragging,
  onDragOver,
  onDragLeave,
  onDrop,
  fileInputRef,
  onFileChange,
  onTriggerFileSelect,
}: HeroProps) {
  return (
    <section className="pt-32 pb-16 px-6 max-w-7xl mx-auto flex flex-col items-center text-center">
      {/* Tagline Badge */}
      <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 text-xs font-semibold border border-indigo-200/50 dark:border-indigo-900/30 mb-8 animate-float">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
        </span>
        Next-generation online PDF workspace
      </div>

      {/* Big Headline */}
      <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight max-w-4xl leading-[1.1] text-zinc-900 dark:text-white">
        Every PDF Tool You Need.{" "}
        <span className="text-indigo-600 dark:text-indigo-400">
          AI-Powered & Online.
        </span>
      </h1>

      {/* Subtitle */}
      <p className="mt-6 text-base sm:text-lg text-zinc-550 dark:text-zinc-400 max-w-2xl leading-relaxed">
        Unlock the powerful editing of Adobe Acrobat and the simple speed of iLovePDF. Annotate, compress, sign, and consult your contracts with our AI Copilot in one secure browser tab.
      </p>

      {/* Adobe-style Interactive Dropzone Call-to-Action */}
      <div className="mt-12 w-full max-w-3xl px-4">
        <div
          onClick={onTriggerFileSelect}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={`w-full py-14 px-8 rounded-3xl border-2 border-dashed glass-panel text-center cursor-pointer transition-all duration-300 shadow-xl relative overflow-hidden group select-none ${
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
          <div className="absolute top-0 right-0 w-60 h-60 bg-indigo-500/10 rounded-full blur-[80px] pointer-events-none opacity-40 group-hover:opacity-80 transition-opacity" />

          <div className="relative z-10 flex flex-col items-center justify-center">
            {/* Upload Icon */}
            <div className="w-14 h-14 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300">
              <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z" />
              </svg>
            </div>

            <h3 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white mb-2">
              Drag and drop your PDF here
            </h3>
            <p className="text-xs sm:text-sm text-zinc-550 dark:text-zinc-400 mb-6 max-w-sm mx-auto">
              Or click to select a file from your device and unlock editing.
            </p>

            {/* Action Button */}
            <div className="px-6 py-3 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 font-semibold text-sm transition-all shadow-md shadow-indigo-600/10 hover:shadow-indigo-600/25 active:scale-[0.98]">
              Select PDF File
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
