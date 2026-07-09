"use client";

import React from "react";

interface FaqProps {
  openFaq: number | null;
  onFaqToggle: (index: number | null) => void;
}

export default function Faq({ openFaq, onFaqToggle }: FaqProps) {
  const faqs = [
    {
      q: "How does the AI Document Copilot work?",
      a: "Our AI Assistant acts as an intelligent reader for your PDFs. When you query a document, it reads the text, identifies key obligations or summaries, and returns context-aware answers. Your files are processed entirely in safe sandbox instances."
    },
    {
      q: "Is my document data secure?",
      a: "Absolutely. Security is our top priority. We encrypt files in transit and at rest. PDF uploads are stored temporarily in transient memory buffers, used only to run your requested tools, and are completely wiped from our storage within 24 hours."
    },
    {
      q: "Do I need to download desktop applications?",
      a: "No, QT PDF Editor runs 100% online in your web browser. You get full access to annotations, merging, compression, and AI chat without needing any extensions, plug-ins, or heavy desktop downloads."
    },
    {
      q: "Can I cancel my Pro subscription at any time?",
      a: "Yes. You can manage your subscription easily from your account workspace settings. If you cancel, your Pro features will remain active until the end of your billing cycle."
    },
    {
      q: "What file size limits apply?",
      a: "Free users can upload files up to 15MB. Pro and Enterprise tier plans support files up to 100MB per document for standard conversions, merges, and AI summaries."
    }
  ];

  return (
    <section id="faq" className="py-24 px-6 border-t border-zinc-200 dark:border-zinc-900 bg-white/40 dark:bg-zinc-950/20 relative">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
            Frequently Asked Questions
          </h2>
          <p className="mt-3 text-zinc-500 dark:text-zinc-400 text-sm">
            Got questions? We have answers. If you need further assistance, please contact our support team.
          </p>
        </div>

        {/* Accordion List */}
        <div className="space-y-4">
          {faqs.map((faq, index) => {
            const isOpen = openFaq === index;
            return (
              <div
                key={index}
                className="rounded-2xl border border-zinc-200 dark:border-zinc-900 bg-white/30 dark:bg-zinc-900/10 overflow-hidden transition-all duration-300"
              >
                <button
                  onClick={() => onFaqToggle(isOpen ? null : index)}
                  className="w-full px-6 py-5 flex items-center justify-between text-left font-bold text-sm sm:text-base text-zinc-900 dark:text-white cursor-pointer select-none transition-colors hover:text-indigo-600 dark:hover:text-indigo-400"
                >
                  <span>{faq.q}</span>
                  <svg
                    className={`w-5 h-5 text-zinc-550 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <div
                  className={`transition-all duration-300 ease-in-out overflow-hidden ${
                    isOpen ? "max-h-40 border-t border-zinc-200/50 dark:border-zinc-900/50" : "max-h-0"
                  }`}
                >
                  <div className="px-6 py-5 text-xs sm:text-sm text-zinc-550 dark:text-zinc-400 leading-relaxed">
                    {faq.a}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
