export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export function snapTo(v: number, grid: number, on: boolean): number {
  return on ? Math.round(v / grid) * grid : v;
}

export function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function fmtDate(ts: number): string {
  const d = new Date(ts * 1000);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

/** Parse "1-3, 5" (1-based) into 0-based indices; throws on nonsense. */
export function parseRanges(spec: string, pageCount: number): number[] {
  const out: number[] = [];
  for (const raw of spec.split(",")) {
    const part = raw.trim();
    if (!part) continue;
    const m = part.match(/^(\d*)\s*-\s*(\d*)$/);
    if (m) {
      const start = m[1] ? parseInt(m[1], 10) : 1;
      const end = m[2] ? parseInt(m[2], 10) : pageCount;
      for (let p = start; p <= end; p++) {
        const i = p - 1;
        if (i >= 0 && i < pageCount && !out.includes(i)) out.push(i);
      }
    } else if (/^\d+$/.test(part)) {
      const i = parseInt(part, 10) - 1;
      if (i >= 0 && i < pageCount && !out.includes(i)) out.push(i);
    } else {
      throw new Error(`Cannot read "${part}"`);
    }
  }
  if (!out.length) throw new Error("Empty page range");
  return out;
}

export function downloadBlob(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export const FONT_CSS: Record<string, string> = {
  helv: "Arial, Helvetica, sans-serif",
  tiro: '"Times New Roman", Times, serif',
  cour: '"Courier New", Courier, monospace',
};

/** The three PDF core families the backend can always render without a download. */
export const BASE_FONTS = [
  { value: "helv", label: "Helvetica" },
  { value: "tiro", label: "Times" },
  { value: "cour", label: "Courier" },
];

const loaded = new Set<string>();

/**
 * Pull a Google family's webfont into the page so the overlay previews the
 * same face the bake will embed. No-op for the Base-14 aliases.
 */
export function ensureFont(family: string) {
  if (typeof document === "undefined") return;
  if (!family || FONT_CSS[family] || loaded.has(family)) return;
  loaded.add(family);
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href =
    `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}` +
    ":ital,wght@0,400;0,700;1,400;1,700&display=swap";
  document.head.appendChild(link);
}

/** CSS font-family for an annot's family: Base-14 alias or a Google family. */
export function fontCss(family: string): string {
  if (!family) return FONT_CSS.helv;
  if (FONT_CSS[family]) return FONT_CSS[family];
  ensureFont(family);
  return `"${family}", ${FONT_CSS.helv}`;
}

/**
 * Palettes are laid out 10-per-row in the picker. The first entries of
 * HIGHLIGHT_COLORS are load-bearing: the Properties panel takes
 * `HIGHLIGHT_COLORS.slice(0, 4)` as the sticky-note colours, so those four
 * stay put. Any colour outside these grids is reachable via the picker's
 * native "More…" swatch.
 */
export const HIGHLIGHT_COLORS = [
  // the original five stay first (notes slice off the front)
  "#ffd400", "#ff7ac2", "#4ade80", "#60a5fa", "#fb923c",
  "#ffff00", "#fde047", "#fbbf24", "#a3e635", "#34d399",
  "#22d3ee", "#38bdf8", "#818cf8", "#c084fc", "#e879f9",
  "#fb7185", "#f87171", "#d9f99d", "#bae6fd", "#ddd6fe",
];

export const STROKE_COLORS = [
  "#e11d48", "#2563eb", "#16a34a", "#f59e0b", "#111111", "#ffffff",
  "#7c3aed", "#0d9488", "#ea580c", "#db2777", "#0ea5e9", "#65a30d",
  "#991b1b", "#1e3a8a", "#14532d", "#78350f", "#404040", "#a6a6a6",
];

export const TEXT_COLORS = [
  // neutrals
  "#000000", "#262626", "#404040", "#595959", "#737373",
  "#8c8c8c", "#a6a6a6", "#bfbfbf", "#d9d9d9", "#ffffff",
  // brights
  "#c00000", "#e11d48", "#ea580c", "#f59e0b", "#eab308",
  "#65a30d", "#16a34a", "#0d9488", "#0284c7", "#2563eb",
  // deeps
  "#4f46e5", "#7c3aed", "#9333ea", "#c026d3", "#db2777",
  "#831843", "#78350f", "#14532d", "#1e3a8a", "#111827",
];
export const NOTE_COLORS = ["#ffd400", "#ff7ac2", "#4ade80", "#60a5fa"];

export const GRID_SIZE = 16; // pt
export const SNAP_SIZE = 8; // pt

/** Smooth freehand points into an SVG path via quadratic midpoints. */
export function pointsToPath(pts: [number, number][]): string {
  if (pts.length < 2) return "";
  let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2;
    const my = (pts[i][1] + pts[i + 1][1]) / 2;
    d += ` Q ${pts[i][0].toFixed(1)} ${pts[i][1].toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)}`;
  }
  const last = pts[pts.length - 1];
  d += ` L ${last[0].toFixed(1)} ${last[1].toFixed(1)}`;
  return d;
}

export function inkBBox(pts: [number, number][], pad = 4) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) {
    x0 = Math.min(x0, x); y0 = Math.min(y0, y);
    x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  return { x: x0 - pad, y: y0 - pad, w: x1 - x0 + pad * 2, h: y1 - y0 + pad * 2 };
}
