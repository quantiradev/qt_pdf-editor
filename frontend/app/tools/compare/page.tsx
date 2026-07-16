import { Suspense } from "react";
import CompareFramework from "@/components/tools/CompareFramework";

export default function ComparePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-zinc-400">Loading...</div>}>
      <CompareFramework />
    </Suspense>
  );
}
