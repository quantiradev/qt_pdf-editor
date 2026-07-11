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
  | "link";

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

export interface TextEditAnnot extends Base, Rect {
  type: "textedit";
  text: string;
  fontSize: number;
  fontFamily: "helv" | "tiro" | "cour";
  color: string;
  bold?: boolean;
  italic?: boolean;
  align?: "left" | "center" | "right";
  origX?: number;
  origY?: number;
  origW?: number;
  origH?: number;
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
  | TextEditAnnot
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

export interface TextBlock extends Rect {
  text: string;
  fontSize: number;
  fontFamily: "helv" | "tiro" | "cour";
  bold: boolean;
  italic: boolean;
  color: string;
  origX?: number;
  origY?: number;
  origW?: number;
  origH?: number;
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
