"use client";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

// pdf.js touches browser-only globals, so the whole editor is client-side only.
const Editor = dynamic(() => import("./Editor"), {
  ssr: false,
  loading: () => (
    <div className="load-screen">
      <Loader2 size={28} className="spin" />
      <div>Loading editor…</div>
    </div>
  ),
});

export default function EditorLoader({ id }: { id: string }) {
  return <Editor id={id} />;
}
