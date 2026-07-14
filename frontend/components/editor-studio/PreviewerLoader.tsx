"use client";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

// pdf.js touches browser-only globals, so the whole previewer is client-side only.
const Previewer = dynamic(() => import("./Previewer"), {
  ssr: false,
  loading: () => (
    <div className="load-screen">
      <Loader2 size={28} className="spin" />
      <div>Loading previewer…</div>
    </div>
  ),
});

export default function PreviewerLoader({ id }: { id: string }) {
  return <Previewer id={id} />;
}
