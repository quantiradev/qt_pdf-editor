"use client";

import React from "react";

export default function Footer() {
  return (
    <footer className="border-t border-zinc-200 dark:border-zinc-900 py-12 px-6 bg-zinc-100/50 dark:bg-zinc-950">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-2.5">
          <div className="w-6.5 h-6.5 bg-indigo-600 rounded-lg flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <span className="text-sm font-bold tracking-tight text-zinc-850 dark:text-zinc-200">
            QT PDF Editor
          </span>
        </div>

        <p className="text-xs text-zinc-500 dark:text-zinc-550">
          &copy; 2026 QT PDF Technologies. All rights reserved. Google DeepMind pair-programmed setup.
        </p>

        <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-zinc-550 dark:text-zinc-400 font-semibold justify-center md:justify-end">
          <a href="#pricing" className="hover:text-indigo-500 transition-colors">Pricing</a>
          <a href="#faq" className="hover:text-indigo-500 transition-colors">FAQ</a>
          <a href="#documentation" onClick={(e) => { e.preventDefault(); alert("Documentation workspace is coming soon."); }} className="hover:text-indigo-500 transition-colors">Documentation</a>
          <div className="hidden sm:block h-4 w-px bg-zinc-200 dark:bg-zinc-800" />
          <a href="https://nextjs.org" target="_blank" rel="noreferrer" className="hover:text-indigo-500 transition-colors">Powered by Next.js</a>
          <a href="https://tailwindcss.com" target="_blank" rel="noreferrer" className="hover:text-indigo-500 transition-colors">Tailwind CSS</a>
        </div>
      </div>
    </footer>
  );
}
