"use client";

import React from "react";

interface PDFTool {
  name: string;
  description: string;
  category: "edit" | "convert" | "sign" | "ai";
  badge?: "Popular" | "AI" | "New";
  icon: React.ReactNode;
}

interface ToolsGridProps {
  activeFilter: "all" | "edit" | "convert" | "sign" | "ai";
  onFilterChange: (filter: "all" | "edit" | "convert" | "sign" | "ai") => void;
  onAction: () => void;
}

export default function ToolsGrid({
  activeFilter,
  onFilterChange,
  onAction,
}: ToolsGridProps) {
  const categories = [
    { id: "all", label: "All Tools" },
    { id: "edit", label: "Organize & Edit" },
    { id: "convert", label: "Convert" },
    { id: "sign", label: "Sign & Protect" },
    { id: "ai", label: "AI Assistant" },
  ];

  const tools: PDFTool[] = [
    {
      name: "Edit PDF",
      description: "Modify text, insert images, add shapes, and change document formatting directly.",
      category: "edit",
      icon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
        </svg>
      ),
    },
    {
      name: "Merge PDF",
      description: "Combine multiple PDF files into a single document in your preferred order.",
      category: "edit",
      icon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <path d="M11.99 18.54l-7.37-5.73L3 14.07l9 7 9-7-1.63-1.27-7.38 5.74zM12 16l7.36-5.73L21 9l-9-7-9 7 1.63 1.27L12 16z" />
        </svg>
      ),
    },
    {
      name: "Split PDF",
      description: "Extract specific pages or separate a document into multiple files.",
      category: "edit",
      icon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <path d="M6 2c-1.1 0-2 .9-2 2s.9 2 2 2c.12 0 .24-.01.36-.04L9.12 9c-.69.83-1.12 1.87-1.12 3s.43 2.17 1.12 3l-2.76 3.04c-.12-.03-.24-.04-.36-.04-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2c0-.12-.01-.24-.04-.36L11 14.12c.83.69 1.87 1.12 3 1.12s2.17-.43 3-1.12l3.04 2.76c-.03.12-.04.24-.04.36 0 1.1.9 2 2 2s2-.9 2-2-.9-2-2-2c-.12 0-.24.01-.36.04L19 12.88c.69-.83 1.12-1.87 1.12-3s-.43-2.17-1.12-3l2.76-3.04c.12.03.24.04.36.04 1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2c0 .4.12.76.33 1.07l-2.43 2.46C13.93 5.39 12.54 4.78 12 4.78c-1.54 0-2.93.61-3.9 1.53L5.67 3.88C5.88 3.57 6 3.21 6 2.82c0-.45-.16-.88-.47-1.19z" />
        </svg>
      ),
    },
    {
      name: "Compress PDF",
      description: "Reduce file size while maintaining the original quality of text and graphics.",
      category: "edit",
      icon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM19 18H6c-2.21 0-4-1.79-4-4 0-2.05 1.53-3.76 3.56-3.97l1.07-.11.5-.95C8.08 7.14 9.94 6 12 6c2.62 0 4.88 1.86 5.39 4.43l.3 1.5 1.53.11c1.56.1 2.78 1.41 2.78 2.96 0 1.65-1.35 3-3 3zm-5.55-8h-2.9v3H7.5l4.5 4.5 4.5-4.5h-3.05z" />
        </svg>
      ),
    },
    {
      name: "PDF to Word",
      description: "Convert PDFs to editable Microsoft Word documents with high accuracy.",
      category: "convert",
      icon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm-1 7V3.5L18.5 9H13v5.5zm-4 4h8v2H8v-2z" />
        </svg>
      ),
    },
    {
      name: "Word to PDF",
      description: "Turn DOCX and DOC files into clean, professional PDF files instantly.",
      category: "convert",
      icon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm-1 7V3.5L18.5 9H13zm-1 5c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm-4 3h8v1H8v-1z" />
        </svg>
      ),
    },
    {
      name: "e-Sign PDF",
      description: "Fill out forms, design cursive digital signatures, and securely sign documents.",
      category: "sign",
      badge: "Popular",
      icon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <path d="M20.71 5.63l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-3.12 3.12-1.93-1.93-1.41 1.41 2.62 2.62L3 18.25V21h2.75l9.74-9.74 2.62 2.62 1.41-1.41-1.93-1.93 3.12-3.12c.39-.39.39-1.02 0-1.41zM5.12 19H4v-1.12l8.34-8.34 1.12 1.12L5.12 19z" />
        </svg>
      ),
    },
    {
      name: "Protect PDF",
      description: "Encrypt files with strong passwords and control permissions for opening or editing.",
      category: "sign",
      icon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
        </svg>
      ),
    },
    {
      name: "AI Document Summarizer",
      description: "Analyze hundreds of pages and instantly generate executive summaries.",
      category: "ai",
      badge: "AI",
      icon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2L9 9 2 12l7 3 3 7 3-7 7-3-7-3-3-7zm0 13.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
        </svg>
      ),
    },
    {
      name: "AI Smart Chat",
      description: "Query your contracts, identify key liability clauses, and extract audit obligations.",
      category: "ai",
      badge: "AI",
      icon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z" />
        </svg>
      ),
    },
  ];

  const filteredTools =
    activeFilter === "all"
      ? tools
      : tools.filter((t) => t.category === activeFilter);

  return (
    <section id="tools" className="py-24 px-6 border-t border-zinc-200 dark:border-zinc-900 bg-white/40 dark:bg-zinc-950/20 relative">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="text-center max-w-xl mx-auto mb-14">
          <h2 className="text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
            Every tool you need to work efficiently
          </h2>
          <p className="mt-3 text-sm text-zinc-550 dark:text-zinc-400">
            Simplify your workflow with fully-featured utilities. Filter categories or explore all features below.
          </p>
        </div>

        {/* Filtering Tabs */}
        <div className="flex flex-wrap justify-center items-center gap-2 mb-12">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => onFilterChange(cat.id as any)}
              className={`px-4.5 py-2 text-xs sm:text-sm font-semibold rounded-xl transition-all cursor-pointer ${
                activeFilter === cat.id
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10"
                  : "border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-650 dark:text-zinc-400"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Grid Layout */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredTools.map((tool, idx) => (
            <div
              key={idx}
              onClick={onAction}
              className="group p-6 rounded-2xl border border-zinc-200 dark:border-zinc-900 bg-white/30 dark:bg-zinc-900/10 hover:border-indigo-500 dark:hover:border-indigo-500/50 hover:shadow-lg transition-all duration-300 flex flex-col justify-between cursor-pointer"
            >
              <div>
                <div className="flex items-center justify-between mb-5">
                  {/* Tool Icon */}
                  <div className="w-10 h-10 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    {tool.icon}
                  </div>

                  {/* Optional Badge */}
                  {tool.badge && (
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200/50 dark:border-indigo-900/30"
                    >
                      {tool.badge}
                    </span>
                  )}
                </div>

                <h3 className="text-base font-bold text-zinc-900 dark:text-white mb-2">
                  {tool.name}
                </h3>
                <p className="text-xs sm:text-sm leading-relaxed text-zinc-550 dark:text-zinc-400">
                  {tool.description}
                </p>
              </div>

              <div className="mt-5 pt-3 border-t border-dashed border-zinc-200 dark:border-zinc-900/50 flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 group-hover:translate-x-0.5 transition-transform">
                Access Tool
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
