"use client";
import { create } from "zustand";
import { api } from "./api";
import { loadDocument } from "./pdf";
import type {
  Annot, BakedNote, FileMeta, OutlineItem, PageSize, Paragraph,
  TextBlockAnnot, Tool, ToolOpts,
} from "./types";
import { clamp, uid } from "./utils";

/**
 * An open block session with nothing changed yet is a selection, not an
 * edit — it must never bake and is dropped once deselected. `h` is derived
 * from the wrapped content, so it does not count as a change.
 */
export function isPristineBlock(a: Annot): boolean {
  if (a.type !== "textblock") return false;
  const b = a as TextBlockAnnot;
  return (
    Math.abs(b.x - b.orig.x) < 0.25 &&
    Math.abs(b.y - b.orig.y) < 0.25 &&
    Math.abs(b.w - b.orig.w) < 0.25 &&
    Math.abs(((b.rotate % 360) + 360) % 360) < 0.05 &&
    b.text === b.origText
  );
}

/** Pending edits that will actually change the PDF. */
export function realEdits(annots: Annot[]): Annot[] {
  return annots.filter((a) => !isPristineBlock(a));
}

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
  /** bumped per page when its content changed — pages re-render only then */
  pageEpochs: number[];
  loadError: string | null;
  outline: OutlineItem[];
  bakedNotes: BakedNote[];
  paragraphs: Record<number, Paragraph[] | "loading">;

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
  previewMode: boolean;

  // actions
  set: (p: Partial<EditorState>) => void;
  toast: (msg: string, kind?: Toast["kind"]) => void;
  dismissToast: (id: string) => void;

  loadFile: (id: string) => Promise<void>;
  reloadDoc: (changedPages?: number[]) => Promise<void>;

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
  /** Lift a paragraph off the page as a live block object (edit-text tool). */
  beginBlockEdit: (block: TextBlockAnnot) => void;

  save: (quiet?: boolean) => Promise<boolean>;
  ensureSaved: () => Promise<boolean>;
  runOp: (label: string, fn: () => Promise<unknown>) => Promise<boolean>;
  fetchParagraphs: (page: number) => void;
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
  pageEpochs: [],
  loadError: null,
  outline: [],
  bakedNotes: [],
  paragraphs: {},

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
  previewMode: false,

  set: (p) => set(p),

  toast: (msg, kind = "info") => {
    const t: Toast = { id: uid(), msg, kind };
    set((s) => ({ toasts: [...s.toasts, t] }));
    setTimeout(() => get().dismissToast(t.id), 4200);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  loadFile: async (id) => {
    set({
      fileId: id, meta: null, doc: null, pageSizes: [], pageEpochs: [],
      loadError: null,
      annots: [], past: [], future: [], selectedId: null, editingId: null,
      outline: [], bakedNotes: [], paragraphs: {}, selectedPages: [],
      currentPage: 0, interacting: 0,
    });
    try {
      await api.markOpened(id).catch(() => {});
      await get().reloadDoc();
    } catch (e: any) {
      console.error(e);
      set({ loadError: String(e.stack || e.message) ?? "Failed to load document" });
    }
  },

  reloadDoc: async (changedPages) => {
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
    // only pages whose content changed get a new epoch (and thus re-render);
    // untouched pages keep their canvas pixels — no full-document repaint
    const prev = get().pageEpochs;
    const bumpAll = !changedPages || sizes.length !== prev.length;
    const pageEpochs = sizes.map(
      (_, i) => (prev[i] ?? 0) + (bumpAll || changedPages!.includes(i) ? 1 : 0));
    const paragraphs = { ...get().paragraphs };
    for (const k of Object.keys(paragraphs)) {
      if (bumpAll || changedPages!.includes(Number(k))) delete paragraphs[Number(k)];
    }
    set({
      meta, doc, pageSizes: sizes, pageEpochs, paragraphs,
      currentPage: clamp(get().currentPage, 0, doc.numPages - 1),
      selectedPages: get().selectedPages.filter((p) => p < doc.numPages),
    });
    old?.destroy?.().catch?.(() => {});
    api.outline(id).then((outline) => set({ outline })).catch(() => {});
    get().refreshNotes();
  },

  setTool: (tool) => {
    // untouched block sessions are selections, not edits — leaving the tool
    // discards them so the auto-flush never sees no-ops
    set((s) => ({
      tool,
      editingId: null,
      pendingLink: null,
      annots: s.annots.filter((a) => !isPristineBlock(a)),
    }));
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
    // deselected-but-untouched block sessions are stale — quietly drop them
    const stale = st.annots.filter(
      (a) => isPristineBlock(a) && a.id !== st.selectedId);
    if (stale.length) {
      const ids = new Set(stale.map((a) => a.id));
      set((s) => ({ annots: s.annots.filter((a) => !ids.has(a.id)) }));
    }
    if (!get().annots.length) return;
    // never commit mid-gesture / mid-typing — wait for idle
    if (st.saving || st.busy || st.editingId || st.pendingLink || st.interacting > 0) {
      st.scheduleFlush();
      return;
    }
    // an untouched block selection is not an edit: leave it open without
    // burning defer cycles — it is dropped the moment it loses selection
    if (!realEdits(get().annots).length) return;
    // give the user a few idle cycles to adjust a still-selected object,
    // then commit it regardless
    if (st.selectedId && get().annots.some((a) => a.id === st.selectedId)) {
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

  beginBlockEdit: (block) => {
    // spawned directly (no undo snapshot): grabbing a block is a selection;
    // history starts with the first actual change
    set((s) => ({
      annots: [...s.annots, block],
      selectedId: block.id,
      editingId: null,
    }));
    selectedDefers = 0;
    get().scheduleFlush(); // the stale-session sweep runs on this tick
  },

  save: async (quiet = false) => {
    const { fileId, saving } = get();
    if (!fileId || saving) return false;
    // untouched block sessions are selections, not edits — never bake them
    const batch = realEdits(get().annots);
    if (!batch.length) {
      if (!quiet) get().toast("Everything is already saved in the PDF");
      return true;
    }
    if (!quiet) set({ editingId: null, selectedId: null });
    set({ saving: true });
    const ids = new Set(batch.map((a) => a.id));
    const changedPages = Array.from(new Set(batch.map((a) => a.page)));
    try {
      const meta = await api.saveAnnotations(fileId, batch);
      for (const w of meta.warnings ?? []) get().toast(w, "info");
      const changedSet = new Set(meta.changed_pages ?? changedPages);
      set((s) => ({
        // baked edits leave the queue; open block sessions on a re-baked
        // page now hold stale paragraph ids and are dropped with them
        annots: s.annots.filter(
          (a) => !ids.has(a.id) && !(isPristineBlock(a) && changedSet.has(a.page))),
        past: [], future: [],
        selectedId: s.selectedId && ids.has(s.selectedId) ? null : s.selectedId,
      }));
      // prefer the server's list — a text-edit reflow can touch later pages
      await get().reloadDoc(meta.changed_pages ?? changedPages);
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
    if (!realEdits(get().annots).length) return true;
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

  fetchParagraphs: (page) => {
    const { fileId, paragraphs } = get();
    if (!fileId || paragraphs[page]) return;
    set({ paragraphs: { ...paragraphs, [page]: "loading" } });
    api.paragraphs(fileId, page)
      .then((blocks) =>
        set((s) => ({ paragraphs: { ...s.paragraphs, [page]: blocks } })))
      .catch(() =>
        set((s) => ({ paragraphs: { ...s.paragraphs, [page]: [] } })));
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
export const useDirty = () => useEditor((s) => realEdits(s.annots).length > 0);
