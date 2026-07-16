export type Tool =
  | "select"
  | "edit-text"
  | "form"
  | "text"
  | "highlight"
  | "underline"
  | "strikeout"
  | "pen"
  | "eraser"
  | "rect"
  | "ellipse"
  | "line"
  | "arrow"
  | "image"
  | "note"
  | "link"
  | "sign";

export interface FileMeta {
  id: string;
  name: string;
  size: number;
  pages: number;
  version: number;
  created_at: number;
  updated_at: number;
  opened_at: number;
  deleted: boolean;
  can_undo?: boolean;
  can_redo?: boolean;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Base {
  id: string;
  page: number;
}

export interface TextAnnot extends Base, Rect {
  type: "text";
  text: string;
  fontSize: number;
  /** Base-14 alias ("helv" | "tiro" | "cour") or a Google Fonts family name. */
  fontFamily: string;
  color: string;
  bold?: boolean;
  italic?: boolean;
  align?: "left" | "center" | "right";
  url?: string;
}

/**
 * A live text-block edit session: one existing paragraph lifted off the page
 * as a movable / resizable / rotatable object (ElasticPDF-style "Edit Text").
 * On bake the server redacts the original paragraph and re-wraps the text
 * into the new box; pure in-place rewrites are routed through the reflow
 * engine instead. `h` is derived from the wrapped content, never set by hand.
 */
export interface TextBlockAnnot extends Base, Rect {
  type: "textblock";
  /** Server-side paragraph id — geometry/styles are re-derived from it on bake. */
  paraId: string;
  /** Degrees, CSS convention (clockwise-positive), about the box centre. */
  rotate: number;
  text: string;
  /** Base-14 alias ("helv" | "tiro" | "cour") or a Google Fonts family name. */
  fontFamily: string;
  fontSize: number;
  color: string;
  bold: boolean;
  italic: boolean;
  align: "left" | "center" | "right" | "justify";
  /** Baseline distance in pt — drives the overlay's line-height. */
  leading: number;
  /** The paragraph's original box: masked while the block floats elsewhere. */
  orig: Rect;
  origText: string;
  /** Original typography, snapshotted at pickup — a restyle (bold/italic/
   *  colour/font/size) counts as an edit even when geometry and text are
   *  untouched, so it is baked instead of swept away as a pristine session. */
  origStyle: {
    /** Base-14 alias ("helv" | "tiro" | "cour") or a Google Fonts family name. */
  fontFamily: string;
    fontSize: number;
    color: string;
    bold: boolean;
    italic: boolean;
    align: "left" | "center" | "right" | "justify";
    leading: number;
  };
}

export interface MarkupAnnot extends Base {
  type: "highlight" | "underline" | "strikeout";
  rects: Rect[];
  color: string;
  opacity: number;
}

export interface InkAnnot extends Base {
  type: "ink";
  points: [number, number][];
  color: string;
  width: number;
  opacity: number;
}

export interface ShapeAnnot extends Base, Rect {
  type: "rect" | "ellipse";
  stroke: string;
  strokeWidth: number;
  fill: string | null;
  opacity: number;
}

export interface LineAnnot extends Base {
  type: "line" | "arrow";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stroke: string;
  strokeWidth: number;
  opacity: number;
}

export interface ImageAnnot extends Base, Rect {
  type: "image";
  src: string; // data URL
  rotate: 0 | 90 | 180 | 270;
  url?: string;
}

export interface NoteAnnot extends Base {
  type: "note";
  x: number;
  y: number;
  text: string;
  color: string;
  createdAt: number;
}

export interface LinkAnnot extends Base, Rect {
  type: "link";
  url: string;
}

export type Annot =
  | TextAnnot
  | TextBlockAnnot
  | MarkupAnnot
  | InkAnnot
  | ShapeAnnot
  | LineAnnot
  | ImageAnnot
  | NoteAnnot
  | LinkAnnot;

export interface OutlineItem {
  level: number;
  title: string;
  page: number;
}

/** One editable paragraph as detected by the backend text engine. */
export interface Paragraph extends Rect {
  id: string;
  text: string;
  align: "left" | "center" | "right" | "justify";
  leading: number; // baseline distance, pt
  fontSize: number;
  /** Base-14 alias ("helv" | "tiro" | "cour") or a Google Fonts family name. */
  fontFamily: string;
  bold: boolean;
  italic: boolean;
  color: string;
  lines: number;
  editable: boolean;
}

export interface BakedNote {
  xref: number;
  page: number;
  x: number;
  y: number;
  text: string;
  modified: string;
}

export interface PageSize {
  w: number;
  h: number;
}

/** One find-in-document hit, in page points (top-left origin). */
export interface SearchMatch extends Rect {
  page: number;
}

/** One fillable AcroForm widget as reported by the backend. */
export interface FormField extends Rect {
  xref: number;
  name: string;
  page: number;
  type: "text" | "checkbox" | "choice";
  value: string | boolean;
  options: string[];
  fontSize: number;
}

export interface ToolOpts {
  color: string; // pen / shape stroke
  fillColor: string | null;
  strokeWidth: number;
  opacity: number;
  highlightColor: string;
  fontSize: number;
  /** Base-14 alias ("helv" | "tiro" | "cour") or a Google Fonts family name. */
  fontFamily: string;
  fontColor: string;
  bold: boolean;
  italic: boolean;
  align: "left" | "center" | "right";
  noteColor: string;
}

// ─── Compare PDF types ────────────────────────────────────────────────────────

export interface DiffRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DiffItem {
  type: "addition" | "deletion" | "modification";
  category: string;
  text: string;
  rect: DiffRect;
  description: string;
  source: string;
  difference_type?: string;
  object_type?: string;
  original_value?: string | null;
  revised_value?: string | null;
  confidence_score?: number;
}

export interface PageDiff {
  page_index: number;
  differences: DiffItem[];
}

export interface ComparisonResult {
  file_id_original: string;
  file_id_revised: string;
  meta_original: FileMeta;
  meta_revised: FileMeta;
  summary: {
    additions: number;
    deletions: number;
    modifications: number;
  };
  page_count_original: number;
  page_count_revised: number;
  pages: PageDiff[];
}
