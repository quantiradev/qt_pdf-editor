"""Paragraph-accurate text editing engine.

Extraction:  page text -> visual lines (baseline-merged) -> paragraphs with
             alignment, leading, hanging indent and style runs.
Application: tight per-line redaction (no neighbour bleed) followed by a
             word-by-word re-layout inside the paragraph box using the
             document's own embedded fonts whenever they cover the new text.

Everything is in PDF points, top-left origin (same convention as pdf_ops).
"""
import hashlib
import os
import re
import threading
from dataclasses import dataclass, field
from pathlib import Path

import fitz  # PyMuPDF

# ---------------------------------------------------------------- constants

BASE14 = {
    ("sans", False, False): "helv", ("sans", True, False): "hebo",
    ("sans", False, True): "heit", ("sans", True, True): "hebi",
    ("serif", False, False): "tiro", ("serif", True, False): "tibo",
    ("serif", False, True): "tiit", ("serif", True, True): "tibi",
    ("mono", False, False): "cour", ("mono", True, False): "cobo",
    ("mono", False, True): "coit", ("mono", True, True): "cobi",
}

# CSS-ish class used by the frontend overlay
FAMILY_CSS = {"sans": "helv", "serif": "tiro", "mono": "cour"}

BULLET_RE = re.compile(r"^(?:[•‣▪●◦⁃∙\-\*·]|"
                       r"[0-9]{1,3}[.)]|[a-zA-Z][.)]|[ivxIVX]{1,5}[.)])$")

_JOIN_GAP_FACTOR = 0.45      # gaps wider than this * size get a space on join
_SAME_LINE_TOL = 0.40        # baseline delta tolerance, * size
_CROSS_BLOCK_GAP = 2.6       # max horizontal gap for same-line block merge, * size
_PARA_GAP_FACTOR = 1.65      # vertical split when baseline delta exceeds * leading
_REDACT_INSET_V = 0.75       # pt shaved off line rect top+bottom before redacting
_MIN_SIZE = 4.0


def _flags_style(font: str, flags: int) -> tuple[str, bool, bool]:
    f = font.lower()
    mono = bool(flags & 8) or "mono" in f or "courier" in f or "consol" in f
    serif = (bool(flags & 4) and "arial" not in f and "calibri" not in f) \
        or "times" in f or "georgia" in f or "garamond" in f or "book" in f
    bold = bool(flags & 16) or "bold" in f or "black" in f or "heavy" in f
    italic = bool(flags & 2) or "italic" in f or "oblique" in f
    fam = "mono" if mono else ("serif" if serif else "sans")
    return fam, bold, italic


def _srgb_hex(color: int) -> str:
    return "#{:06x}".format(color if isinstance(color, int) else 0)


def _hex_rgb(value: str) -> tuple:
    try:
        v = value.lstrip("#")
        return tuple(int(v[i:i + 2], 16) / 255 for i in (0, 2, 4))
    except Exception:
        return (0, 0, 0)


# ---------------------------------------------------------------- system fonts

_sys_index: dict[str, str] | None = None
_sys_lock = threading.Lock()


def _norm_font_name(name: str) -> str:
    return re.sub(r"[^a-z0-9]", "", name.lower())


def _system_font_index() -> dict[str, str]:
    """Map of normalised font name -> file path, built once per process.

    Lets edits fall back to the machine's installed fonts (e.g. full Calibri)
    when a subset embedded font is missing glyphs for the new text.
    """
    global _sys_index
    if _sys_index is not None:
        return _sys_index
    with _sys_lock:
        if _sys_index is not None:
            return _sys_index
        index: dict[str, str] = {}
        dirs = []
        windir = os.environ.get("WINDIR", r"C:\Windows")
        dirs.append(Path(windir) / "Fonts")
        local = os.environ.get("LOCALAPPDATA")
        if local:
            dirs.append(Path(local) / "Microsoft" / "Windows" / "Fonts")
        for d in dirs:
            if not d.is_dir():
                continue
            for f in d.iterdir():
                if f.suffix.lower() not in (".ttf", ".otf", ".ttc"):
                    continue
                try:
                    font = fitz.Font(fontfile=str(f))
                    key = _norm_font_name(font.name)
                    index.setdefault(key, str(f))
                except Exception:
                    continue
        _sys_index = index
        return index


def _system_lookup(span_font: str, flags: int) -> str | None:
    """Best system-font file for a span font name + style flags."""
    idx = _system_font_index()
    base = _norm_font_name(span_font)
    fam, bold, italic = _flags_style(span_font, flags)
    candidates = [base]
    stripped = re.sub(r"(bold|italic|oblique|regular|mt|ps)", "", base)
    style = ("bolditalic" if bold and italic else
             "bold" if bold else "italic" if italic else "")
    if style and not base.endswith(style):
        candidates.append(stripped + style)
    if stripped != base:
        candidates.append(stripped + style if style else stripped)
    for c in candidates:
        if c in idx:
            return idx[c]
    return None


# ---------------------------------------------------------------- font pool

class FontPool:
    """Embedded-font access for one open document.

    For each span font name we try to locate the embedded font program so new
    text keeps the original typeface. A font is only reused when it actually
    contains glyphs for every character we need; otherwise we fall back to the
    metrically closest Base-14 face.
    """

    def __init__(self, doc: fitz.Document):
        self.doc = doc
        self._by_name: dict[str, fitz.Font | None] = {}
        self._buffers: dict[str, bytes] = {}
        self._sys_fonts: dict[str, fitz.Font | None] = {}
        self._aliases: dict[tuple[int, str], str] = {}  # (page.xref, source) -> alias
        self._page_fonts: dict[int, list] = {}
        self._page_chars: dict[int, set[str]] = {}
        self._alias_n = 0
        self.embedded_new_font = False  # a full system font went in -> subset on save

    def _fonts_on_page(self, page: fitz.Page) -> list:
        if page.number not in self._page_fonts:
            try:
                self._page_fonts[page.number] = page.get_fonts(full=False)
            except Exception:
                self._page_fonts[page.number] = []
        return self._page_fonts[page.number]

    def _load(self, page: fitz.Page, span_font: str) -> fitz.Font | None:
        """fitz.Font for the embedded program behind a span font name."""
        if span_font in self._by_name:
            return self._by_name[span_font]
        found = None
        for xref, ext, ftype, basefont, *_ in self._fonts_on_page(page):
            base = basefont.split("+", 1)[-1]
            if base != span_font or ext in ("n/a", ""):
                continue
            try:
                name, fext, ftype2, buf = self.doc.extract_font(xref)
                if not buf:
                    continue
                font = fitz.Font(fontbuffer=buf)
                self._buffers[span_font] = buf
                found = font
                break
            except Exception:
                continue
        self._by_name[span_font] = found
        return found

    def _ensure_alias(self, page: fitz.Page, source: str, *,
                      fontbuffer: bytes | None = None,
                      fontfile: str | None = None) -> str:
        key = (page.xref, source)
        if key not in self._aliases:
            self._alias_n += 1
            alias = f"PFedit{self._alias_n}"
            try:
                page.insert_font(fontname=alias, fontbuffer=fontbuffer,
                                 fontfile=fontfile)
                self._aliases[key] = alias
            except Exception:
                self._aliases[key] = ""
        return self._aliases[key]

    def resolve(self, page: fitz.Page, span_font: str, flags: int,
                needed: str) -> tuple[str, fitz.Font]:
        """(insert_text fontname, measuring Font) for a style + needed chars.

        Preference order: the document's own embedded font, then a matching
        installed system font, then the closest Base-14 face.
        """
        chars = {c for c in needed if not c.isspace()}

        def covers(f: fitz.Font) -> bool:
            return all(f.has_glyph(ord(c)) for c in chars)

        # Check if the embedded font on the page is subsetted (has '+' prefix)
        is_subset = False
        for xref, ext, ftype, basefont, *_ in self._fonts_on_page(page):
            base = basefont.split("+", 1)[-1]
            if base == span_font:
                if "+" in basefont:
                    is_subset = True
                break

        # Extract all non-space characters from the original page text to check glyph coverage
        if page.number not in self._page_chars:
            try:
                self._page_chars[page.number] = {c for c in page.get_text() if not c.isspace()}
            except Exception:
                self._page_chars[page.number] = set()
        allowed_chars = self._page_chars[page.number]

        font = self._load(page, span_font)
        # We can only use the embedded font if it reports that it has the glyphs, AND
        # either it is not a subset font, or all the requested characters were already
        # present in the original page text (meaning their visual glyph data is guaranteed to exist).
        use_embedded = False
        if font is not None and covers(font):
            if not is_subset:
                use_embedded = True
            elif chars.issubset(allowed_chars):
                use_embedded = True

        if use_embedded and font is not None:
            alias = self._ensure_alias(page, "emb:" + span_font,
                                       fontbuffer=self._buffers[span_font])
            if alias:
                return alias, font

        if span_font not in self._sys_fonts:
            path = _system_lookup(span_font, flags)
            try:
                self._sys_fonts[span_font] = fitz.Font(fontfile=path) if path else None
                if path:
                    self._sys_paths = getattr(self, "_sys_paths", {})
                    self._sys_paths[span_font] = path
            except Exception:
                self._sys_fonts[span_font] = None
        sfont = self._sys_fonts.get(span_font)
        if sfont is not None and covers(sfont):
            alias = self._ensure_alias(page, "sys:" + span_font,
                                       fontfile=self._sys_paths[span_font])
            if alias:
                self.embedded_new_font = True
                return alias, sfont

        fam, bold, italic = _flags_style(span_font, flags)
        name = BASE14[(fam, bold, italic)]
        return name, fitz.Font(name)

    def page_redacted(self, page: fitz.Page):
        """Forget this page's font aliases after apply_redactions.

        Redaction rebuilds the page's content and drops every font resource
        the remaining content does not reference — which is always true for
        a just-inserted alias that no text uses yet. Clearing the cache makes
        the next resolve() re-embed the font from its buffer/file instead of
        handing out a dangling name ("need font file or buffer").
        """
        self._aliases = {k: v for k, v in self._aliases.items()
                         if k[0] != page.xref}
        self._page_fonts.pop(page.number, None)

    def finalize(self):
        """Subset any newly embedded full fonts to keep the file small."""
        if self.embedded_new_font:
            try:
                self.doc.subset_fonts()
            except Exception:
                pass


# ---------------------------------------------------------------- extraction

@dataclass
class Run:
    text: str
    font: str          # span font name as reported by MuPDF
    size: float
    color: int
    flags: int
    x: float | None = None  # origin x of the source span (None for synthetic runs)


@dataclass
class VLine:
    """One visual text line (baseline-merged)."""
    x0: float
    y0: float
    x1: float
    y1: float
    baseline: float
    runs: list[Run] = field(default_factory=list)

    @property
    def text(self) -> str:
        return "".join(r.text for r in self.runs)


@dataclass
class Paragraph:
    page: int
    lines: list[VLine]
    align: str = "left"
    leading: float = 0.0
    hang: float = 0.0          # body indent minus first-line start (>=0)
    editable: bool = True

    @property
    def bbox(self) -> fitz.Rect:
        r = fitz.Rect(self.lines[0].x0, self.lines[0].y0,
                      self.lines[0].x1, self.lines[0].y1)
        for l in self.lines[1:]:
            r |= fitz.Rect(l.x0, l.y0, l.x1, l.y1)
        return r

    def runs_flat(self) -> list[Run]:
        """Paragraph text as style runs; lines joined with single spaces."""
        out: list[Run] = []
        for i, line in enumerate(self.lines):
            for r in line.runs:
                if out and _same_style(out[-1], r):
                    out[-1].text += r.text
                else:
                    out.append(Run(r.text, r.font, r.size, r.color, r.flags))
            if i < len(self.lines) - 1:
                if out and out[-1].text.endswith("-") and len(out[-1].text) > 1:
                    out[-1].text = out[-1].text[:-1]      # de-hyphenate wraps
                elif out and not out[-1].text.endswith(" "):
                    out[-1].text += " "
        # normalise runaway whitespace
        for r in out:
            r.text = re.sub(r"[ \t ]+", " ", r.text)
        return [r for r in out if r.text]

    @property
    def text(self) -> str:
        return "".join(r.text for r in self.runs_flat()).strip()

    def dominant(self) -> Run:
        best, best_len = None, -1
        for r in self.runs_flat():
            if len(r.text) > best_len:
                best, best_len = r, len(r.text)
        return best or Run("", "", 12.0, 0, 0)

    @property
    def id(self) -> str:
        b = self.bbox
        key = f"{self.page}:{round(b.x0)}:{round(b.y0)}:{round(b.x1)}:{round(b.y1)}:{self.text[:60]}"
        return hashlib.sha1(key.encode("utf-8", "replace")).hexdigest()[:12]


def _same_style(a: Run, b: Run) -> bool:
    return (a.font == b.font and abs(a.size - b.size) < 0.05
            and a.color == b.color and (a.flags & 0b11010) == (b.flags & 0b11010))


def _visual_lines(block: dict) -> list[VLine]:
    """Merge MuPDF lines that share a baseline into visual lines."""
    raw = []
    for line in block.get("lines", []):
        if abs(line.get("dir", (1, 0))[0] - 1) > 0.01 or abs(line.get("dir", (1, 0))[1]) > 0.01:
            return []  # rotated / vertical text: leave the block alone
        spans = [s for s in line.get("spans", []) if s.get("text")]
        if not spans:
            continue
        x0, y0, x1, y1 = line["bbox"]
        baseline = spans[0]["origin"][1]
        raw.append((x0, y0, x1, y1, baseline, spans))
    raw.sort(key=lambda t: (round(t[4], 1), t[0]))

    merged: list[VLine] = []
    for x0, y0, x1, y1, baseline, spans in raw:
        size = max(s["size"] for s in spans)
        target = None
        if merged:
            prev = merged[-1]
            if abs(prev.baseline - baseline) <= _SAME_LINE_TOL * max(size, 6):
                target = prev
        if target is None:
            target = VLine(x0, y0, x1, y1, baseline)
            merged.append(target)
        else:
            gap = x0 - target.x1
            if gap > _JOIN_GAP_FACTOR * size and target.runs \
                    and not target.runs[-1].text.endswith(" "):
                target.runs.append(Run(" ", spans[0]["font"], size,
                                       spans[0]["color"], spans[0]["flags"]))
            target.x0 = min(target.x0, x0)
            target.x1 = max(target.x1, x1)
            target.y0 = min(target.y0, y0)
            target.y1 = max(target.y1, y1)
        for s in spans:
            target.runs.append(Run(s["text"], s["font"], s["size"],
                                   s["color"], s["flags"], s["origin"][0]))
    return merged


def _split_into_paragraphs(pno: int, vlines: list[VLine]) -> list[Paragraph]:
    """Group a block's visual lines into paragraphs on leading/size jumps."""
    paras: list[Paragraph] = []
    cur: list[VLine] = []
    prev_baseline = None
    prev_size = None
    leadings: list[float] = []

    def flush():
        nonlocal cur, leadings
        if cur:
            paras.append(_finish_paragraph(pno, cur, leadings))
        cur, leadings = [], []

    for vl in vlines:
        size = max(r.size for r in vl.runs)
        if cur:
            delta = vl.baseline - prev_baseline
            ref = leadings[-1] if leadings else size * 1.45
            size_jump = prev_size and (size > prev_size * 1.25 or size < prev_size * 0.75)
            if delta <= 0 or delta > ref * _PARA_GAP_FACTOR or size_jump:
                flush()
            else:
                leadings.append(delta)
        cur.append(vl)
        prev_baseline = vl.baseline
        prev_size = size
    flush()
    return paras


def _finish_paragraph(pno: int, lines: list[VLine], leadings: list[float]) -> Paragraph:
    p = Paragraph(pno, lines)
    sizes = [max(r.size for r in l.runs) for l in lines]
    dom_size = max(sizes)
    p.leading = (sorted(leadings)[len(leadings) // 2] if leadings
                 else dom_size * 1.22)

    # hanging indent: continuation lines start right of the first line
    if len(lines) > 1:
        body_x0 = min(l.x0 for l in lines[1:])
        if body_x0 - lines[0].x0 > 2.0:
            p.hang = body_x0 - lines[0].x0
    else:
        # single line beginning with a list marker: infer the hang from the
        # gap between the marker and the following text
        runs = lines[0].runs
        if runs and BULLET_RE.match(runs[0].text.strip()) and len(runs) > 1:
            p.hang = 0.0  # keep simple; wrap will use full width

    # alignment
    b = p.bbox
    if len(lines) > 1:
        rights = [l.x1 for l in lines[:-1]]
        lefts = [l.x0 for l in lines[1:]] or [lines[0].x0]
        r_spread = max(rights) - min(rights)
        l_spread = max(lefts) - min(lefts)
        if r_spread < 2.0 and l_spread < 2.0 and (b.x1 - lines[-1].x1) > dom_size:
            p.align = "justify"
        elif l_spread < 2.0:
            p.align = "left"
        elif r_spread < 2.0:
            p.align = "right"
        else:
            centers = [(l.x0 + l.x1) / 2 for l in lines]
            p.align = "center" if max(centers) - min(centers) < 3.0 else "left"
    return p


def extract_paragraphs(doc: fitz.Document, pno: int) -> list[Paragraph]:
    page = doc[pno]
    d = page.get_text("dict")
    blocks = [b for b in d.get("blocks", []) if b.get("type") == 0]

    paras: list[Paragraph] = []
    for block in blocks:
        vlines = _visual_lines(block)
        if not vlines:
            continue
        paras.extend(_split_into_paragraphs(pno, vlines))

    # merge cross-block same-baseline fragments (markers or split words that
    # ended up in their own block)
    paras.sort(key=lambda p: (round(p.lines[0].baseline, 1), p.bbox.x0))
    merged: list[Paragraph] = []
    for p in paras:
        if merged:
            prev = merged[-1]
            if (len(prev.lines) == 1 and len(p.lines) >= 1
                    and abs(prev.lines[0].baseline - p.lines[0].baseline)
                    <= _SAME_LINE_TOL * prev.dominant().size
                    and 0 <= p.lines[0].x0 - prev.lines[0].x1
                    <= _CROSS_BLOCK_GAP * prev.dominant().size):
                first = p.lines[0]
                gap = first.x0 - prev.lines[0].x1
                joiner = prev.lines[0].runs
                if gap > _JOIN_GAP_FACTOR * prev.dominant().size and joiner \
                        and not joiner[-1].text.endswith(" "):
                    joiner.append(Run(" ", joiner[-1].font, joiner[-1].size,
                                      joiner[-1].color, joiner[-1].flags))
                joiner.extend(first.runs)
                prev.lines[0].x1 = max(prev.lines[0].x1, first.x1)
                prev.lines[0].y0 = min(prev.lines[0].y0, first.y0)
                prev.lines[0].y1 = max(prev.lines[0].y1, first.y1)
                if len(p.lines) > 1:
                    prev.lines.extend(p.lines[1:])
                    rebuilt = _finish_paragraph(p.page, prev.lines, [])
                    merged[-1] = rebuilt
                continue
        merged.append(p)
    # restore reading order
    merged.sort(key=lambda p: (round(p.bbox.y0, 1), p.bbox.x0))
    return merged


def paragraphs_public(doc: fitz.Document, pno: int) -> list[dict]:
    """Wire format for the frontend overlay."""
    out = []
    for p in extract_paragraphs(doc, pno):
        b = p.bbox
        dom = p.dominant()
        fam, bold, italic = _flags_style(dom.font, dom.flags)
        out.append({
            "id": p.id,
            "x": b.x0, "y": b.y0, "w": b.width, "h": b.height,
            "text": p.text,
            "align": p.align,
            "leading": p.leading,
            "fontSize": round(dom.size, 2),
            "fontFamily": FAMILY_CSS[fam],
            "bold": bold, "italic": italic,
            "color": _srgb_hex(dom.color),
            "lines": len(p.lines),
            "editable": p.editable,
        })
    return out


# ---------------------------------------------------------------- application

def _map_runs(old_runs: list[Run], new_text: str) -> list[Run]:
    """Carry style runs across a plain-text edit via prefix/suffix diff."""
    old_text = "".join(r.text for r in old_runs)
    if not old_runs:
        return []
    if old_text == new_text:
        return old_runs
    p = 0
    limit = min(len(old_text), len(new_text))
    while p < limit and old_text[p] == new_text[p]:
        p += 1
    s = 0
    while (s < limit - p
           and old_text[len(old_text) - 1 - s] == new_text[len(new_text) - 1 - s]):
        s += 1

    def style_at(pos: int) -> Run:
        acc = 0
        for r in old_runs:
            acc += len(r.text)
            if pos < acc:
                return r
        return old_runs[-1]

    out: list[Run] = []

    def emit(text: str, proto: Run):
        if not text:
            return
        if out and _same_style(out[-1], proto):
            out[-1].text += text
        else:
            out.append(Run(text, proto.font, proto.size, proto.color, proto.flags))

    # prefix: original styles
    acc = 0
    for r in old_runs:
        take = min(len(r.text), p - acc)
        if take > 0:
            emit(r.text[:take], r)
        acc += len(r.text)
        if acc >= p:
            break
    # middle: style at the edit point
    mid = new_text[p:len(new_text) - s]
    emit(mid, style_at(max(0, p - 1) if p else 0))
    # suffix: original styles
    acc = 0
    for r in old_runs:
        r_start, r_end = acc, acc + len(r.text)
        acc = r_end
        lo = max(r_start, len(old_text) - s)
        if lo < r_end:
            emit(r.text[lo - r_start:], r)
    return [r for r in out if r.text]


@dataclass
class _Seg:
    text: str
    run: Run
    fontname: str
    mfont: fitz.Font
    width: float


@dataclass
class _Word:
    """A whitespace-delimited word; may span style runs (e.g. bold 'PM' + '.')."""
    segs: list[_Seg]
    width: float
    space: float

    @property
    def text(self) -> str:
        return "".join(s.text for s in self.segs)


def _layout_words(words: list[_Word], first_avail: float, body_avail: float
                  ) -> list[list[_Word]]:
    lines: list[list[_Word]] = []
    cur: list[_Word] = []
    cur_w = 0.0
    avail = first_avail
    for w in words:
        add = w.width if not cur else w.space + w.width
        if cur and cur_w + add > avail + 0.5:
            lines.append(cur)
            cur, cur_w = [w], w.width
            avail = body_avail
        else:
            cur.append(w)
            cur_w += add
        # a single word wider than the line gets its own line (no char split)
    if cur:
        lines.append(cur)
    return lines


# ---------------------------------------------------------------- reflow

_FOOTER_ZONE = 36.0      # pt above the page bottom treated as fixed footer
_MIN_MARGIN = 36.0       # clamp for the inferred bottom margin
_MAX_MARGIN = 90.0
_MAX_FLOW_PAGES = 100    # hard stop for pathological cascades


@dataclass
class _Piece:
    """One absolutely positioned run of text inside a line."""
    x: float
    text: str
    font: str            # span font name — resolved per target page at draw
    flags: int
    size: float
    color: int
    needed: str | None = None  # glyph set used when the font was chosen


@dataclass
class _LineOp:
    """A text line to draw at a (possibly shifted) baseline."""
    pieces: list[_Piece]
    baseline: float
    height: float
    leading: float


def _style_key(r: Run) -> tuple:
    return (r.font, r.flags & 0b11010, round(r.size, 2))


def _line_rect(vl: VLine) -> fitz.Rect:
    """Tight redaction rect for one visual line (no neighbour bleed)."""
    h = vl.y1 - vl.y0
    inset = min(_REDACT_INSET_V, h * 0.18)
    return fitz.Rect(vl.x0 - 0.25, vl.y0 + inset, vl.x1 + 0.35, vl.y1 - inset)


def _line_pieces(vl: VLine) -> list[_Piece]:
    """Faithful redraw ops for an existing line: each span at its own x."""
    return [_Piece(r.x, r.text, r.font, r.flags, r.size, r.color)
            for r in vl.runs if r.x is not None and r.text]


def _apply_redactions(page: fitz.Page, rects: list[fitz.Rect],
                      pool: FontPool):
    added = False
    for r in rects:
        if not r.is_empty:
            page.add_redact_annot(r)
            added = True
    if not added:
        return
    try:
        page.apply_redactions(images=fitz.PDF_REDACT_IMAGE_NONE,
                              graphics=fitz.PDF_REDACT_LINE_ART_NONE)
    except TypeError:
        page.apply_redactions(images=fitz.PDF_REDACT_IMAGE_NONE)
    # redaction rebuilt the page resources: previously inserted font
    # aliases are gone and must be re-embedded before drawing
    pool.page_redacted(page)


def _draw_ops(page: fitz.Page, ops: list[_LineOp], pool: FontPool,
              morph: tuple | None = None):
    """Draw line ops; `morph=(pivot, matrix)` rotates them as one unit."""
    for op in ops:
        for pc in op.pieces:
            if not pc.text or pc.text.isspace():
                continue
            fname, _ = pool.resolve(page, pc.font, pc.flags,
                                    pc.needed or pc.text)
            page.insert_text(fitz.Point(pc.x, op.baseline), pc.text,
                             fontname=fname, fontsize=max(_MIN_SIZE, pc.size),
                             color=_hex_rgb(_srgb_hex(pc.color)),
                             morph=morph)


def _page_metrics(page: fitz.Page,
                  paras: list[Paragraph]) -> tuple[list[Paragraph], float, float]:
    """(body paragraphs, top text margin, lowest allowed baseline).

    Paragraphs starting inside the footer zone are fixed (page numbers etc.).
    The bottom limit is the inferred margin, extended to wherever the page's
    text already reaches so an untouched-but-tight page never overflows.
    """
    page_h = page.rect.height
    body = [p for p in paras
            if p.lines[0].baseline <= page_h - _FOOTER_ZONE]
    tops = [l.y0 for p in body for l in p.lines]
    top_m = min(tops) if tops else 72.0
    limit = page_h - max(_MIN_MARGIN, min(_MAX_MARGIN, top_m))
    baselines = [l.baseline for p in body for l in p.lines]
    if baselines:
        limit = max(limit, max(baselines) + 0.5)
    return body, top_m, limit


def _measure_words(page: fitz.Page, runs: list[Run], pool: FontPool
                   ) -> tuple[list[_Word], dict[tuple, str],
                              dict[tuple, tuple[str, fitz.Font]]]:
    """(words with measured widths, glyphs needed per style, resolved fonts).
    A word may span style runs (e.g. bold 'PM' + plain '.')."""
    needed_by_style: dict[tuple, str] = {}
    for r in runs:
        key = _style_key(r)
        needed_by_style[key] = needed_by_style.get(key, "") + r.text

    resolved: dict[tuple, tuple[str, fitz.Font]] = {}
    for r in runs:
        key = _style_key(r)
        if key not in resolved:
            resolved[key] = pool.resolve(page, r.font, r.flags,
                                         needed_by_style[key])

    words: list[_Word] = []
    open_word: _Word | None = None
    for r in runs:
        fontname, mfont = resolved[_style_key(r)]
        space_w = mfont.text_length(" ", fontsize=r.size) or r.size * 0.25
        for i, tok in enumerate(r.text.split(" ")):
            if i > 0:
                open_word = None  # the space ended the previous word
            if not tok:
                continue
            seg = _Seg(tok, r, fontname, mfont,
                       mfont.text_length(tok, fontsize=r.size))
            if open_word is None:
                open_word = _Word([seg], seg.width, space_w)
                words.append(open_word)
            else:
                open_word.segs.append(seg)
                open_word.width += seg.width
    return words, needed_by_style, resolved


def _build_edit_ops(page: fitz.Page, p: Paragraph, new_text: str,
                    pool: FontPool, shift: float) -> tuple[list[_LineOp], float]:
    """Line ops for one rewritten paragraph (baselines pre-shifted by `shift`)
    and its vertical growth in points (negative when the text shrank)."""
    new_text = re.sub(r"\s+", " ", new_text).strip()
    if not new_text:
        return [], -len(p.lines) * p.leading  # paragraph deleted
    runs = _map_runs(p.runs_flat(), new_text)
    if not runs:
        return [], 0.0

    words, needed_by_style, resolved = _measure_words(page, runs, pool)
    if not words:
        return [], 0.0

    # a detected list marker keeps its tab stop: it is drawn at the
    # paragraph's left edge and the body text is laid out from body_x,
    # exactly like the original hanging indent
    first_x = p.lines[0].x0
    body_x = min((l.x0 for l in p.lines[1:]), default=first_x)
    marker: _Word | None = None
    if body_x - first_x > 2.0 and BULLET_RE.match(words[0].text):
        marker = words[0]
        words = words[1:]
    if not words:
        words, marker = ([marker] if marker else []), None
    if not words:
        return [], 0.0

    b = p.bbox
    right = b.x1 + max(1.5, p.dominant().size * 0.05)
    first_start = body_x if marker else first_x
    first_avail = right - first_start
    body_avail = right - body_x
    lines = _layout_words(words, first_avail, body_avail)

    def piece(seg: _Seg, x: float) -> _Piece:
        return _Piece(x, seg.text, seg.run.font, seg.run.flags, seg.run.size,
                      seg.run.color, needed_by_style[_style_key(seg.run)])

    ops: list[_LineOp] = []
    height = p.dominant().size * 1.2
    base0 = p.lines[0].baseline + shift
    for li, line in enumerate(lines):
        pieces: list[_Piece] = []
        if li == 0 and marker:
            x = first_x
            for seg in marker.segs:
                pieces.append(piece(seg, x))
                x += seg.width
        x_start = first_start if li == 0 else body_x
        avail = first_avail if li == 0 else body_avail
        natural = sum(w.width for w in line) + sum(w.space for w in line[1:])
        extra = 0.0
        if p.align == "justify" and li < len(lines) - 1 and len(line) > 1:
            extra = max(0.0, (avail - natural) / (len(line) - 1))
        elif p.align == "center":
            x_start += max(0.0, (avail - natural) / 2)
        elif p.align == "right":
            x_start += max(0.0, avail - natural)

        x = x_start
        for wi, w in enumerate(line):
            if wi > 0:
                x += w.space + extra
            for seg in w.segs:
                pieces.append(piece(seg, x))
                x += seg.width
        ops.append(_LineOp(pieces, base0 + li * p.leading, height, p.leading))
    return ops, (len(lines) - len(p.lines)) * p.leading


def _flow_into(doc: fitz.Document, pno: int, incoming: list[_LineOp],
               pool: FontPool, top_hint: float) -> list[_LineOp]:
    """Insert overflow lines at the top of page `pno` (created when past the
    end), shift that page's body text down, and return what overflows it."""
    if pno >= doc.page_count:
        prev = doc[doc.page_count - 1].rect
        doc.new_page(-1, width=prev.width, height=prev.height)
    page = doc[pno]
    body, top_m, bottom_limit = _page_metrics(page, extract_paragraphs(doc, pno))
    if not body:
        top_m = top_hint

    # incoming lines land where the page's text currently starts, keeping
    # their relative spacing; existing body text moves below them
    baselines = [l.baseline for p in body for l in p.lines]
    first_baseline = min(baselines) if baselines else None
    start = first_baseline if first_baseline is not None \
        else top_m + incoming[0].height
    shift_in = start - incoming[0].baseline
    for op in incoming:
        op.baseline += shift_in

    redact: list[fitz.Rect] = []
    ops = list(incoming)
    if body:
        delta = (incoming[-1].baseline + incoming[-1].leading) - first_baseline
        for p in sorted(body, key=lambda q: (q.lines[0].baseline, q.bbox.x0)):
            for vl in p.lines:
                redact.append(_line_rect(vl))
                pieces = _line_pieces(vl)
                if pieces:
                    ops.append(_LineOp(pieces, vl.baseline + delta,
                                       vl.y1 - vl.y0, p.leading))

    stay = [op for op in ops if op.baseline <= bottom_limit]
    spill = [op for op in ops if op.baseline > bottom_limit]
    if not stay:  # page cannot hold even one line: park everything here
        stay, spill = ops, []
    _apply_redactions(page, redact, pool)
    _draw_ops(page, stay, pool)
    return spill


def apply_paragraph_edits(doc: fitz.Document, pno: int,
                          edits: list[dict], pool: FontPool
                          ) -> tuple[list[str], set[int]]:
    """edits: [{"paraId": str, "text": str}] -> (warnings, changed pages).

    Full page reflow: when an edited paragraph gains lines, every body-text
    line below it shifts down by the growth; lines pushed past the bottom
    margin flow onto the next page (shifting that page's text in turn), and
    a new page is appended when the document runs out of room. Images,
    drawings and footer-zone text stay in place; shrinking text leaves a gap.
    """
    page = doc[pno]
    paras_all = extract_paragraphs(doc, pno)
    by_id = {p.id: p for p in paras_all}
    todo: dict[str, str] = {}
    for e in edits:
        p = by_id.get(e.get("paraId", ""))
        if p is None:
            raise ValueError("The text block changed on disk — reload and retry")
        todo[p.id] = str(e.get("text", ""))

    warnings: list[str] = []
    changed: set[int] = {pno}
    body, top_m, bottom_limit = _page_metrics(page, paras_all)
    body_ids = {p.id for p in body}

    redact: list[fitz.Rect] = []
    flow_ops: list[_LineOp] = []   # lines that take part in the reflow
    fixed_ops: list[_LineOp] = []  # footer-zone rewrites: drawn in place
    delta = 0.0
    for p in sorted(paras_all, key=lambda q: (q.lines[0].baseline, q.bbox.x0)):
        if p.id in todo:
            for vl in p.lines:
                redact.append(_line_rect(vl))
            in_body = p.id in body_ids
            ops, growth = _build_edit_ops(page, p, todo[p.id], pool,
                                          delta if in_body else 0.0)
            if in_body:
                flow_ops += ops
                delta += max(0.0, growth)
            else:
                fixed_ops += ops
                if growth > 0:
                    warnings.append(
                        f"Page {pno + 1}: edited footer text needs more "
                        f"lines and may overlap content below")
        elif delta > 0.01 and p.id in body_ids:
            # untouched paragraph below a grown edit: shift it down verbatim
            for vl in p.lines:
                redact.append(_line_rect(vl))
                pieces = _line_pieces(vl)
                if pieces:
                    flow_ops.append(_LineOp(pieces, vl.baseline + delta,
                                            vl.y1 - vl.y0, p.leading))

    stay = [op for op in flow_ops if op.baseline <= bottom_limit]
    spill = [op for op in flow_ops if op.baseline > bottom_limit]
    _apply_redactions(page, redact, pool)
    _draw_ops(page, stay + fixed_ops, pool)

    cur = pno
    first_flow: int | None = None
    while spill and cur - pno < _MAX_FLOW_PAGES:
        cur += 1
        if first_flow is None:
            first_flow = cur
        spill = _flow_into(doc, cur, spill, pool, top_m)
        changed.add(cur)
    if spill:  # cascade guard tripped: park the remainder on the last page
        _draw_ops(doc[cur], spill, pool)
    if first_flow is not None:
        tail = (f"pages {first_flow + 1}–{cur + 1}" if cur > first_flow
                else f"page {first_flow + 1}")
        warnings.append(
            f"Page {pno + 1}: edited text grew — content below reflowed "
            f"onto {tail}")
    return warnings, changed


# ---------------------------------------------------------------- block transforms

def _near_zero_angle(deg: float) -> bool:
    d = deg % 360.0
    return d < 0.05 or d > 359.95


def _build_box_ops(page: fitz.Page, p: Paragraph, new_text: str,
                   pool: FontPool, x: float, y: float, w: float
                   ) -> list[_LineOp]:
    """Wrap `new_text` (styles carried over from the paragraph) into a box of
    width `w` whose top-left is (x, y). Baselines follow the paragraph's own
    leading using the CSS line-box model (half-leading), so the bake matches
    the editor's HTML overlay line for line."""
    new_text = re.sub(r"\s+", " ", new_text).strip()
    if not new_text:
        return []
    runs = _map_runs(p.runs_flat(), new_text)
    if not runs:
        return []
    words, needed_by_style, resolved = _measure_words(page, runs, pool)
    if not words:
        return []

    lines = _layout_words(words, w, w)
    dom_size = max(r.size for r in runs)
    leading = max(p.leading, dom_size * 0.9)
    mfont = resolved[_style_key(runs[0])][1]
    asc = mfont.ascender if 0.5 < (mfont.ascender or 0) < 1.2 else 0.8
    desc = abs(mfont.descender) if -1.0 < (mfont.descender or 0) < 0 else 0.2
    base0 = y + (leading - (asc + desc) * dom_size) / 2 + asc * dom_size

    def piece(seg: _Seg, px: float) -> _Piece:
        return _Piece(px, seg.text, seg.run.font, seg.run.flags, seg.run.size,
                      seg.run.color, needed_by_style[_style_key(seg.run)])

    ops: list[_LineOp] = []
    for li, line in enumerate(lines):
        natural = sum(wd.width for wd in line) + sum(wd.space for wd in line[1:])
        x_start = x
        extra = 0.0
        if p.align == "justify" and li < len(lines) - 1 and len(line) > 1:
            extra = max(0.0, (w - natural) / (len(line) - 1))
        elif p.align == "center":
            x_start += max(0.0, (w - natural) / 2)
        elif p.align == "right":
            x_start += max(0.0, w - natural)

        pieces: list[_Piece] = []
        px = x_start
        for wi, wd in enumerate(line):
            if wi > 0:
                px += wd.space + extra
            for seg in wd.segs:
                pieces.append(piece(seg, px))
                px += seg.width
        ops.append(_LineOp(pieces, base0 + li * leading, dom_size * 1.2, leading))
    return ops


def split_block_ops(doc: fitz.Document, pno: int, blocks: list[dict]
                    ) -> tuple[list[dict], list[dict]]:
    """Partition block ops into (reflow rewrites, free transforms).

    A block whose geometry is unchanged and that isn't rotated is really an
    in-place rewrite — the paragraph reflow engine handles those with
    page-level fidelity (content below shifts, overflow cascades). Anything
    moved, resized or rotated becomes a free transform. True no-ops are
    dropped.
    """
    by_id = {p.id: p for p in extract_paragraphs(doc, pno)}
    reflow: list[dict] = []
    free: list[dict] = []
    for b in blocks:
        p = by_id.get(str(b.get("paraId", "")))
        if p is None:
            raise ValueError("The text block changed on disk — reload and retry")
        r = p.bbox
        same_geom = (abs(float(b.get("x", r.x0)) - r.x0) < 0.5
                     and abs(float(b.get("y", r.y0)) - r.y0) < 0.5
                     and abs(float(b.get("w", r.width)) - r.width) < 0.5)
        text = str(b.get("text", ""))
        if same_geom and _near_zero_angle(float(b.get("rotate", 0.0))):
            if text == p.text:
                continue  # nothing changed at all
            reflow.append({"paraId": b["paraId"], "text": text})
        else:
            free.append(b)
    return reflow, free


def apply_block_ops(doc: fitz.Document, pno: int, blocks: list[dict],
                    pool: FontPool) -> tuple[list[str], set[int]]:
    """blocks: [{paraId, text, x, y, w, h, rotate}] — free block transforms.

    Each targeted paragraph is redacted where it was, and its (possibly
    retyped) text is re-wrapped into the new box and drawn there, rotated
    about the box centre when requested. Surrounding content stays in place:
    a transformed block is an island, it does not reflow the page.
    """
    page = doc[pno]
    by_id = {p.id: p for p in extract_paragraphs(doc, pno)}
    warnings: list[str] = []
    changed: set[int] = {pno}

    redact: list[fitz.Rect] = []
    draws: list[tuple[list[_LineOp], tuple | None]] = []
    for b in blocks:
        p = by_id.get(str(b.get("paraId", "")))
        if p is None:
            raise ValueError("The text block changed on disk — reload and retry")
        for vl in p.lines:
            redact.append(_line_rect(vl))
        text = str(b.get("text", ""))
        if not text.strip():
            continue  # emptied text = delete the block

        r = p.bbox
        x = float(b.get("x", r.x0))
        y = float(b.get("y", r.y0))
        w = max(20.0, float(b.get("w", r.width)))
        ops = _build_box_ops(page, p, text, pool, x, y, w)
        if not ops:
            continue

        morph = None
        rotate = float(b.get("rotate", 0.0)) % 360.0
        if not _near_zero_angle(rotate):
            h = float(b.get("h", 0.0)) or \
                (ops[-1].baseline - ops[0].baseline + ops[0].leading)
            # the wire angle is CSS convention (clockwise-positive, y down);
            # fitz.Matrix rotates the opposite way in that view
            morph = (fitz.Point(x + w / 2, y + h / 2), fitz.Matrix(-rotate))
        draws.append((ops, morph))

        if morph is None:
            if ops[-1].baseline > page.rect.height - 4:
                warnings.append(
                    f"Page {pno + 1}: a text block now extends past the "
                    f"page bottom")
            if x + w > page.rect.width + 1:
                warnings.append(
                    f"Page {pno + 1}: a text block extends past the right "
                    f"page edge — text out there is not visible")

    # all redactions first: a block moved into another edited block's old
    # area must not have its freshly drawn text wiped by that redaction
    _apply_redactions(page, redact, pool)
    for ops, morph in draws:
        _draw_ops(page, ops, pool, morph=morph)
    return warnings, changed
