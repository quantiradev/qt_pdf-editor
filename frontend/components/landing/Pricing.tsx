"use client";

import React from "react";

interface PricingProps {
  onAction: () => void;
}

export default function Pricing({ onAction }: PricingProps) {
  return (
    <section id="pricing" className="py-24 px-6 relative">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center max-w-xl mx-auto mb-16">
          <h2 className="text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
            Fair, transparent pricing
          </h2>
          <p className="mt-3 text-zinc-550 dark:text-zinc-400 text-sm">
            All plans include high-fidelity PDF editing features. Choose what fits your workflow.
          </p>
        </div>

        {/* Pricing Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto items-stretch">
          {/* Free Plan */}
          <div className="p-8 rounded-2xl border border-zinc-200 dark:border-zinc-900 bg-white/40 dark:bg-zinc-900/10 flex flex-col justify-between hover:shadow-xl transition-all duration-300">
            <div>
              <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">Free Starter</h3>
              <p className="mt-4 text-3xl font-black text-zinc-900 dark:text-white">$0</p>
              <p className="text-xs text-zinc-550 mt-1">Free forever, no card required</p>

              <ul className="mt-8 space-y-3.5 text-xs text-zinc-650 dark:text-zinc-400 leading-relaxed">
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-indigo-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Edit up to 3 PDFs per month
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-indigo-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Basic Highlights & Text overlays
                </li>
                <li className="flex items-center gap-2 text-zinc-400 dark:text-zinc-600 line-through">
                  Interactive AI Copilot Queries
                </li>
              </ul>
            </div>
            <button
              onClick={onAction}
              className="mt-8 block w-full py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-white/50 dark:bg-zinc-900/40 text-center text-xs font-bold text-zinc-705 dark:text-zinc-300 transition-all cursor-pointer"
            >
              Get Started
            </button>
          </div>

          {/* Pro Plan */}
          <div className="p-8 rounded-2xl border-2 border-indigo-500 bg-white dark:bg-zinc-900 relative flex flex-col justify-between shadow-2xl scale-105 duration-300 z-10">
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-indigo-600 text-white text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-indigo-600/20">
              Most Popular
            </div>
            <div>
              <h3 className="text-sm font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Professional</h3>
              <p className="mt-4 text-3xl font-black text-zinc-900 dark:text-white">$9.99<span className="text-xs font-normal text-zinc-500"> / mo</span></p>
              <p className="text-xs text-zinc-550 mt-1">Unlock unrestricted productivity</p>

              <ul className="mt-8 space-y-3.5 text-xs text-zinc-650 dark:text-zinc-400 leading-relaxed">
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-indigo-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Unlimited document editing
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-indigo-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Full AI Copilot contract auditing
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-indigo-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  High-compression file shrinking
                </li>
              </ul>
            </div>
            <button
              onClick={onAction}
              className="mt-8 block w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-center text-xs font-bold transition-all shadow-md shadow-indigo-600/10 hover:shadow-indigo-600/25 cursor-pointer"
            >
              Upgrade to Pro
            </button>
          </div>

          {/* Enterprise Plan */}
          <div className="p-8 rounded-2xl border border-zinc-200 dark:border-zinc-900 bg-white/40 dark:bg-zinc-900/10 flex flex-col justify-between hover:shadow-xl transition-all duration-300">
            <div>
              <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">Enterprise</h3>
              <p className="mt-4 text-3xl font-black text-zinc-900 dark:text-white">Custom</p>
              <p className="text-xs text-zinc-555 mt-1">For secure organizational scale</p>

              <ul className="mt-8 space-y-3.5 text-xs text-zinc-650 dark:text-zinc-400 leading-relaxed">
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-indigo-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Multi-seat workspace team billing
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-indigo-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Dedicated AI models trained locally
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-indigo-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Dedicated Account Success Manager
                </li>
              </ul>
            </div>
            <button
              onClick={() => alert("Enterprise contact option is coming soon.")}
              className="mt-8 block w-full py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-white/50 dark:bg-zinc-900/40 text-center text-xs font-bold text-zinc-700 dark:text-zinc-300 transition-all cursor-pointer"
            >
              Contact Sales
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
