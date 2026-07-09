"use client";

import Link from "next/link";

interface HeaderProps {
  isLoggedIn: boolean;
  onLogout?: () => void;
  userEmail?: string;
  userName?: string;
}

interface DropdownTool {
  name: string;
  description: string;
  badge?: "AI" | "Popular";
  icon: React.ReactNode;
}

export default function Header({ isLoggedIn, onLogout, userEmail, userName }: HeaderProps) {
  const dropdownTools: DropdownTool[] = [
    {
      name: "Edit PDF",
      description: "Modify text, images, shapes and document formatting directly.",
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
        </svg>
      ),
    },
    {
      name: "Merge PDF",
      description: "Combine multiple PDF files into a single document in custom order.",
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M11.99 18.54l-7.37-5.73L3 14.07l9 7 9-7-1.63-1.27-7.38 5.74zM12 16l7.36-5.73L21 9l-9-7-9 7 1.63 1.27L12 16z" />
        </svg>
      ),
    },
    {
      name: "Compress PDF",
      description: "Reduce file size while maintaining the original rendering quality.",
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM19 18H6c-2.21 0-4-1.79-4-4 0-2.05 1.53-3.76 3.56-3.97l1.07-.11.5-.95C8.08 7.14 9.94 6 12 6c2.62 0 4.88 1.86 5.39 4.43l.3 1.5 1.53.11c1.56.1 2.78 1.41 2.78 2.96 0 1.65-1.35 3-3 3zm-5.55-8h-2.9v3H7.5l4.5 4.5 4.5-4.5h-3.05z" />
        </svg>
      ),
    },
    {
      name: "e-Sign PDF",
      description: "Fill out forms, digital signatures, and securely sign contracts.",
      badge: "Popular",
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M20.71 5.63l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-3.12 3.12-1.93-1.93-1.41 1.41 2.62 2.62L3 18.25V21h2.75l9.74-9.74 2.62 2.62 1.41-1.41-1.93-1.93 3.12-3.12c.39-.39.39-1.02 0-1.41zM5.12 19H4v-1.12l8.34-8.34 1.12 1.12L5.12 19z" />
        </svg>
      ),
    },
    {
      name: "AI Summarizer",
      description: "Analyze large PDF files and instantly extract obligations summaries.",
      badge: "AI",
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2L9 9 2 12l7 3 3 7 3-7 7-3-7-3-3-7zm0 13.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
        </svg>
      ),
    },
    {
      name: "AI Smart Chat",
      description: "Query your documents, locate liability clauses and audit obligations.",
      badge: "AI",
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z" />
        </svg>
      ),
    },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 h-18 border-b border-zinc-200/50 dark:border-zinc-900/50 bg-white/70 dark:bg-zinc-950/70 backdrop-blur-md z-40 transition-all">
      <div className="max-w-7xl mx-auto h-full px-6 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-8.5 h-8.5 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <svg className="w-4.5 h-4.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <span className="text-base font-bold tracking-tight text-zinc-900 dark:text-white">
            QT PDF Editor
          </span>
        </Link>

        {/* Navigation Links */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-zinc-500 dark:text-zinc-400">
          {/* PDF Tools Dropdown Wrapper */}
          <div className="relative py-5 group/menu">
            <button
              className="flex items-center gap-1.5 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer focus:outline-none"
            >
              <span>PDF Tools</span>
              <svg
                className="w-4 h-4 transition-transform duration-200 group-hover/menu:rotate-180"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Dropdown Panel */}
            <div className="absolute top-full left-1/2 -translate-x-1/2 w-[560px] p-6 rounded-2xl border border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950 shadow-2xl backdrop-blur-md opacity-0 invisible group-hover/menu:opacity-100 group-hover/menu:visible transition-all duration-200 translate-y-2 group-hover/menu:translate-y-0 z-50">
              <div className="grid grid-cols-2 gap-4">
                {dropdownTools.map((tool, idx) => (
                  <Link
                    key={idx}
                    href={isLoggedIn ? "/editor" : "/auth"}
                    className="flex gap-3.5 p-3 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors group cursor-pointer"
                  >
                    <div className="w-9 h-9 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-300">
                      {tool.icon}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-zinc-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                          {tool.name}
                        </span>
                        {tool.badge && (
                          <span className="text-[8px] font-extrabold px-1.5 py-0.5 rounded-md uppercase tracking-wider bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200/50 dark:border-indigo-900/30">
                            {tool.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-550 dark:text-zinc-400 mt-1 leading-relaxed line-clamp-2 font-normal">
                        {tool.description}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <a href="#ai-preview" className="hover:text-zinc-900 dark:hover:text-white transition-colors">AI Assistant</a>
        </nav>

        {/* Action Buttons */}
        <div className="flex items-center gap-4">
          {isLoggedIn ? (
            <div className="flex items-center gap-4">
              <Link
                href="/profile"
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-700 dark:text-zinc-200 transition-all cursor-pointer shadow-sm"
              >
                <svg className="w-4 h-4 text-zinc-500" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                </svg>
                <span>Profile</span>
              </Link>
              {onLogout && (
                <button
                  onClick={onLogout}
                  className="text-sm font-bold text-zinc-500 dark:text-zinc-400 hover:text-red-500 dark:hover:text-red-400 transition-colors cursor-pointer"
                >
                  Sign Out
                </button>
              )}
            </div>
          ) : (
            <>
              <Link
                href="/auth"
                className="text-sm font-bold text-zinc-650 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white transition-colors"
              >
                Sign In
              </Link>
              <Link
                href="/auth"
                className="px-4.5 py-2 text-sm font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md shadow-indigo-600/10 hover:shadow-indigo-600/20 cursor-pointer"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
