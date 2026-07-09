"use client";

import React from "react";

export default function SecurityBanner() {
  return (
    <section className="py-12 border-t border-b border-zinc-200 dark:border-zinc-900 bg-zinc-50 dark:bg-zinc-950 px-6">
      <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center gap-6 justify-between text-center md:text-left">
        <div className="flex items-center gap-4 flex-col md:flex-row">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow">
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" />
            </svg>
          </div>
          <div>
            <h4 className="font-extrabold text-sm text-zinc-900 dark:text-white">Enterprise-Grade Document Security</h4>
            <p className="text-xs text-zinc-550 dark:text-zinc-400 mt-0.5">Your uploads are processed in secure memory buffers, heavily encrypted, and auto-deleted after 24 hours.</p>
          </div>
        </div>
        <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 border border-zinc-300 dark:border-zinc-800 px-3 py-1 rounded-full uppercase tracking-wider bg-white dark:bg-zinc-900 shadow-sm shrink-0">
          SOC2 Compliant Sandbox
        </span>
      </div>
    </section>
  );
}
