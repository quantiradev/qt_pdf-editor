const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";
import type { Annot, BakedNote, FileMeta, OutlineItem, TextBlock } from "./types";

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${url}`, init);
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body?.detail) msg = typeof body.detail === "string" ? body.detail : msg;
    } catch {}
    throw new Error(msg);
  }
  return res.json();
}

const json = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const api = {
  list: (includeDeleted = false) =>
    req<FileMeta[]>(`/api/files?include_deleted=${includeDeleted}`),

  upload: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return req<FileMeta>("/api/files/upload", { method: "POST", body: fd });
  },

  meta: (id: string) => req<FileMeta>(`/api/files/${id}`),
  markOpened: (id: string) =>
    req<{ ok: boolean }>(`/api/files/${id}/open`, { method: "POST" }),
  rename: (id: string, name: string) =>
    req<FileMeta>(`/api/files/${id}`, { ...json({ name }), method: "PATCH" }),
  remove: (id: string, permanent = false) =>
    req<{ ok: boolean }>(`/api/files/${id}?permanent=${permanent}`, { method: "DELETE" }),
  restore: (id: string) =>
    req<{ ok: boolean }>(`/api/files/${id}/restore`, { method: "POST" }),

  contentUrl: (id: string, version: number) =>
  `${API_URL}/api/files/${id}/content?v=${version}`,

  outline: (id: string) => req<OutlineItem[]>(`/api/files/${id}/outline`),
  textBlocks: (id: string, page: number) =>
    req<TextBlock[]>(`/api/files/${id}/text?page=${page}`),
  notes: (id: string) => req<BakedNote[]>(`/api/files/${id}/notes`),
  editNote: (id: string, xref: number, text: string) =>
    req<FileMeta>(`/api/files/${id}/notes/${xref}`, { ...json({ text }), method: "PATCH" }),
  deleteNote: (id: string, xref: number) =>
    req<FileMeta>(`/api/files/${id}/notes/${xref}`, { method: "DELETE" }),

  saveAnnotations: (id: string, annotations: Annot[]) =>
    req<FileMeta>(`/api/files/${id}/annotations`, json({ annotations })),

  undo: (id: string) => req<FileMeta>(`/api/files/${id}/undo`, { method: "POST" }),
  redo: (id: string) => req<FileMeta>(`/api/files/${id}/redo`, { method: "POST" }),

  watermark: (id: string, body: {
    text: string; color: string; opacity: number;
    fontSize: number | null; rotate: number; pages: string;
  }) => req<FileMeta>(`/api/files/${id}/watermark`, json(body)),

  rotatePages: (id: string, pages: number[], degrees: number) =>
    req<FileMeta>(`/api/files/${id}/pages/rotate`, json({ pages, degrees })),
  deletePages: (id: string, pages: number[]) =>
    req<FileMeta>(`/api/files/${id}/pages/delete`, json({ pages })),
  duplicatePages: (id: string, pages: number[]) =>
    req<FileMeta>(`/api/files/${id}/pages/duplicate`, json({ pages })),
  reorderPages: (id: string, order: number[]) =>
    req<FileMeta>(`/api/files/${id}/pages/reorder`, json({ order })),
  extractPages: (id: string, pages: number[], name?: string) =>
    req<FileMeta>(`/api/files/${id}/pages/extract`, json({ pages, name })),
  split: (id: string, ranges: string) =>
    req<FileMeta[]>(`/api/files/${id}/split`, json({ ranges })),
  merge: (fileIds: string[], name?: string) =>
    req<FileMeta>(`/api/files/merge`, json({ file_ids: fileIds, name })),

  exportBlob: async (id: string, format: string, pages: string, dpi: number) => {
    const res = await fetch(
  `${API_URL}/api/files/${id}/export?format=${format}&pages=${encodeURIComponent(pages)}&dpi=${dpi}`
);
    if (!res.ok) {
      let msg = `${res.status}`;
      try { msg = (await res.json()).detail ?? msg; } catch {}
      throw new Error(msg);
    }
    const dispo = res.headers.get("Content-Disposition") ?? "";
    const m = dispo.match(/filename="([^"]+)"/);
    return { blob: await res.blob(), name: m?.[1] ?? `export.${format}` };
  },

  downloadUrl: (id: string) =>
  `${API_URL}/api/files/${id}/download`,
};
