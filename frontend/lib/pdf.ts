// pdf.js is browser-only; load it lazily so Next.js never evaluates it on the server.
let pdfjsPromise: Promise<typeof import("pdfjs-dist")> | null = null;

export function getPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist").then((mod) => {
      // Use local worker to avoid network issues and unpkg blocking
      mod.GlobalWorkerOptions.workerSrc = `/pdf.worker.min.mjs`;
      return mod;
    });
  }
  return pdfjsPromise;
}

export async function loadDocument(url: string) {
  const pdfjs = await getPdfjs();
  return pdfjs.getDocument({ url }).promise;
}
