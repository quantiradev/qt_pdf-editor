"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Bare /preview redirects to home where users can select or upload a PDF.
export default function PreviewRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/");
  }, [router]);
  return null;
}
