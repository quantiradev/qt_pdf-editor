// pdf.js is browser-only; load it lazily so Next.js never evaluates it on the server.
let pdfjsPromise: Promise<typeof import("pdfjs-dist")> | null = null;

export function getPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist").then((mod) => {
      mod.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${mod.version}/build/pdf.worker.min.mjs`;
      return mod;
    });
  }
  return pdfjsPromise;
}

export async function loadDocument(url: string) {
  const pdfjs = await getPdfjs();
  return pdfjs.getDocument({ url }).promise;
}
