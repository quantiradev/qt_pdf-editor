"use client";

import React from "react";

interface AIAssistantPreviewProps {
  onAction: () => void;
}

export default function AIAssistantPreview({ onAction }: AIAssistantPreviewProps) {
  return (
    <section id="ai-preview" className="py-24 px-6 border-t border-zinc-200 dark:border-zinc-900 relative">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Left Description Column */}
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 text-xs font-semibold border border-indigo-200/50 dark:border-indigo-900/30 mb-6">
              AI Copilot Add-on
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-900 dark:text-white leading-[1.15]">
              Ask your documents questions, get answers in seconds.
            </h2>
            <p className="mt-6 text-sm sm:text-base text-zinc-550 dark:text-zinc-400 leading-relaxed">
              Just like Adobe Acrobat's AI Assistant, our built-in chatbot queries contracts, agreements, and large documents instantly. Extract obligations, summarize long chapters, and audit compliance issues instantly.
            </p>

            {/* Points */}
            <div className="mt-8 space-y-4 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 bg-indigo-550/10 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                Summarize section obligations dynamically.
              </div>
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 bg-indigo-550/10 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                Identify conflicting clauses and liabilities.
              </div>
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 bg-indigo-550/10 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                Secure queries: your documentation is processed in private sandboxes.
              </div>
            </div>

            <div className="mt-10">
              <button
                onClick={onAction}
                className="px-6 py-3 font-bold text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-lg hover:shadow-indigo-600/20 active:scale-[0.98] transition-all cursor-pointer"
              >
                Try AI Summary Free
              </button>
            </div>
          </div>

          {/* Right Chat Mockup Column */}
          <div className="glass-panel p-4 rounded-3xl border border-zinc-200/50 dark:border-zinc-900/50 shadow-2xl relative overflow-hidden flex flex-col aspect-[1.25/1] max-w-xl mx-auto w-full">
            <div className="absolute top-0 left-0 right-0 h-12 border-b border-zinc-200 dark:border-zinc-800 bg-white/40 dark:bg-zinc-900/40 px-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-indigo-500" />
                <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">AI Assistant Preview</span>
              </div>
              <span className="text-[10px] text-zinc-400 font-mono">NDA_Agreement.pdf</span>
            </div>

            {/* Chat View */}
            <div className="flex-1 pt-16 pb-4 px-4 overflow-y-auto space-y-4 no-scrollbar">
              {/* Bubble 1 */}
              <div className="flex gap-3 justify-end">
                <div className="max-w-[75%] p-3 rounded-2xl bg-indigo-600 text-white text-xs font-medium shadow-sm leading-relaxed">
                  Can you summarize the termination notice requirement?
                </div>
              </div>

              {/* Bubble 2 */}
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-xl bg-indigo-600 flex items-center justify-center text-[10px] font-bold text-white shadow shadow-indigo-600/20 shrink-0">
                  AI
                </div>
                <div className="max-w-[80%] p-3.5 rounded-2xl bg-white/60 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-705 dark:text-zinc-305 shadow-sm leading-relaxed space-y-2">
                  <p>According to **Section 11.2 (page 4)**:</p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>Termination requires a **30-day prior written notice**.</li>
                    <li>Obligations under confidentiality continue for **5 years** post-termination.</li>
                  </ul>
                </div>
              </div>

              {/* Bubble 3 */}
              <div className="flex gap-3 justify-end">
                <div className="max-w-[75%] p-3 rounded-2xl bg-indigo-600 text-white text-xs font-medium shadow-sm leading-relaxed">
                  Are there any liability caps?
                </div>
              </div>

              {/* Bubble 4 */}
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-xl bg-indigo-600 flex items-center justify-center text-[10px] font-bold text-white shadow shadow-indigo-600/20 shrink-0">
                  AI
                </div>
                <div className="max-w-[80%] p-3.5 rounded-2xl bg-white/60 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-705 dark:text-zinc-305 shadow-sm leading-relaxed">
                  Yes, **Section 14.1** limits total cumulative liability to **$25,000** for standard breaches, except in instances of gross negligence or intellectual property infringement.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
