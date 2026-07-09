"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

// The new editor requires a file ID (/editor/[id]).
// Redirect bare /editor visits to the dashboard where users can upload or pick a file.
export default function EditorRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/");
  }, [router]);
  return null;
}
