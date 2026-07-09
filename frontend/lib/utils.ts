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

export const HIGHLIGHT_COLORS = ["#ffd400", "#ff7ac2", "#4ade80", "#60a5fa", "#fb923c"];
export const STROKE_COLORS = ["#e11d48", "#2563eb", "#16a34a", "#f59e0b", "#111111", "#ffffff"];
export const TEXT_COLORS = ["#111111", "#e11d48", "#2563eb", "#16a34a", "#f59e0b", "#ffffff"];
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
