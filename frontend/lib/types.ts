export type Tool =
  | "select"
  | "edit-text"
  | "text"
  | "highlight"
  | "underline"
  | "strikeout"
  | "pen"
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
  fontFamily: "helv" | "tiro" | "cour";
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
  fontFamily: "helv" | "tiro" | "cour";
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
  fontFamily: "helv" | "tiro" | "cour";
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

export interface ToolOpts {
  color: string; // pen / shape stroke
  fillColor: string | null;
  strokeWidth: number;
  opacity: number;
  highlightColor: string;
  fontSize: number;
  fontFamily: "helv" | "tiro" | "cour";
  fontColor: string;
  bold: boolean;
  italic: boolean;
  align: "left" | "center" | "right";
  noteColor: string;
}
