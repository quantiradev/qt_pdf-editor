"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AuthVisualPanel from "../../components/authentication/AuthVisualPanel";
import AuthFormPanel from "../../components/authentication/AuthFormPanel";
import Toast from "../../components/Toast";

export default function AuthPage() {
  const router = useRouter();
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  const showToast = (message: string, type: "success" | "error" | "info") => {
    setToast({ message, type });
  };

  const handleAuthSuccess = (email: string) => {
    // Wait for the success toast to be read briefly, then redirect to the landing page
    setTimeout(() => {
      router.push("/");
    }, 1500);
  };

  return (
    <div className="min-h-screen w-full flex bg-zinc-50 dark:bg-zinc-950 transition-colors duration-300 font-sans">
      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Left Visual Panel */}
      <AuthVisualPanel />

      {/* Right Form Panel */}
      <AuthFormPanel onAuthSuccess={handleAuthSuccess} showToast={showToast} />
    </div>
  );
}
