"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

type TutorialStep = 1 | 2 | 3 | 4;

interface StepInfo {
  title: string;
  subtitle: string;
  description: string;
  tip: string;
}

export default function AuthVisualPanel() {
  const [step, setStep] = useState<TutorialStep>(2); // Default to Step 2 for high visual impact initially, or Step 1. Let's start at Step 1 as a standard wizard!
  const [activeStep, setActiveStep] = useState<TutorialStep>(1);

  // Step 1: Upload states
  const [uploadState, setUploadState] = useState<"idle" | "uploading" | "done">("idle");
  const [uploadProgress, setUploadProgress] = useState<number>(0);

  // Step 2: Highlight states
  const [highlightColor, setHighlightColor] = useState<string>("bg-yellow-300/40");

  // Step 3: Sign states
  const [hasSigned, setHasSigned] = useState<boolean>(false);

  // Step 4: AI scan states
  const [aiScanState, setAiScanState] = useState<"idle" | "scanning" | "done">("idle");
  const [aiProgress, setAiProgress] = useState<number>(0);

  // Text editor states (fallback backup)
  const [editedText, setEditedText] = useState<string>("MUTUAL NON-DISCLOSURE AGREEMENT");
  const [isEditing, setIsEditing] = useState<boolean>(false);

  // Dynamic content mapping for each tutorial step
  const stepDetails: Record<TutorialStep, StepInfo> = {
    1: {
      title: "Upload your Document",
      subtitle: "Step 1 of 4: Drag & Drop",
      description: "Import any PDF file directly from your local system or cloud storage. We support standard contract templates, financial statements, and receipts.",
      tip: "💡 Tip: You can drag files directly from your desktop into the upload panel to get started.",
    },
    2: {
      title: "Annotate & Markup",
      subtitle: "Step 2 of 4: Collaborative Comments",
      description: "Draw lines, leave custom text overlays, or highlight critical legal clauses using our high-contrast digital markers.",
      tip: "💡 Tip: Click on any of the color dots below to change your highlighter marker color.",
    },
    3: {
      title: "Legally Binding Signatures",
      subtitle: "Step 3 of 4: Electronic Signing",
      description: "Draw or script your official digital signature and stamp it onto the PDF sign-off sheets with standard AES encryption verification.",
      tip: "💡 Tip: Click 'Stamp Signature' to execute the script and finalize the counterparty lines.",
    },
    4: {
      title: "AI Compliance Scan",
      subtitle: "Step 4 of 4: Document Audit",
      description: "Let our AI assistant process your contracts. Automatically outline deliverables, detect governing jurisdictions, and flag liability risks.",
      tip: "💡 Tip: Click 'Run Compliance Scan' to start a complete deep-learning analysis of the PDF text.",
    },
  };

  // Run a simulated upload progress
  useEffect(() => {
    if (uploadState === "uploading") {
      setUploadProgress(0);
      const interval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval);
            setUploadState("done");
            return 100;
          }
          return prev + 20;
        });
      }, 100);
      return () => clearInterval(interval);
    }
  }, [uploadState]);

  // Run a simulated scan animation when AI mode scans
  useEffect(() => {
    if (aiScanState === "scanning") {
      setAiProgress(0);
      const interval = setInterval(() => {
        setAiProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval);
            setAiScanState("done");
            return 100;
          }
          return prev + 10;
        });
      }, 150);
      return () => clearInterval(interval);
    }
  }, [aiScanState]);

  const details = stepDetails[activeStep];

  const handleNextStep = () => {
    if (activeStep < 4) {
      setActiveStep((activeStep + 1) as TutorialStep);
    }
  };

  const handlePrevStep = () => {
    if (activeStep > 1) {
      setActiveStep((activeStep - 1) as TutorialStep);
    }
  };

  return (
    <div className="hidden lg:flex lg:w-1/2 relative bg-white dark:bg-zinc-950 overflow-hidden select-none border-r border-zinc-200 dark:border-zinc-900 flex-col justify-between p-16">
      {/* Animated Orbiting Radial Glows */}
      <div className="absolute top-[-25%] left-[-20%] w-[90%] h-[90%] rounded-full bg-indigo-500/5 dark:bg-indigo-650/15 blur-[120px] animate-pulse-slow" />
      <div 
        className="absolute bottom-[-15%] right-[-10%] w-[70%] h-[70%] rounded-full bg-violet-500/5 dark:bg-violet-600/10 blur-[100px] animate-pulse-slow" 
        style={{ animationDelay: "3s" }} 
      />

      {/* Grid Pattern Overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808007_1px,transparent_1px),linear-gradient(to_bottom,#80808007_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_80%,transparent_100%)]" />

      {/* Top Header: Branding & Tutorial Wizard Progress bar */}
      <div className="relative z-10 flex flex-col gap-6">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 bg-gradient-to-tr from-indigo-600 to-violet-500 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform duration-300">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <span className="text-xl font-extrabold tracking-tight text-zinc-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
            QT PDF Editor
          </span>
        </Link>

        {/* Step progress timeline (slim segmented bars) */}
        <div className="flex gap-2 w-full mt-2 select-none relative z-10">
          {[1, 2, 3, 4].map((s) => (
            <button
              key={s}
              onClick={() => setActiveStep(s as TutorialStep)}
              className="flex-1 h-1 rounded-full relative cursor-pointer group"
              title={`Step ${s}`}
            >
              <div 
                className={`h-full w-full rounded-full transition-all duration-300 ${
                  activeStep === s
                    ? "bg-indigo-650"
                    : activeStep > s
                    ? "bg-emerald-500"
                    : "bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700"
                }`}
              />
            </button>
          ))}
        </div>
      </div>

      {/* Middle Section: Clean PDF Sheet Mockup */}
      <div className="relative z-10 w-full flex items-center justify-center my-4">
        {/* Mock PDF Document Body */}
        <div className="w-full max-w-md rounded-2xl bg-white dark:bg-zinc-900 p-8 border border-zinc-200/60 dark:border-white/5 min-h-[300px] flex flex-col justify-between relative transition-all duration-300 shadow-xl">
            
            {/* Header replica */}
            <div className="flex justify-between items-center border-b border-zinc-100 dark:border-white/5 pb-4 mb-5 text-[10px] text-zinc-400 dark:text-zinc-500 font-semibold font-mono">
              <span>AGREEMENT_DRAFT_V2.PDF</span>
              <span>PAGE {activeStep} OF 4</span>
            </div>

            {/* Dynamic Step Contents */}
            <div className="flex-1 space-y-4 font-sans text-xs text-zinc-650 dark:text-zinc-400">
              
              {/* STEP 1: UPLOAD MOCKUP */}
              {activeStep === 1 && (
                <div className="space-y-3.5 animate-fadeIn">
                  <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-semibold uppercase tracking-wider">Document Uploader</p>
                  
                  {uploadState === "idle" && (
                    <div 
                      onClick={() => setUploadState("uploading")}
                      className="p-6 border-2 border-dashed border-zinc-200 dark:border-zinc-800 hover:border-indigo-500 dark:hover:border-indigo-500/50 rounded-2xl bg-zinc-50 dark:bg-zinc-900/30 flex flex-col items-center justify-center text-center gap-3 cursor-pointer group transition-all"
                    >
                      <div className="w-10 h-10 bg-indigo-500/5 group-hover:bg-indigo-500/10 text-indigo-500 rounded-xl flex items-center justify-center transition-all">
                        <svg className="w-5.5 h-5.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                      </div>
                      <div className="space-y-1">
                        <p className="text-zinc-800 dark:text-zinc-200 font-bold text-xs">Drag and drop file here</p>
                        <p className="text-[10px] text-zinc-400">or click to browse PDFs (Max 25MB)</p>
                      </div>
                    </div>
                  )}

                  {uploadState === "uploading" && (
                    <div className="p-6 border border-zinc-150 dark:border-zinc-800 rounded-2xl bg-zinc-50 dark:bg-zinc-900/30 space-y-3">
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-zinc-650 dark:text-zinc-400 animate-pulse font-medium">Uploading contract template...</span>
                        <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">{uploadProgress}%</span>
                      </div>
                      <div className="h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-indigo-600 rounded-full transition-all duration-100"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {uploadState === "done" && (
                    <div className="space-y-3.5 animate-fadeIn">
                      <div className="flex items-center gap-3 p-3 bg-indigo-500/5 border border-indigo-500/10 rounded-xl relative group">
                        <div className="w-9 h-9 bg-indigo-650 rounded-lg flex items-center justify-center text-xs font-bold text-white shadow-sm">PDF</div>
                        <div className="flex-1">
                          <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">NDA_Agreement_Final.pdf</p>
                          <p className="text-[10px] text-zinc-400 mt-0.5">1.2 MB • Upload completed</p>
                        </div>
                        <div className="w-5 h-5 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-full flex items-center justify-center">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      </div>

                      <button
                        onClick={() => setUploadState("idle")}
                        className="text-[10px] text-zinc-400 hover:text-zinc-650 dark:hover:text-zinc-300 font-bold underline cursor-pointer"
                      >
                        Upload Another File
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 2: ANNOTATE & HIGHLIGHT */}
              {activeStep === 2 && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="flex justify-between items-center">
                    <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-semibold uppercase tracking-wider">Highlight Annotator</p>
                    {/* Interactive Color Dots */}
                    <div className="flex gap-1.5 bg-zinc-50 dark:bg-zinc-900 p-1 rounded-lg border border-zinc-200/60 dark:border-white/5">
                      {[
                        { class: "bg-yellow-300/40", border: "bg-yellow-300" },
                        { class: "bg-emerald-300/40", border: "bg-emerald-300" },
                        { class: "bg-cyan-300/40", border: "bg-cyan-300" },
                        { class: "bg-rose-300/40", border: "bg-rose-300" },
                      ].map((dot) => (
                        <button
                          key={dot.class}
                          onClick={() => setHighlightColor(dot.class)}
                          className={`w-4.5 h-4.5 rounded-md cursor-pointer transition-transform ${dot.border} ${
                            highlightColor === dot.class ? "scale-110 ring-2 ring-indigo-500/40 border border-zinc-300 dark:border-white/30" : "opacity-60 hover:opacity-100"
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  <p className="leading-relaxed">
                    The Receiving Party agrees to restrict access to Confidential Information to only those of its employees, directors, and legal advisors who strictly need to know.
                  </p>

                  {/* Interactive Highlight Bar */}
                  <div className="relative p-1">
                    <div className={`absolute inset-0 rounded transition-all duration-300 ${highlightColor} mix-blend-multiply dark:mix-blend-screen`} />
                    <p className="relative font-bold text-zinc-800 dark:text-white z-10 px-1 py-0.5">
                      Section 3. Receiving Party shall not disclose, reproduce, or distribute the materials without prior consent.
                    </p>
                  </div>

                  <p className="text-[10px] text-zinc-405 dark:text-zinc-505 italic">
                    * Click any color dot above to change the highlight overlay instantly.
                  </p>
                </div>
              )}

              {/* STEP 3: SECURE SIGN */}
              {activeStep === 3 && (
                <div className="space-y-4 animate-fadeIn">
                  <p className="text-[10px] text-zinc-405 dark:text-zinc-505 font-semibold uppercase tracking-wider">Secure Counter-Signatures</p>
                  
                  <p className="leading-relaxed">
                    IN WITNESS WHEREOF, the parties hereto have executed this Mutual Non-Disclosure Agreement as of the Effective Date written above.
                  </p>

                  <div className="pt-2 border-t border-zinc-100 dark:border-white/5 flex items-center justify-between">
                    <div>
                      <p className="text-[9px] text-zinc-400 dark:text-zinc-505 font-bold uppercase">REPRESENTATIVE</p>
                      <p className="text-[10px] text-zinc-850 dark:text-zinc-305 mt-0.5 font-semibold">QT PDF Technologies LLC</p>
                    </div>

                    {/* Interactive Signature Area */}
                    <div className="w-40">
                      {hasSigned ? (
                        <div 
                          onClick={() => setHasSigned(false)}
                          className="h-10 bg-emerald-550/10 dark:bg-emerald-500/20 border border-emerald-500/30 rounded-xl flex items-center justify-center relative cursor-pointer group animate-fadeIn"
                        >
                          <span className="font-serif text-lg italic text-emerald-650 dark:text-emerald-400 font-bold">QT Technologies</span>
                          <span className="absolute -top-2.5 right-1 px-1.5 py-0.5 bg-emerald-500 text-white dark:text-zinc-950 text-[7px] font-black rounded-full uppercase tracking-wider shadow">
                            Verified
                          </span>
                        </div>
                      ) : (
                        <button
                          onClick={() => setHasSigned(true)}
                          className="w-full h-10 border border-dashed border-zinc-200 dark:border-zinc-700 hover:border-indigo-500 bg-zinc-50 dark:bg-white/5 hover:bg-indigo-50/50 dark:hover:bg-indigo-500/5 text-zinc-500 hover:text-indigo-650 dark:hover:text-indigo-300 text-[10px] font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                          Stamp Signature
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 4: AI SCAN */}
              {activeStep === 4 && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="flex justify-between items-center">
                    <p className="text-[10px] text-zinc-400 dark:text-zinc-505 font-semibold uppercase tracking-wider">AI Clause Intelligence</p>
                    <span className="text-[8px] bg-cyan-500/10 text-cyan-550 dark:text-cyan-400 font-mono font-bold px-2 py-0.5 rounded-full border border-cyan-500/20">
                      GPT-4 Powered
                    </span>
                  </div>

                  {aiScanState === "idle" && (
                    <div className="p-6 border border-zinc-100 dark:border-zinc-800 rounded-2xl bg-zinc-50/50 dark:bg-zinc-900/30 flex flex-col items-center justify-center text-center gap-3">
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-450 leading-normal max-w-xs">
                        Scan this contract to flag critical liabilities, check jurisdiction, and create an instant summary.
                      </p>
                      <button
                        onClick={() => setAiScanState("scanning")}
                        className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white dark:text-zinc-950 font-bold rounded-xl text-[10px] uppercase tracking-wide transition-all shadow-lg shadow-cyan-600/10 cursor-pointer active:scale-95"
                      >
                        Run Compliance Scan
                      </button>
                    </div>
                  )}

                  {aiScanState === "scanning" && (
                    <div className="space-y-3 p-4 border border-zinc-100 dark:border-zinc-800 rounded-2xl bg-zinc-50/50 dark:bg-zinc-900/30">
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-zinc-500 dark:text-zinc-450 animate-pulse">Scanning clauses for legal risk...</span>
                        <span className="font-mono text-cyan-600 dark:text-cyan-400 font-bold">{aiProgress}%</span>
                      </div>
                      <div className="h-1.5 bg-zinc-105 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-cyan-500 rounded-full transition-all duration-300"
                          style={{ width: `${aiProgress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {aiScanState === "done" && (
                    <div className="space-y-3 animate-fadeIn">
                      <div className="p-3 bg-cyan-500/5 border border-cyan-500/20 rounded-xl space-y-2">
                        <div className="flex items-center gap-1.5 text-[11px] text-cyan-705 dark:text-cyan-400 font-bold">
                          <svg className="w-4.5 h-4.5 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Scan Completed: Clean Summary
                        </div>
                        <div className="text-[10px] text-zinc-650 dark:text-zinc-400 leading-normal space-y-1">
                          <p>• **Contract Type**: NDA Mutual agreement.</p>
                          <p>• **Term**: 5 Years confidentiality restriction (Standard).</p>
                          <p>• **Risk Severity**: <span className="text-emerald-600 dark:text-emerald-400 font-bold">Low Risk</span>. Mutual limits.</p>
                        </div>
                      </div>

                      <button
                        onClick={() => setAiScanState("idle")}
                        className="text-[10px] text-zinc-400 hover:text-zinc-650 dark:hover:text-zinc-300 font-bold underline cursor-pointer"
                      >
                        Reset Scan
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer replica */}
            <div className="border-t border-zinc-100 dark:border-white/5 pt-4 mt-5 flex justify-between text-[8px] text-zinc-400 dark:text-zinc-650 font-semibold font-mono">
              <span>SECURE END-TO-END AES-256</span>
              <span>QT PDF WORKSPACE</span>
            </div>
          </div>
        </div>

      {/* Bottom Section: Step-by-Step Instructions & Navigation Controls */}
      <div className="relative z-10 flex flex-col gap-6" key={activeStep}>
        <div className="space-y-2">
          <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">
            {details.subtitle}
          </span>
          <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
            {details.title}
          </h3>
          <p className="text-zinc-600 dark:text-zinc-300 text-xs leading-relaxed max-w-lg">
            {details.description}
          </p>
          <p className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-550 italic pt-1">
            {details.tip}
          </p>
        </div>

        {/* Wizard Navigation Buttons */}
        <div className="flex items-center gap-3 border-t border-zinc-150 dark:border-zinc-900 pt-4">
          <button
            onClick={handlePrevStep}
            disabled={activeStep === 1}
            className="px-4 py-2 text-xs font-bold text-zinc-500 dark:text-zinc-450 hover:text-zinc-800 dark:hover:text-zinc-200 disabled:opacity-30 disabled:pointer-events-none rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/30 transition-colors cursor-pointer"
          >
            Previous
          </button>
          
          {activeStep < 4 ? (
            <button
              onClick={handleNextStep}
              className="px-4.5 py-2 text-xs font-bold text-zinc-700 dark:text-zinc-200 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-indigo-600 dark:hover:bg-indigo-500 hover:text-white dark:hover:text-white hover:border-indigo-600 dark:hover:border-indigo-500 rounded-lg shadow-sm transition-all cursor-pointer flex items-center gap-1"
            >
              Next Step
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ) : (
            <div className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-550 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>Ready to edit? Fill the form on the right!</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
