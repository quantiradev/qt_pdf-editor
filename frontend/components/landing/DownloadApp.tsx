"use client";

import React from "react";
import { Monitor, Smartphone, Laptop, SmartphoneIcon } from "lucide-react";

interface Platform {
  name: string;
  description: string;
  badge?: string;
  icon: React.ReactNode;
  downloadUrl: string;
  actionText: string;
  requirements: string;
}

export default function DownloadApp() {
  const platforms: Platform[] = [
    {
      name: "Windows App",
      description: "Get the full power of QT PDF Editor directly on your desktop. Faster uploads, offline drafting, and native system integrations.",
      badge: "Desktop",
      actionText: "Download Installer (.exe)",
      downloadUrl: "#",
      requirements: "Windows 10 or 11 (64-bit)",
      icon: (
        <svg className="w-8 h-8 text-blue-500" viewBox="0 0 24 24" fill="currentColor">
          <path d="M0 3.449L9.75 2.1v9.45H0V3.449zM0 12.45h9.75v9.45L0 20.551v-8.1zM10.8 1.95L24 0v11.55H10.8V1.95zM10.8 12.45H24v11.55l-13.2-1.95v-9.6z" />
        </svg>
      ),
    },
    {
      name: "Linux Client",
      description: "Run QT PDF Editor seamlessly on your Linux distribution. Package formats optimized for standard dependency trees.",
      badge: "Open Source",
      actionText: "Download AppImage",
      downloadUrl: "#",
      requirements: "Ubuntu, Debian, Fedora, Arch",
      icon: (
        <svg className="w-8 h-8 text-zinc-700 dark:text-zinc-300" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.477 2 2 6.477 2 12c0 4.1 2.465 7.625 6 9.135V20c0-1.657 1.343-3 3-3h2c1.657 0 3 1.343 3 3v1.135c3.535-1.51 6-5.035 6-9.135 0-5.523-4.477-10-10-10zm2 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
    },
    {
      name: "iOS App",
      description: "Sign contracts, highlight passages, and draw cursive signatures right from your iPhone or iPad with fluid touch response.",
      badge: "Mobile",
      actionText: "Download on App Store",
      downloadUrl: "#",
      requirements: "Requires iOS 15.0 or later",
      icon: (
        <svg className="w-8 h-8 text-zinc-900 dark:text-white" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 4.17c.66-.81 1.11-1.93.99-3.06-1 .04-2.15.67-2.87 1.51-.62.71-1.16 1.86-1.01 2.98 1.1.09 2.23-.62 2.89-1.43z" />
        </svg>
      ),
    },
    {
      name: "Android App",
      description: "Fill forms and convert word documents to PDF on the go. Synchronized in real-time with your desktop workspace history.",
      badge: "Mobile",
      actionText: "Get it on Google Play",
      downloadUrl: "#",
      requirements: "Requires Android 8.0+",
      icon: (
        <svg className="w-8 h-8 text-emerald-500" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.523 15.3c-.15 0-.295-.03-.435-.09a1.052 1.052 0 01-.635-.97c0-.58.47-1.05 1.05-1.05.58 0 1.05.47 1.05 1.05 0 .58-.47 1.06-1.05 1.06zm-11.046 0a1.056 1.056 0 01-1.05-1.06c0-.58.47-1.05 1.05-1.05.58 0 1.05.47 1.05 1.05 0 .58-.47 1.06-1.05 1.06zm11.27-5.46l1.9-3.3a.478.478 0 00-.175-.655.485.485 0 00-.655.175l-1.92 3.33a11.137 11.137 0 00-4.947-1.12c-1.8 0-3.48.42-4.947 1.12l-1.92-3.33a.488.488 0 00-.655-.175.478.478 0 00-.175.655l1.9 3.3C3.083 11.83 1.2 14.7 1.2 18h21.6c0-3.3-1.883-6.17-5.01-8.16z" />
        </svg>
      ),
    },
  ];

  return (
    <section id="download-apps" className="py-24 px-6 border-t border-zinc-200 dark:border-zinc-900 bg-zinc-50/50 dark:bg-zinc-950/20 relative">
      {/* Background blobs */}
      <div className="absolute top-0 right-1/4 w-[400px] h-[400px] bg-indigo-500/5 dark:bg-indigo-650/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 left-10 w-[300px] h-[300px] bg-violet-500/5 dark:bg-violet-650/5 rounded-full blur-[80px] pointer-events-none" />

      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="text-center max-w-xl mx-auto mb-16">
          <h2 className="text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
            Take QT PDF Editor anywhere
          </h2>
          <p className="mt-4 text-sm text-zinc-550 dark:text-zinc-400 leading-relaxed">
            Download our native desktop and mobile applications. Stay connected, work offline, and boost your PDF productivity on all major platforms.
          </p>
        </div>

        {/* Platform Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {platforms.map((p, idx) => (
            <div
              key={idx}
              className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-900 bg-white/60 dark:bg-zinc-950/40 hover:border-indigo-300 dark:hover:border-indigo-750 hover:shadow-xl hover:shadow-indigo-500/5 transition-all duration-300 flex flex-col justify-between group"
            >
              <div>
                {/* Icon & Badge header */}
                <div className="flex items-center justify-between mb-5">
                  <div className="p-3.5 rounded-xl bg-zinc-100 dark:bg-zinc-900 group-hover:scale-105 transition-transform duration-350 shrink-0">
                    {p.icon}
                  </div>
                  {p.badge && (
                    <span className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/60 text-indigo-650 dark:text-indigo-400 rounded-lg">
                      {p.badge}
                    </span>
                  )}
                </div>

                {/* Details */}
                <h3 className="text-base font-bold text-zinc-900 dark:text-white mb-2">
                  {p.name}
                </h3>
                <p className="text-xs text-zinc-550 dark:text-zinc-400 leading-normal mb-5">
                  {p.description}
                </p>
              </div>

              <div>
                {/* Requirements info */}
                <div className="text-[10px] font-bold text-zinc-400 mb-3">
                  {p.requirements}
                </div>

                {/* Download Button */}
                <a
                  href={p.downloadUrl}
                  className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md shadow-indigo-600/10 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  {p.actionText}
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
