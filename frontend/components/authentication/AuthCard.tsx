"use client";

import React, { useState, useEffect } from "react";

const AUTH_API_URL = process.env.NEXT_PUBLIC_AUTH_API_URL ?? "";

interface AuthCardProps {
  onSuccess: (email: string) => void;
  showToast: (message: string, type: "success" | "error" | "info") => void;
}

export default function AuthCard({ onSuccess, showToast }: AuthCardProps) {
  const [activeTab, setActiveTab] = useState<"login" | "register">("login");
  const [loading, setLoading] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);

  // Form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(false);

  // Password strength state
  const [passwordStrength, setPasswordStrength] = useState<{
    score: number;
    label: string;
    color: string;
  }>({ score: 0, label: "Empty", color: "bg-zinc-200 dark:bg-zinc-800" });

  // Update password strength
  useEffect(() => {
    if (!password) {
      setPasswordStrength({ score: 0, label: "Empty", color: "bg-zinc-200 dark:bg-zinc-800" });
      return;
    }

    let score = 0;
    if (password.length >= 6) score += 1;
    if (password.length >= 10) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;

    let label = "Weak";
    let color = "bg-rose-500";

    if (score >= 4) {
      label = "Strong";
      color = "bg-emerald-500";
    } else if (score >= 2) {
      label = "Medium";
      color = "bg-amber-500";
    }

    setPasswordStrength({ score, label, color });
  }, [password]);

  // Reset password state when tab changes
  useEffect(() => {
    setEmail("");
    setPassword("");
    setName("");
    setConfirmPassword("");
    setAgreeTerms(false);
  }, [activeTab]);



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      showToast("Please enter your email", "error");
      return;
    }

    // Basic email validation regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      showToast("Please enter a valid email address", "error");
      return;
    }

    if (!password) {
      showToast("Please enter your password", "error");
      return;
    }

    if (activeTab === "register") {
      if (!name.trim()) {
        showToast("Please enter your name", "error");
        return;
      }
      if (password.length < 6) {
        showToast("Password must be at least 6 characters long", "error");
        return;
      }
      if (password !== confirmPassword) {
        showToast("Passwords do not match", "error");
        return;
      }
      if (!agreeTerms) {
        showToast("You must agree to the Terms of Service", "error");
        return;
      }
    }

    setLoading(true);

    try {
      const endpoint =
  activeTab === "login"
    ? `${AUTH_API_URL}/api/auth/login`
    : `${AUTH_API_URL}/api/auth/register`;
      const body = activeTab === "login"
        ? { email, password }
        : { name, email, password };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Authentication failed");
      }

      // Mock successful login
      localStorage.setItem("qt_user_session", JSON.stringify({ email: data.user.email, name: data.user.name, loggedIn: true }));
      
      if (activeTab === "login") {
        showToast("Welcome back to QT PDF Editor!", "success");
      } else {
        showToast("Account created successfully! Welcome onboard.", "success");
      }
      onSuccess(data.user.email);
    } catch (err: any) {
      showToast(err.message || "An error occurred during authentication", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md p-8 glass-panel rounded-3xl shadow-2xl transition-all duration-500 hover:shadow-indigo-500/10">
      {/* Brand Header */}
      <div className="flex flex-col items-center mb-8">
        <div className="w-12 h-12 bg-gradient-to-tr from-indigo-600 to-violet-500 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20 mb-4 animate-float">
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
          {activeTab === "login" ? "Welcome back" : "Create an account"}
        </h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          {activeTab === "login"
            ? "Enter your credentials to access your workspace"
            : "Get started with your free 14-day trial"}
        </p>
      </div>

      {/* Tabs */}
      <div className="relative flex p-1 bg-zinc-100 dark:bg-zinc-900/80 rounded-xl mb-6">
        <div
          className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white dark:bg-zinc-800 rounded-lg shadow-sm transition-all duration-300 ease-out ${
            activeTab === "register" ? "translate-x-[100%]" : "translate-x-0"
          }`}
        />
        <button
          onClick={() => setActiveTab("login")}
          className={`relative z-10 w-1/2 py-2 text-sm font-semibold rounded-lg transition-colors duration-200 ${
            activeTab === "login"
              ? "text-zinc-900 dark:text-white"
              : "text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          }`}
        >
          Sign In
        </button>
        <button
          onClick={() => setActiveTab("register")}
          className={`relative z-10 w-1/2 py-2 text-sm font-semibold rounded-lg transition-colors duration-200 ${
            activeTab === "register"
              ? "text-zinc-900 dark:text-white"
              : "text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          }`}
        >
          Sign Up
        </button>
      </div>

      {/* Authentication Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {activeTab === "register" && (
          <div className="space-y-1">
            <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
              Full Name
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-zinc-400 dark:text-zinc-500 pointer-events-none">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </span>
              <input
                type="text"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/40 dark:bg-zinc-950/20 text-sm placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:text-white transition-all"
              />
            </div>
          </div>
        )}

        <div className="space-y-1">
          <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
            Email Address
          </label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-zinc-400 dark:text-zinc-500 pointer-events-none">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </span>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/40 dark:bg-zinc-950/20 text-sm placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:text-white transition-all"
            />
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
              Password
            </label>
            {activeTab === "login" && (
              <button
                type="button"
                onClick={() => showToast("Password reset functionality is under development", "info")}
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 transition-colors cursor-pointer"
              >
                Forgot?
              </button>
            )}
          </div>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-zinc-400 dark:text-zinc-500 pointer-events-none">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </span>
            <input
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/40 dark:bg-zinc-950/20 text-sm placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:text-white transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
            >
              {showPassword ? (
                <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                </svg>
              ) : (
                <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          </div>

          {/* Password Strength Meter (Sign Up Only) */}
          {activeTab === "register" && password && (
            <div className="space-y-1.5 pt-1.5 animate-fadeIn">
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-500">Strength:</span>
                <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                  {passwordStrength.label}
                </span>
              </div>
              <div className="flex gap-1 h-1.5 rounded-full overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${passwordStrength.color}`}
                  style={{ width: `${(passwordStrength.score / 5) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {activeTab === "register" && (
          <div className="space-y-1">
            <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
              Confirm Password
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-zinc-400 dark:text-zinc-500 pointer-events-none">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </span>
              <input
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/40 dark:bg-zinc-950/20 text-sm placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:text-white transition-all"
              />
            </div>
          </div>
        )}

        {/* Checkbox Controls */}
        {activeTab === "login" ? (
          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                key="remember-device"
                type="checkbox"
                defaultChecked
                className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-800 text-indigo-600 focus:ring-indigo-500 bg-white/30 dark:bg-zinc-950/30"
              />
              <span className="text-xs text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-700 dark:group-hover:text-zinc-300 transition-colors">
                Remember this device
              </span>
            </label>
          </div>
        ) : (
          <div className="pt-1">
            <label className="flex items-start gap-2 cursor-pointer group">
              <input
                key="agree-terms"
                type="checkbox"
                checked={agreeTerms}
                onChange={(e) => setAgreeTerms(e.target.checked)}
                className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-800 text-indigo-600 focus:ring-indigo-500 bg-white/30 dark:bg-zinc-950/30 mt-0.5"
              />
              <span className="text-xs leading-normal text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-700 dark:group-hover:text-zinc-300 transition-colors">
                I agree to the{" "}
                <button
                  type="button"
                  onClick={() => showToast("Terms of Service is under construction", "info")}
                  className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
                >
                  Terms of Service
                </button>{" "}
                and{" "}
                <button
                  type="button"
                  onClick={() => showToast("Privacy Policy is under construction", "info")}
                  className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
                >
                  Privacy Policy
                </button>
              </span>
            </label>
          </div>
        )}

        {/* Action Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold py-3 rounded-xl shadow-lg shadow-indigo-600/10 hover:shadow-indigo-600/20 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-75 disabled:pointer-events-none mt-2"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>{activeTab === "login" ? "Signing In..." : "Creating Account..."}</span>
            </>
          ) : (
            <span>{activeTab === "login" ? "Sign In to Workspace" : "Get Started Now"}</span>
          )}
        </button>
      </form>
    </div>
  );
}
