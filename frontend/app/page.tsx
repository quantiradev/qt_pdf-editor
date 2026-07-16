"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

// Subcomponents modularized under components/landing/
import Header from "../components/landing/Header";
import Hero from "../components/landing/Hero";
import DashboardHero from "../components/landing/DashboardHero";
import ToolsGrid from "../components/landing/ToolsGrid";
import AIAssistantPreview from "../components/landing/AIAssistantPreview";
import SecurityBanner from "../components/landing/SecurityBanner";
import DownloadApp from "../components/landing/DownloadApp";
import Pricing from "../components/landing/Pricing";
import Faq from "../components/landing/Faq";
import Footer from "../components/landing/Footer";

export default function Home() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");
  
  const [activeFilter, setActiveFilter] = useState<"all" | "edit" | "convert" | "sign" | "ai">("all");
  const [isDragging, setIsDragging] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; kind: "success" | "info" | "error" } | null>(null);

  const showToast = (msg: string, kind: "success" | "info" | "error" = "info") => {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 4500);
  };


  useEffect(() => {
    // Check session in localStorage
    const sessionStr = localStorage.getItem("qt_user_session");
    if (sessionStr) {
      try {
        const session = JSON.parse(sessionStr);
        setIsLoggedIn(true);
        setUserEmail(session.email || "");
        setUserName(session.name || "");
      } catch {
        setIsLoggedIn(true);
      }
    }
  }, []);

  useEffect(() => {
    // Check if there is a category query param to auto-scroll to the tools section
    const params = new URLSearchParams(window.location.search);
    const cat = params.get("category");
    if (cat && ["edit", "convert", "sign", "ai"].includes(cat)) {
      setActiveFilter(cat as any);
      setTimeout(() => {
        const element = document.getElementById("tools");
        if (element) {
          element.scrollIntoView({ behavior: "smooth" });
        }
      }, 300);
    }
  }, []);

  const handleToolClick = (category: "edit" | "convert" | "sign" | "ai") => {
    setActiveFilter(category);
    const element = document.getElementById("tools");
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("qt_user_session");
    setIsLoggedIn(false);
    setUserName("");
    setUserEmail("");
    router.push("/");
  };

  /** Upload PDF to the Python backend, then open the editor */
  const uploadAndEdit = useCallback(async (file: File) => {
    if (!file || file.type !== "application/pdf") {
      setUploadError("Please select a valid PDF file.");
      return;
    }
    setIsUploading(true);
    setUploadError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${API_URL}/api/files/upload`, {
  method: "POST",
  body: fd,
});
      if (!res.ok) {
        let msg = `Upload failed (${res.status})`;
        try { const j = await res.json(); if (j?.detail) msg = j.detail; } catch {}
        throw new Error(msg);
      }
      const meta = await res.json();
      router.push(`/preview/${meta.id}`);
    } catch (err: any) {
      setUploadError(err.message || "Upload failed");
      setIsUploading(false);
    }
  }, [router]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadAndEdit(file);
    e.target.value = "";
  };

  const triggerFileSelect = (e: React.MouseEvent) => {
    fileInputRef.current?.click();
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadAndEdit(file);
  };

  const handleAction = () => {
    fileInputRef.current?.click();
  };


  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 transition-colors duration-300 font-sans relative overflow-x-hidden">
      {/* Background Decorative Blobs */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-indigo-500/5 dark:bg-indigo-600/5 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-[30%] right-10 w-[500px] h-[500px] bg-violet-500/5 dark:bg-violet-600/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Upload progress overlay */}
      {isUploading && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex flex-col items-center justify-center gap-4">
          <div className="w-14 h-14 border-4 border-indigo-400/30 border-t-indigo-500 rounded-full animate-spin" />
          <p className="text-white font-semibold text-lg">Uploading PDF…</p>
          <p className="text-white/60 text-sm">Opening editor in a moment</p>
        </div>
      )}

      {/* Upload error banner */}
      {uploadError && !isUploading && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 shadow-xl">
          <svg className="w-4 h-4 flex-none" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
          <span className="text-sm font-semibold">{uploadError}</span>
          <button onClick={() => setUploadError(null)} className="ml-2 text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-xl border text-sm font-semibold transition-all ${
          toast.kind === "success"
            ? "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300"
            : toast.kind === "error"
              ? "bg-red-50 dark:bg-red-950/60 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300"
              : "bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300"
        }`}>
          <span>{toast.msg}</span>
          <button onClick={() => setToast(null)} className="ml-2 hover:opacity-75">✕</button>
        </div>
      )}

      {isLoggedIn ? (
        /* Authenticated User Layout (Dashboard Mode) */
        <>
          <Header
            isLoggedIn={true}
            onLogout={handleLogout}
            userEmail={userEmail}
            userName={userName}
            onToolClick={handleToolClick}
          />
          
          <DashboardHero
            userName={userName}
            userEmail={userEmail}
            isDragging={isDragging}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            fileInputRef={fileInputRef}
            onFileChange={handleFileChange}
            onTriggerFileSelect={triggerFileSelect}
          />

          <ToolsGrid
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
            onAction={handleAction}
          />

          <SecurityBanner />
          
          <Footer />
        </>
      ) : (
        /* Unauthenticated Guest Layout (Marketing Landing Mode) */
        <>
          <Header isLoggedIn={false} onToolClick={handleToolClick} />

          <Hero
            isDragging={isDragging}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            fileInputRef={fileInputRef}
            onFileChange={handleFileChange}
            onTriggerFileSelect={triggerFileSelect}
          />

          <DownloadApp />

          <ToolsGrid
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
            onAction={handleAction}
          />

          <AIAssistantPreview onAction={() => {
            showToast("Subscribe to a plan to unlock premium AI Summarizer features!", "info");
            document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" });
          }} />

          <SecurityBanner />

          <Pricing onAction={handleAction} />

          <Faq openFaq={openFaq} onFaqToggle={setOpenFaq} />

          <Footer />
        </>
      )}
    </div>
  );
}

