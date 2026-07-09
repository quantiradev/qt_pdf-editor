"use client";
import { create } from "zustand";
import { api } from "./api";
import { loadDocument } from "./pdf";
import type {
  Annot, BakedNote, FileMeta, OutlineItem, PageSize, TextBlock,
  TextEditAnnot, Tool, ToolOpts,
} from "./types";
import { clamp, uid } from "./utils";

export interface Toast {
  id: string;
  kind: "info" | "error" | "success";
  msg: string;
}

interface PendingLink {
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Editing model: there is no persistent overlay layer. New objects live in
 * `annots` only for the brief moment they are being placed/adjusted; an
 * auto-flush commits them into the PDF file itself (server-side bake) as
 * soon as the user is idle. Text edits skip the queue entirely and are
 * applied to the PDF immediately. Undo/redo past a commit is served by the
 * backend's version history.
 */
interface EditorState {
  // document
  fileId: string | null;
  meta: FileMeta | null;
  doc: any | null;
  pageSizes: PageSize[];
  loadError: string | null;
  outline: OutlineItem[];
  bakedNotes: BakedNote[];
  textBlocks: Record<number, TextBlock[] | "loading">;

  // view
  zoom: number;
  viewMode: "continuous" | "single";
  currentPage: number;
  showGrid: boolean;
  snap: boolean;
  stageEl: HTMLDivElement | null;

  // tooling
  tool: Tool;
  opts: ToolOpts;

  // in-flight edits (pre-commit) + interaction guards
  annots: Annot[];
  selectedId: string | null;
  editingId: string | null;
  interacting: number;
  past: Annot[][];
  future: Annot[][];

  // ui chrome
  leftOpen: boolean;
  leftTab: "pages" | "outline";
  rightOpen: boolean;
  rightTab: "props" | "comments";
  selectedPages: number[];
  pendingLink: PendingLink | null;
  modal: null | "export" | "split" | "merge" | "watermark";
  saving: boolean;
  busy: string | null;
  toasts: Toast[];

  // actions
  set: (p: Partial<EditorState>) => void;
  toast: (msg: string, kind?: Toast["kind"]) => void;
  dismissToast: (id: string) => void;

  loadFile: (id: string) => Promise<void>;
  reloadDoc: () => Promise<void>;

  setTool: (t: Tool) => void;
  setOpts: (p: Partial<ToolOpts>) => void;
  setZoom: (z: number) => void;
  gotoPage: (p: number) => void;

  beginInteract: () => void;
  endInteract: () => void;
  scheduleFlush: () => void;
  flushPending: () => Promise<void>;

  snapshot: () => void;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  addAnnot: (a: Annot, select?: boolean) => void;
  updateAnnot: (id: string, patch: Partial<Annot>, withSnapshot?: boolean) => void;
  removeAnnot: (id: string) => void;
  applyTextEdit: (edit: TextEditAnnot) => Promise<void>;

  save: (quiet?: boolean) => Promise<boolean>;
  ensureSaved: () => Promise<boolean>;
  runOp: (label: string, fn: () => Promise<unknown>) => Promise<boolean>;
  fetchTextBlocks: (page: number) => void;
  refreshNotes: () => Promise<void>;
}

export const DEFAULT_OPTS: ToolOpts = {
  color: "#e11d48",
  fillColor: null,
  strokeWidth: 2.5,
  opacity: 1,
  highlightColor: "#ffd400",
  fontSize: 16,
  fontFamily: "helv",
  fontColor: "#111111",
  bold: false,
  italic: false,
  align: "left",
  noteColor: "#ffd400",
};

const FLUSH_DELAY = 1200;
// after this many deferred attempts while an object stays selected,
// commit anyway so the PDF never lags far behind what is on screen
const MAX_SELECTED_DEFERS = 5;

let flushTimer: ReturnType<typeof setTimeout> | null = null;
let selectedDefers = 0;

export const useEditor = create<EditorState>((set, get) => ({
  fileId: null,
  meta: null,
  doc: null,
  pageSizes: [],
  loadError: null,
  outline: [],
  bakedNotes: [],
  textBlocks: {},

  zoom: 1,
  viewMode: "continuous",
  currentPage: 0,
  showGrid: false,
  snap: false,
  stageEl: null,

  tool: "select",
  opts: { ...DEFAULT_OPTS },

  annots: [],
  selectedId: null,
  editingId: null,
  interacting: 0,
  past: [],
  future: [],

  leftOpen: true,
  leftTab: "pages",
  rightOpen: true,
  rightTab: "props",
  selectedPages: [],
  pendingLink: null,
  modal: null,
  saving: false,
  busy: null,
  toasts: [],

  set: (p) => set(p),

  toast: (msg, kind = "info") => {
    const t: Toast = { id: uid(), msg, kind };
    set((s) => ({ toasts: [...s.toasts, t] }));
    setTimeout(() => get().dismissToast(t.id), 4200);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  loadFile: async (id) => {
    set({
      fileId: id, meta: null, doc: null, pageSizes: [], loadError: null,
      annots: [], past: [], future: [], selectedId: null, editingId: null,
      outline: [], bakedNotes: [], textBlocks: {}, selectedPages: [],
      currentPage: 0, interacting: 0,
    });
    try {
      await api.markOpened(id).catch(() => {});
      await get().reloadDoc();
    } catch (e: any) {
      set({ loadError: e.message ?? "Failed to load document" });
    }
  },

  reloadDoc: async () => {
    const id = get().fileId;
    if (!id) return;
    const meta = await api.meta(id);
    const old = get().doc;
    const doc = await loadDocument(api.contentUrl(id, meta.version));
    const sizes: PageSize[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const vp = page.getViewport({ scale: 1 });
      sizes.push({ w: vp.width, h: vp.height });
    }
    set({
      meta, doc, pageSizes: sizes, textBlocks: {},
      currentPage: clamp(get().currentPage, 0, doc.numPages - 1),
      selectedPages: get().selectedPages.filter((p) => p < doc.numPages),
    });
    old?.destroy?.().catch?.(() => {});
    api.outline(id).then((outline) => set({ outline })).catch(() => {});
    get().refreshNotes();
  },

  setTool: (tool) => {
    set({ tool, editingId: null, pendingLink: null });
    if (tool !== "select") set({ selectedId: null });
  },
  setOpts: (p) => set((s) => ({ opts: { ...s.opts, ...p } })),
  setZoom: (z) => set({ zoom: clamp(z, 0.1, 4) }),

  gotoPage: (p) => {
    const { viewMode, stageEl, meta } = get();
    const target = clamp(p, 0, (meta?.pages ?? 1) - 1);
    set({ currentPage: target });
    if (viewMode === "continuous" && stageEl) {
      const el = stageEl.querySelector<HTMLElement>(`[data-pno="${target}"]`);
      if (el) stageEl.scrollTo({ top: el.offsetTop - 12, behavior: "auto" });
    }
  },

  /* ---------------- auto-commit into the PDF ---------------- */

  beginInteract: () => set((s) => ({ interacting: s.interacting + 1 })),
  endInteract: () => {
    set((s) => ({ interacting: Math.max(0, s.interacting - 1) }));
    if (get().annots.length) get().scheduleFlush();
  },

  scheduleFlush: () => {
    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = setTimeout(() => {
      flushTimer = null;
      get().flushPending();
    }, FLUSH_DELAY);
  },

  flushPending: async () => {
    const st = get();
    if (!st.annots.length) return;
    // never commit mid-gesture / mid-typing — wait for idle
    if (st.saving || st.busy || st.editingId || st.pendingLink || st.interacting > 0) {
      st.scheduleFlush();
      return;
    }
    // give the user a few idle cycles to adjust a still-selected object,
    // then commit it regardless
    if (st.selectedId && st.annots.some((a) => a.id === st.selectedId)) {
      selectedDefers += 1;
      if (selectedDefers < MAX_SELECTED_DEFERS) {
        st.scheduleFlush();
        return;
      }
      set({ selectedId: null });
    }
    selectedDefers = 0;
    await get().save(true);
  },

  /* ---------------- local history (pre-commit) + server history ---------------- */

  snapshot: () => set((s) => ({
    past: [...s.past.slice(-49), s.annots.map((a) => ({ ...a }))],
    future: [],
  })),

  undo: async () => {
    const st = get();
    if (st.past.length) {
      set({
        annots: st.past[st.past.length - 1],
        past: st.past.slice(0, -1),
        future: [st.annots, ...st.future].slice(0, 50),
        selectedId: null, editingId: null,
      });
      get().scheduleFlush();
      return;
    }
    if (!st.meta?.can_undo || st.busy || st.saving) return;
    set({ busy: "Undoing" });
    try {
      await api.undo(st.fileId!);
      await get().reloadDoc();
    } catch (e: any) {
      get().toast(`Undo failed: ${e.message}`, "error");
    } finally {
      set({ busy: null });
    }
  },

  redo: async () => {
    const st = get();
    if (st.future.length) {
      set({
        annots: st.future[0],
        future: st.future.slice(1),
        past: [...st.past, st.annots],
        selectedId: null, editingId: null,
      });
      get().scheduleFlush();
      return;
    }
    if (!st.meta?.can_redo || st.busy || st.saving) return;
    set({ busy: "Redoing" });
    try {
      await api.redo(st.fileId!);
      await get().reloadDoc();
    } catch (e: any) {
      get().toast(`Redo failed: ${e.message}`, "error");
    } finally {
      set({ busy: null });
    }
  },

  addAnnot: (a, select = true) => {
    get().snapshot();
    set((s) => ({
      annots: [...s.annots, a],
      selectedId: select ? a.id : s.selectedId,
    }));
    selectedDefers = 0;
    get().scheduleFlush();
  },
  updateAnnot: (id, patch, withSnapshot = false) => {
    if (withSnapshot) get().snapshot();
    set((s) => ({
      annots: s.annots.map((a) => (a.id === id ? ({ ...a, ...patch } as Annot) : a)),
    }));
    selectedDefers = 0;
    get().scheduleFlush();
  },
  removeAnnot: (id) => {
    get().snapshot();
    set((s) => ({
      annots: s.annots.filter((a) => a.id !== id),
      selectedId: s.selectedId === id ? null : s.selectedId,
      editingId: s.editingId === id ? null : s.editingId,
    }));
    get().scheduleFlush();
  },

  /** Rewrite an existing text block — applied to the PDF right now. */
  applyTextEdit: async (edit) => {
    const id = get().fileId;
    if (!id) return;
    set({ busy: "Rewriting text in the PDF" });
    try {
      await api.saveAnnotations(id, [edit as Annot]);
      await get().reloadDoc();
    } catch (e: any) {
      get().toast(`Text edit failed: ${e.message}`, "error");
    } finally {
      set({ busy: null });
    }
  },

  save: async (quiet = false) => {
    const { fileId, annots, saving } = get();
    if (!fileId || saving) return false;
    if (!annots.length) {
      if (!quiet) get().toast("Everything is already saved in the PDF");
      return true;
    }
    if (!quiet) set({ editingId: null, selectedId: null });
    set({ saving: true });
    const batch = [...annots];
    const ids = new Set(batch.map((a) => a.id));
    try {
      await api.saveAnnotations(fileId, batch);
      set((s) => ({
        annots: s.annots.filter((a) => !ids.has(a.id)),
        past: [], future: [],
        selectedId: s.selectedId && ids.has(s.selectedId) ? null : s.selectedId,
      }));
      await get().reloadDoc();
      if (get().annots.length) get().scheduleFlush();
      return true;
    } catch (e: any) {
      get().toast(`Could not write to the PDF: ${e.message}`, "error");
      return false;
    } finally {
      set({ saving: false });
    }
  },

  ensureSaved: async () => {
    if (!get().annots.length) return true;
    return get().save(true);
  },

  runOp: async (label, fn) => {
    if (get().busy) return false;
    if (!(await get().ensureSaved())) return false;
    set({ busy: label });
    try {
      await fn();
      await get().reloadDoc();
      return true;
    } catch (e: any) {
      get().toast(`${label} failed: ${e.message}`, "error");
      return false;
    } finally {
      set({ busy: null });
    }
  },

  fetchTextBlocks: (page) => {
    const { fileId, textBlocks } = get();
    if (!fileId || textBlocks[page]) return;
    set({ textBlocks: { ...textBlocks, [page]: "loading" } });
    api.textBlocks(fileId, page)
      .then((blocks) =>
        set((s) => ({ textBlocks: { ...s.textBlocks, [page]: blocks } })))
      .catch(() =>
        set((s) => ({ textBlocks: { ...s.textBlocks, [page]: [] } })));
  },

  refreshNotes: async () => {
    const id = get().fileId;
    if (!id) return;
    try {
      set({ bakedNotes: await api.notes(id) });
    } catch {}
  },
}));

/** Are edits still on their way into the PDF? */
export const useDirty = () => useEditor((s) => s.annots.length > 0);
