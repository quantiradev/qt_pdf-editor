"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Header from "../../components/landing/Header";
import Footer from "../../components/landing/Footer";
import Toast from "../../components/Toast";

type TabType = "profile" | "security" | "developer" | "billing";

interface SessionInfo {
  email: string;
  name: string;
  avatarColor?: string;
}

export default function ProfilePage() {
  const router = useRouter();
  
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");
  const [displayName, setDisplayName] = useState("");
  
  // Custom interactive settings state
  const [activeTab, setActiveTab] = useState<TabType>("profile");
  const [avatarColor, setAvatarColor] = useState("bg-indigo-600");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  // Profile preferences
  const [prefEmailAlerts, setPrefEmailAlerts] = useState(true);
  const [prefWeeklySummary, setPrefWeeklySummary] = useState(false);
  const [prefProductUpdates, setPrefProductUpdates] = useState(true);

  // Security preferences
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [enable2FA, setEnable2FA] = useState(false);

  // Developer preferences
  const [apiKey, setApiKey] = useState("qt_live_51Msz8W93KdlQpL67vNzY41");
  const [showApiKey, setShowApiKey] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("https://api.yourdomain.com/pdf-webhook");

  // Mock avatar colors list
  const avatarColors = [
    { name: "Indigo", class: "bg-indigo-600" },
    { name: "Emerald", class: "bg-emerald-600" },
    { name: "Amber", class: "bg-amber-500" },
    { name: "Violet", class: "bg-violet-600" },
    { name: "Rose", class: "bg-rose-500" },
  ];

  useEffect(() => {
    // Session check in localStorage
    const sessionStr = localStorage.getItem("qt_user_session");
    if (!sessionStr) {
      router.push("/auth");
      return;
    }
    try {
      const session = JSON.parse(sessionStr) as SessionInfo;
      setIsLoggedIn(true);
      setUserEmail(session.email || "");
      setUserName(session.name || "");
      setDisplayName(session.name || "");
      if (session.avatarColor) {
        setAvatarColor(session.avatarColor);
      }
    } catch (e) {
      router.push("/auth");
    }
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("qt_user_session");
    localStorage.removeItem("uploaded_pdf_name");
    setIsLoggedIn(false);
    setUserEmail("");
    setUserName("");
    router.push("/");
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      setToast({ message: "Display name cannot be empty", type: "error" });
      return;
    }

    const sessionStr = localStorage.getItem("qt_user_session");
    if (sessionStr) {
      try {
        const session = JSON.parse(sessionStr) as SessionInfo;
        session.name = displayName.trim();
        session.avatarColor = avatarColor;
        localStorage.setItem("qt_user_session", JSON.stringify(session));
        setUserName(session.name);
        setToast({ message: "Profile settings updated successfully!", type: "success" });
      } catch (err) {
        setToast({ message: "Failed to save settings", type: "error" });
      }
    }
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      setToast({ message: "All password fields are required", type: "error" });
      return;
    }
    if (newPassword !== confirmPassword) {
      setToast({ message: "Passwords do not match", type: "error" });
      return;
    }
    setToast({ message: "Password updated successfully!", type: "success" });
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  const handleGenerateKey = () => {
    const randomHex = Array.from({ length: 24 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
    setApiKey(`qt_live_${randomHex}`);
    setToast({ message: "New API key generated successfully!", type: "success" });
  };

  const handleCopyKey = () => {
    navigator.clipboard.writeText(apiKey);
    setToast({ message: "API key copied to clipboard", type: "success" });
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 dark:bg-zinc-955 text-zinc-900 dark:text-zinc-50 transition-colors duration-300 font-sans relative overflow-x-hidden">
      {/* Background Decorative Blobs */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-indigo-500/5 dark:bg-indigo-600/5 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-[30%] right-10 w-[500px] h-[500px] bg-violet-500/5 dark:bg-violet-600/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Navigation Header */}
      <Header
        isLoggedIn={true}
        onLogout={handleLogout}
        userEmail={userEmail}
        userName={userName}
      />

      {/* Profile Settings Center */}
      <main className="flex-1 pt-32 pb-16 px-6 max-w-6xl mx-auto w-full relative z-10">
        
        {/* Clickable Breadcrumbs Navigation */}
        <nav className="flex items-center gap-2 text-xs font-bold text-zinc-400 mb-8 select-none">
          <Link href="/" className="hover:text-indigo-600 transition-colors cursor-pointer">
            Home
          </Link>
          <span className="text-zinc-300 dark:text-zinc-800">/</span>
          <span className="text-zinc-400">Account</span>
          <span className="text-zinc-300 dark:text-zinc-800">/</span>
          <span className="text-zinc-700 dark:text-zinc-250">Profile Settings</span>
        </nav>

        <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-white mb-10">
          Account Workspace Settings
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column: Tab list menu */}
          <aside className="lg:col-span-3 space-y-1.5">
            {[
              { id: "profile", name: "Profile & Preferences", icon: (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                </svg>
              )},
              { id: "security", name: "Security & Sessions", icon: (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
                </svg>
              )},
              { id: "developer", name: "Developer API Keys", icon: (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z" />
                </svg>
              )},
              { id: "billing", name: "Billing & Limits", icon: (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M21 18v1c0 1.1-.9 2-2 2H5c-1.11 0-2-.9-2-2V5c0-1.1.89-2 2-2h14c1.1 0 2 .9 2 2v1h-9c-1.11 0-2 .9-2 2v8c0 1.1.89 2 2 2h9zm-9-2h10V8H12v8zm4-2.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
                </svg>
              )},
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`w-full flex items-center gap-3 px-4.5 py-3 rounded-xl text-sm font-bold transition-all text-left cursor-pointer ${
                  activeTab === tab.id
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-650/10"
                    : "text-zinc-550 dark:text-zinc-400 hover:bg-zinc-150 dark:hover:bg-zinc-900/50 hover:text-zinc-900 dark:hover:text-white"
                }`}
              >
                {tab.icon}
                {tab.name}
              </button>
            ))}
          </aside>

          {/* Right Column: Tab View panel */}
          <section className="lg:col-span-9 p-6 sm:p-8 rounded-3xl border border-zinc-200 dark:border-zinc-900 bg-white/40 dark:bg-zinc-900/10 backdrop-blur-md shadow-xl min-h-[480px]">
            
            {/* Tab: Profile Info */}
            {activeTab === "profile" && (
              <div className="space-y-8">
                <div>
                  <h2 className="text-lg font-black text-zinc-900 dark:text-white mb-1">
                    Profile & Preferences
                  </h2>
                  <p className="text-xs text-zinc-500">
                    Manage your personal details, profile picture styling, and email report cycles.
                  </p>
                </div>

                <form onSubmit={handleSaveProfile} className="space-y-6">
                  {/* Interactive Avatar Picker */}
                  <div className="space-y-3">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">
                      Choose Avatar Accent
                    </label>
                    <div className="flex items-center gap-5">
                      {/* Avatar Circle Preview */}
                      <div className={`w-16 h-16 rounded-full flex items-center justify-center text-white font-extrabold text-2xl uppercase transition-colors shadow-inner select-none ${avatarColor}`}>
                        {displayName ? displayName.charAt(0) : userEmail.charAt(0)}
                      </div>

                      {/* Color selectors */}
                      <div className="flex gap-2">
                        {avatarColors.map((color) => (
                          <button
                            key={color.name}
                            type="button"
                            onClick={() => setAvatarColor(color.class)}
                            className={`w-7 h-7 rounded-full transition-transform cursor-pointer border-2 ${color.class} ${
                              avatarColor === color.class ? "scale-115 ring-2 ring-indigo-500/20 border-white dark:border-zinc-900" : "border-transparent hover:scale-105"
                            }`}
                            title={color.name}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Name input */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">
                        Display Name
                      </label>
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Enter display name"
                        className="w-full px-4 py-3 rounded-xl border border-zinc-300 dark:border-zinc-800 bg-white/50 dark:bg-zinc-950/50 text-sm font-semibold text-zinc-900 dark:text-white focus:outline-none focus:border-indigo-500 transition-colors"
                      />
                    </div>

                    {/* Email output */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">
                        Email Address (Read-only)
                      </label>
                      <input
                        type="email"
                        value={userEmail}
                        disabled
                        className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-900 bg-zinc-150/40 dark:bg-zinc-900/40 text-sm font-semibold text-zinc-400 select-none cursor-not-allowed"
                      />
                    </div>
                  </div>

                  <div className="h-px bg-zinc-200/50 dark:bg-zinc-800/50 my-6" />

                  {/* Notification Toggle Checklist */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
                      Email Preferences
                    </h3>
                    <div className="space-y-3">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={prefEmailAlerts}
                          onChange={(e) => setPrefEmailAlerts(e.target.checked)}
                          className="w-4 h-4 text-indigo-600 border-zinc-300 rounded focus:ring-indigo-500 cursor-pointer"
                        />
                        <div className="text-xs font-semibold text-zinc-650 dark:text-zinc-300">
                          Notify me via email when my batch PDF processing tasks are finished
                        </div>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={prefWeeklySummary}
                          onChange={(e) => setPrefWeeklySummary(e.target.checked)}
                          className="w-4 h-4 text-indigo-600 border-zinc-300 rounded focus:ring-indigo-500 cursor-pointer"
                        />
                        <div className="text-xs font-semibold text-zinc-650 dark:text-zinc-300">
                          Send a weekly summary report of my document modifications
                        </div>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={prefProductUpdates}
                          onChange={(e) => setPrefProductUpdates(e.target.checked)}
                          className="w-4 h-4 text-indigo-600 border-zinc-300 rounded focus:ring-indigo-500 cursor-pointer"
                        />
                        <div className="text-xs font-semibold text-zinc-650 dark:text-zinc-300">
                          Receive notifications about new AI summarization and contract auditing tools
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Submit profile */}
                  <div className="pt-4">
                    <button
                      type="submit"
                      className="px-5 py-3 text-sm font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md shadow-indigo-650/10 cursor-pointer"
                    >
                      Save Profile Changes
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Tab: Security Settings */}
            {activeTab === "security" && (
              <div className="space-y-8">
                <div>
                  <h2 className="text-lg font-black text-zinc-900 dark:text-white mb-1">
                    Security & Active Sessions
                  </h2>
                  <p className="text-xs text-zinc-500">
                    Update passwords, configure login multi-factor controls, and inspect connected devices.
                  </p>
                </div>

                {/* Password Form */}
                <form onSubmit={handleChangePassword} className="space-y-4">
                  <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200">Change Password</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Current password"
                      className="px-4 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-800 bg-white/50 dark:bg-zinc-950/50 text-xs font-semibold focus:outline-none focus:border-indigo-500"
                    />
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="New password"
                      className="px-4 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-800 bg-white/50 dark:bg-zinc-955/50 text-xs font-semibold focus:outline-none focus:border-indigo-500"
                    />
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                      className="px-4 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-800 bg-white/50 dark:bg-zinc-955/50 text-xs font-semibold focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-4.5 py-2 text-xs font-bold rounded-lg bg-zinc-900 hover:bg-zinc-850 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-white transition-colors cursor-pointer"
                  >
                    Change Password
                  </button>
                </form>

                <div className="h-px bg-zinc-200/50 dark:bg-zinc-800/50 my-6" />

                {/* Two-Factor Authentication Mock Switch */}
                <div className="flex items-center justify-between p-4.5 rounded-2xl border border-zinc-200/60 dark:border-zinc-850 bg-zinc-50/50 dark:bg-zinc-950/30">
                  <div>
                    <h4 className="text-sm font-bold text-zinc-900 dark:text-white">
                      Two-Factor Authentication (2FA)
                    </h4>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                      Secure login validations via Google Authenticator or SMS message alerts.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEnable2FA(!enable2FA)}
                    className={`w-11 h-6 rounded-full transition-colors relative focus:outline-none cursor-pointer ${
                      enable2FA ? "bg-indigo-650" : "bg-zinc-300 dark:bg-zinc-800"
                    }`}
                  >
                    <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                      enable2FA ? "translate-x-5" : ""
                    }`} />
                  </button>
                </div>

                {/* Sessions Table */}
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-zinc-850 dark:text-zinc-200">Active Account Sessions</h3>
                  <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-850">
                    <table className="w-full text-left text-xs font-semibold">
                      <thead className="bg-zinc-100 dark:bg-zinc-900/50 text-zinc-400 uppercase text-[10px] font-bold">
                        <tr>
                          <th className="p-3">Device / Browser</th>
                          <th className="p-3">Location</th>
                          <th className="p-3">IP Address</th>
                          <th className="p-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200 dark:divide-zinc-850 text-zinc-700 dark:text-zinc-300">
                        <tr>
                          <td className="p-3 font-bold text-zinc-900 dark:text-white">Chrome on Windows (11)</td>
                          <td className="p-3">Bangalore, India</td>
                          <td className="p-3">192.168.1.1</td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded-full bg-green-500/10 text-green-600 text-[10px] font-extrabold">Active Now</span>
                          </td>
                        </tr>
                        <tr>
                          <td className="p-3">Safari on iPhone (iOS)</td>
                          <td className="p-3">Bangalore, India</td>
                          <td className="p-3">192.168.1.45</td>
                          <td className="p-3 text-zinc-400">2 hours ago</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Tab: Developer Portal */}
            {activeTab === "developer" && (
              <div className="space-y-8">
                <div>
                  <h2 className="text-lg font-black text-zinc-900 dark:text-white mb-1">
                    Developer API Configurations
                  </h2>
                  <p className="text-xs text-zinc-500">
                    Access private keys and hook channels to integrate QT PDF parsing into automated CLI scripts.
                  </p>
                </div>

                {/* API Key box */}
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200">Developer API Key</h3>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 flex items-center justify-between px-4 py-3 rounded-xl border border-zinc-300 dark:border-zinc-800 bg-white/50 dark:bg-zinc-950/50 text-xs font-mono font-bold select-all overflow-x-auto">
                      <span>{showApiKey ? apiKey : "••••••••••••••••••••••••••••••••••••••••"}</span>
                      <button
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="text-[10px] font-extrabold uppercase text-zinc-400 hover:text-zinc-700 dark:hover:text-white ml-2 transition-colors cursor-pointer select-none"
                      >
                        {showApiKey ? "Hide" : "Show"}
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyKey}
                      className="px-4 py-3 rounded-xl bg-zinc-900 hover:bg-zinc-850 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-white text-xs font-bold transition-all cursor-pointer"
                    >
                      Copy
                    </button>
                    <button
                      type="button"
                      onClick={handleGenerateKey}
                      className="px-4 py-3 rounded-xl border border-zinc-250 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 text-xs font-bold transition-all cursor-pointer text-zinc-650 dark:text-zinc-300"
                    >
                      Roll Key
                    </button>
                  </div>
                </div>

                <div className="h-px bg-zinc-200/50 dark:bg-zinc-800/50 my-6" />

                {/* Webhooks configuration */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200">Processing Webhook</h3>
                  <p className="text-xs text-zinc-500 max-w-xl">
                    Configure a REST URL to receive obligations summaries JSON payload asynchronously whenever files finish processing.
                  </p>
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={webhookUrl}
                      onChange={(e) => setWebhookUrl(e.target.value)}
                      placeholder="https://api.yourdomain.com/webhook"
                      className="w-full px-4 py-3 rounded-xl border border-zinc-300 dark:border-zinc-800 bg-white/50 dark:bg-zinc-950/50 text-xs font-semibold focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => setToast({ message: "Webhook URL saved successfully!", type: "success" })}
                      className="px-4.5 py-2 text-xs font-bold rounded-lg bg-indigo-650 hover:bg-indigo-600 text-white transition-colors cursor-pointer"
                    >
                      Save Webhook
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Tab: Billing & Usage */}
            {activeTab === "billing" && (
              <div className="space-y-8">
                <div>
                  <h2 className="text-lg font-black text-zinc-900 dark:text-white mb-1">
                    Billing & Limits
                  </h2>
                  <p className="text-xs text-zinc-550">
                    Monitor workspace limits, monthly storage targets, and invoices.
                  </p>
                </div>

                {/* Current plan card */}
                <div className="p-5 rounded-2xl border border-indigo-200/50 dark:border-indigo-900/30 bg-indigo-50/10 dark:bg-indigo-950/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">
                      Professional Pro Plan
                    </h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                      Billing monthly: $15.00/mo. Next renewal invoice on **August 8, 2026**.
                    </p>
                  </div>
                  <button
                    onClick={() => alert("Billing management is coming soon.")}
                    className="px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-500 rounded-lg text-xs font-bold transition-colors cursor-pointer select-none shrink-0"
                  >
                    Manage Subscription
                  </button>
                </div>

                {/* Usage Limits Progress Bars */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-zinc-850 dark:text-zinc-200">Workspace Monthly Consumption</h3>
                  
                  {/* Edits: Unlimited */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-zinc-500 dark:text-zinc-400">PDF Document Edits</span>
                      <span className="text-zinc-900 dark:text-white">45 / Unlimited</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full w-full" />
                    </div>
                  </div>

                  {/* AI Tokens: 23% */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-zinc-500 dark:text-zinc-400">AI Obligation Queries</span>
                      <span className="text-zinc-900 dark:text-white">2,345 / 10,000 tokens</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                      <div className="h-full bg-indigo-600 rounded-full w-[23.4%]" />
                    </div>
                  </div>

                  {/* Storage: 12% */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-zinc-500 dark:text-zinc-400">Cloud Storage Capacity</span>
                      <span className="text-zinc-900 dark:text-white">1.2 GB / 10 GB</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                      <div className="h-full bg-violet-600 rounded-full w-[12%]" />
                    </div>
                  </div>
                </div>

                {/* Invoices List */}
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-zinc-850 dark:text-zinc-200">Invoice History</h3>
                  <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-850">
                    <table className="w-full text-left text-xs font-semibold">
                      <thead className="bg-zinc-100 dark:bg-zinc-900/50 text-zinc-400 uppercase text-[10px] font-bold">
                        <tr>
                          <th className="p-3">Invoice Number</th>
                          <th className="p-3">Billing Date</th>
                          <th className="p-3">Amount Paid</th>
                          <th className="p-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200 dark:divide-zinc-850 text-zinc-700 dark:text-zinc-300">
                        <tr>
                          <td className="p-3 font-bold text-zinc-900 dark:text-white">INV-00932</td>
                          <td className="p-3">July 8, 2026</td>
                          <td className="p-3">$15.00 USD</td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded-full bg-green-500/10 text-green-600 text-[10px] font-extrabold">Paid</span>
                          </td>
                        </tr>
                        <tr>
                          <td className="p-3 font-bold text-zinc-900 dark:text-white">INV-00814</td>
                          <td className="p-3">June 8, 2026</td>
                          <td className="p-3">$15.00 USD</td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded-full bg-green-500/10 text-green-600 text-[10px] font-extrabold">Paid</span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
