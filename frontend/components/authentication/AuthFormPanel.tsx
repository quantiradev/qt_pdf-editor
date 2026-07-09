"use client";

import { useRouter } from "next/navigation";
import AuthCard from "./AuthCard";

interface AuthFormPanelProps {
  onAuthSuccess: (email: string) => void;
  showToast: (message: string, type: "success" | "error" | "info") => void;
}

export default function AuthFormPanel({ onAuthSuccess, showToast }: AuthFormPanelProps) {
  const router = useRouter();

  return (
    <div className="w-full lg:w-1/2 flex flex-col justify-center items-center px-6 py-12 relative overflow-hidden bg-zinc-50 dark:bg-zinc-950">
      {/* Subtle decorative background lights for mobile/tablet */}
      <div className="lg:hidden absolute top-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500/5 blur-[80px]" />
      <div className="lg:hidden absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-violet-500/5 blur-[80px]" />

      {/* Back to Home Link (Top Right) */}
      <button
        onClick={() => router.push("/")}
        className="absolute top-6 right-6 flex items-center gap-1.5 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors text-xs font-semibold tracking-wide py-1.5 px-3 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900 border border-zinc-100 dark:border-zinc-900 cursor-pointer"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Back to Home
      </button>

      <AuthCard onSuccess={onAuthSuccess} showToast={showToast} />
    </div>
  );
}
