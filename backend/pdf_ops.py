"""All PyMuPDF (fitz) document operations.

Coordinate convention: everything on the wire is in PDF points with the origin
at the TOP-LEFT of the (rotated) page — this matches both pdf.js viewports at
scale 1 and PyMuPDF page coordinates, so no conversion is needed.
"""
import base64
import io
import math
import statistics
import zipfile
from pathlib import Path

import fitz  # PyMuPDF

import text_engine

# ---------------------------------------------------------------- helpers

BASE14 = {
    ("helv", False, False): "helv",
    ("helv", True, False): "hebo",
    ("helv", False, True): "heit",
    ("helv", True, True): "hebi",
    ("tiro", False, False): "tiro",
    ("tiro", True, False): "tibo",
    ("tiro", False, True): "tiit",
    ("tiro", True, True): "tibi",
    ("cour", False, False): "cour",
    ("cour", True, False): "cobo",
    ("cour", False, True): "coit",
    ("cour", True, True): "cobi",
}


def fontname(family: str, bold: bool = False, italic: bool = False) -> str:
    fam = family if family in ("helv", "tiro", "cour") else "helv"
    return BASE14[(fam, bool(bold), bool(italic))]


def hex2rgb(value: str, default=(0, 0, 0)) -> tuple:
    try:
        v = value.lstrip("#")
        if len(v) == 3:
            v = "".join(c * 2 for c in v)
        return tuple(int(v[i : i + 2], 16) / 255 for i in (0, 2, 4))
    except Exception:
        return default


def parse_ranges(spec: str, page_count: int) -> list[int]:
    """Parse a 1-based range string like '1-3,5,8-' into 0-based page indices."""
    if not spec or spec.strip().lower() == "all":
        return list(range(page_count))
    out: list[int] = []
    for part in spec.split(","):
        part = part.strip()
        if not part:
            continue
        if "-" in part:
            a, _, b = part.partition("-")
            start = int(a) if a.strip() else 1
            end = int(b) if b.strip() else page_count
        else:
            start = end = int(part)
        for p in range(start, end + 1):
            idx = p - 1
            if 0 <= idx < page_count and idx not in out:
                out.append(idx)
    if not out:
        raise ValueError("Empty page range")
    return out


def parse_range_groups(spec: str, page_count: int) -> list[list[int]]:
    """Each comma-separated segment becomes its own group (used for split)."""
    groups = []
    for part in spec.split(","):
        part = part.strip()
        if not part:
            continue
        groups.append(parse_ranges(part, page_count))
    if not groups:
        raise ValueError("Empty split specification")
    return groups


def _save_over(doc: fitz.Document, path: Path):
    tmp = path.with_suffix(".tmp.pdf")
    doc.save(str(tmp), garbage=3, deflate=True)
    doc.close()
    tmp.replace(path)


def page_count(data: bytes) -> int:
    with fitz.open(stream=data, filetype="pdf") as doc:
        return doc.page_count


# ---------------------------------------------------------------- annotations

def _rect(a: dict) -> fitz.Rect:
    return fitz.Rect(a["x"], a["y"], a["x"] + a["w"], a["y"] + a["h"])


def _insert_textbox_fit(page: fitz.Page, rect: fitz.Rect, text: str, *,
                        font: str, size: float, color: tuple, align: int):
    """insert_textbox that grows the rect / shrinks the font until text fits."""
    rc = page.insert_textbox(rect, text, fontname=font, fontsize=size,
                             color=color, align=align, lineheight=1.25)
    if rc >= 0:
        return
    # grow the box downward by the reported deficit
    grown = fitz.Rect(rect.x0, rect.y0, rect.x1, rect.y1 - rc + size)
    rc = page.insert_textbox(grown, text, fontname=font, fontsize=size,
                             color=color, align=align, lineheight=1.25)
    if rc >= 0:
        return
    fs = size
    while fs > 5:
        fs *= 0.85
        rc = page.insert_textbox(grown, text, fontname=font, fontsize=fs,
                                 color=color, align=align, lineheight=1.25)
        if rc >= 0:
            return


ALIGN = {"left": 0, "center": 1, "right": 2, "justify": 3}


def _apply_text(page: fitz.Page, a: dict):
    rect = _rect(a)
    _insert_textbox_fit(
        page, rect, a.get("text", ""),
        font=fontname(a.get("fontFamily", "helv"), a.get("bold"), a.get("italic")),
        size=float(a.get("fontSize", 14)),
        color=hex2rgb(a.get("color", "#000000")),
        align=ALIGN.get(a.get("align", "left"), 0),
    )
    if a.get("url"):
        page.insert_link({"kind": fitz.LINK_URI, "from": rect, "uri": a["url"]})


def _apply_markup(page: fitz.Page, a: dict):
    rects = [fitz.Rect(r["x"], r["y"], r["x"] + r["w"], r["y"] + r["h"])
             for r in a.get("rects", [])]
    rects = [r for r in rects if not r.is_empty]
    if not rects:
        return
    quads = [r.quad for r in rects]
    kind = a["type"]
    if kind == "highlight":
        annot = page.add_highlight_annot(quads=quads)
        annot.set_opacity(float(a.get("opacity", 0.45)))
    elif kind == "underline":
        annot = page.add_underline_annot(quads=quads)
    else:
        annot = page.add_strikeout_annot(quads=quads)
    annot.set_colors(stroke=hex2rgb(a.get("color", "#ffd400")))
    annot.update()


def _apply_ink(page: fitz.Page, a: dict):
    pts = [(float(p[0]), float(p[1])) for p in a.get("points", [])]
    if len(pts) < 2:
        return
    annot = page.add_ink_annot([pts])
    annot.set_colors(stroke=hex2rgb(a.get("color", "#e11d48")))
    annot.set_border(width=float(a.get("width", 2)))
    annot.set_opacity(float(a.get("opacity", 1)))
    annot.update()


def _apply_shape(page: fitz.Page, a: dict):
    shape = page.new_shape()
    stroke = hex2rgb(a.get("stroke", "#e11d48"))
    fill = hex2rgb(a["fill"]) if a.get("fill") else None
    width = float(a.get("strokeWidth", 2))
    opacity = float(a.get("opacity", 1))
    kind = a["type"]
    if kind == "rect":
        shape.draw_rect(_rect(a))
    elif kind == "ellipse":
        shape.draw_oval(_rect(a))
    elif kind in ("line", "arrow"):
        p1 = fitz.Point(a["x1"], a["y1"])
        p2 = fitz.Point(a["x2"], a["y2"])
        shape.draw_line(p1, p2)
        if kind == "arrow":
            angle = math.atan2(p2.y - p1.y, p2.x - p1.x)
            head = max(9.0, width * 4.5)
            for off in (math.radians(150), -math.radians(150)):
                tip = fitz.Point(
                    p2.x + head * math.cos(angle + off),
                    p2.y + head * math.sin(angle + off),
                )
                shape.draw_line(p2, tip)
    shape.finish(color=stroke, fill=fill, width=width,
                 stroke_opacity=opacity, fill_opacity=opacity,
                 lineCap=1, lineJoin=1)
    shape.commit(overlay=True)


def _apply_image(page: fitz.Page, a: dict):
    src = a.get("src", "")
    if "," in src:
        src = src.split(",", 1)[1]
    src += "=" * ((4 - len(src) % 4) % 4)
    data = base64.b64decode(src)
    rect = _rect(a)
    page.insert_image(rect, stream=data, rotate=int(a.get("rotate", 0)) % 360,
                      keep_proportion=False, overlay=True)
    if a.get("url"):
        page.insert_link({"kind": fitz.LINK_URI, "from": rect, "uri": a["url"]})


def _apply_note(page: fitz.Page, a: dict):
    annot = page.add_text_annot(fitz.Point(a["x"], a["y"]),
                                a.get("text", ""), icon="Comment")
    annot.set_colors(stroke=hex2rgb(a.get("color", "#ffd400")))
    annot.update()


def _apply_link(page: fitz.Page, a: dict):
    page.insert_link({"kind": fitz.LINK_URI, "from": _rect(a),
                      "uri": a.get("url", "")})


APPLIERS = {
    "text": _apply_text,
    "highlight": _apply_markup,
    "underline": _apply_markup,
    "strikeout": _apply_markup,
    "ink": _apply_ink,
    "rect": _apply_shape,
    "ellipse": _apply_shape,
    "line": _apply_shape,
    "arrow": _apply_shape,
    "image": _apply_image,
    "note": _apply_note,
    "link": _apply_link,
}


def bake_annotations(path: Path, annotations: list[dict]) -> tuple[list[str], list[int]]:
    """Apply the client's pending edit layer permanently into the PDF.

    Returns (layout warnings, changed page numbers). Text rewrites go
    through the paragraph engine — the paragraph is re-derived server-side
    from its id so geometry can never go stale — and may reflow content
    onto the following pages, which is why the changed pages are reported.
    """
    doc = fitz.open(str(path))
    by_page: dict[int, list[dict]] = {}
    for a in annotations:
        pno = int(a.get("page", 0))
        if 0 <= pno < doc.page_count:
            by_page.setdefault(pno, []).append(a)

    pool = text_engine.FontPool(doc)
    warnings: list[str] = []
    changed: set[int] = set()
    for pno, items in by_page.items():
        changed.add(pno)
        # 1) free block transforms (move / resize / rotate): islands that
        #    redact in place and redraw elsewhere without shifting the page.
        #    A block op whose geometry is untouched is really a plain rewrite
        #    and is folded into the reflow pass below instead.
        edits = [a for a in items if a["type"] == "textedit"]
        blocks = [a for a in items if a["type"] == "textblock"]
        if blocks:
            reflow, free = text_engine.split_block_ops(doc, pno, blocks)
            edits = reflow + edits
            if free:
                w, ch = text_engine.apply_block_ops(doc, pno, free, pool)
                warnings += w
                changed |= ch
        # 2) text rewrites next: their redactions would otherwise wipe
        #    annotations placed over the same area
        if edits:
            w, ch = text_engine.apply_paragraph_edits(doc, pno, edits, pool)
            warnings += w
            changed |= ch
        # 3) everything else in creation order (page fetched after the
        #    edits: a reflow may have appended pages to the document)
        page = doc[pno]
        for a in items:
            fn = APPLIERS.get(a["type"])
            if fn:
                fn(page, a)

    pool.finalize()
    _save_over(doc, path)
    return warnings, sorted(changed)


def get_paragraphs(path: Path, pno: int) -> list[dict]:
    """Editable paragraphs for one page (click-to-edit overlay)."""
    doc = fitz.open(str(path))
    try:
        if not (0 <= pno < doc.page_count):
            return []
        return text_engine.paragraphs_public(doc, pno)
    finally:
        doc.close()


def add_watermark(path: Path, *, text: str, color: str, opacity: float,
                  font_size: float | None, rotate: float, pages: list[int]):
    doc = fitz.open(str(path))
    rgb = hex2rgb(color, default=(0.7, 0.7, 0.7))
    for pno in pages:
        if not (0 <= pno < doc.page_count):
            continue
        page = doc[pno]
        r = page.rect
        fs = font_size or max(24.0, min(r.width, r.height) * 0.11)
        tl = fitz.get_text_length(text, fontname="hebo", fontsize=fs)
        center = fitz.Point(r.x0 + r.width / 2, r.y0 + r.height / 2)
        origin = fitz.Point(center.x - tl / 2, center.y + fs * 0.35)
        matrix = fitz.Matrix(1, 1).prerotate(rotate)
        page.insert_text(origin, text, fontname="hebo", fontsize=fs,
                         color=rgb, fill_opacity=opacity, overlay=True,
                         morph=(center, matrix))
    _save_over(doc, path)


# ---------------------------------------------------------------- reading

def get_outline(path: Path) -> list[dict]:
    """Existing bookmarks, or a heading heuristic when the PDF has none."""
    doc = fitz.open(str(path))
    try:
        toc = doc.get_toc(simple=True) or []
        if toc:
            return [{"level": lvl, "title": title, "page": max(0, pno - 1)}
                    for lvl, title, pno in toc]
        # Heuristic: lines whose font size clearly exceeds the body size.
        sizes: list[float] = []
        lines: list[tuple[int, float, str]] = []
        for pno in range(min(doc.page_count, 80)):
            d = doc[pno].get_text("dict")
            for block in d.get("blocks", []):
                if block.get("type") != 0:
                    continue
                for line in block.get("lines", []):
                    spans = line.get("spans", [])
                    if not spans:
                        continue
                    txt = "".join(s["text"] for s in spans).strip()
                    if not txt:
                        continue
                    size = max(s["size"] for s in spans)
                    sizes.append(size)
                    lines.append((pno, size, txt))
        if not sizes:
            return []
        body = statistics.median(sizes)
        heads = [(p, s, t) for p, s, t in lines
                 if s >= body * 1.3 and 2 < len(t) < 90 and not t.endswith(".")]
        if not heads:
            return []
        uniq_sizes = sorted({round(s, 1) for _, s, _ in heads}, reverse=True)
        tier = {s: min(i + 1, 3) for i, s in enumerate(uniq_sizes)}
        return [{"level": tier[round(s, 1)], "title": t, "page": p}
                for p, s, t in heads][:200]
    finally:
        doc.close()


def list_notes(path: Path) -> list[dict]:
    """All baked sticky-note annotations in the document."""
    doc = fitz.open(str(path))
    try:
        out = []
        for pno in range(doc.page_count):
            for annot in doc[pno].annots(types=[fitz.PDF_ANNOT_TEXT]) or []:
                info = annot.info
                out.append({
                    "xref": annot.xref, "page": pno,
                    "x": annot.rect.x0, "y": annot.rect.y0,
                    "text": info.get("content", ""),
                    "modified": info.get("modDate", ""),
                })
        return out
    finally:
        doc.close()


def _find_note(doc: fitz.Document, xref: int):
    for pno in range(doc.page_count):
        # keep the page object: the annot only weak-references its parent page,
        # so returning a fresh doc[pno] would leave the annot orphaned
        page = doc[pno]
        for annot in page.annots(types=[fitz.PDF_ANNOT_TEXT]) or []:
            if annot.xref == xref:
                return page, annot
    return None, None


def update_note(path: Path, xref: int, text: str) -> bool:
    doc = fitz.open(str(path))
    page, annot = _find_note(doc, xref)
    if annot is None:
        doc.close()
        return False
    annot.set_info(content=text)
    annot.update()
    _save_over(doc, path)
    return True


def delete_note(path: Path, xref: int) -> bool:
    doc = fitz.open(str(path))
    page, annot = _find_note(doc, xref)
    if annot is None:
        doc.close()
        return False
    page.delete_annot(annot)
    _save_over(doc, path)
    return True


# ---------------------------------------------------------------- page ops

def rotate_pages(path: Path, pages: list[int], degrees: int):
    doc = fitz.open(str(path))
    for pno in pages:
        if 0 <= pno < doc.page_count:
            page = doc[pno]
            page.set_rotation((page.rotation + degrees) % 360)
    _save_over(doc, path)


def delete_pages(path: Path, pages: list[int]) -> int:
    doc = fitz.open(str(path))
    keep = [p for p in pages if 0 <= p < doc.page_count]
    if len(keep) >= doc.page_count:
        doc.close()
        raise ValueError("Cannot delete every page of the document")
    doc.delete_pages(keep)
    n = doc.page_count
    _save_over(doc, path)
    return n


def duplicate_pages(path: Path, pages: list[int]) -> int:
    doc = fitz.open(str(path))
    # process descending so earlier indices stay valid
    for pno in sorted(set(pages), reverse=True):
        if 0 <= pno < doc.page_count:
            doc.fullcopy_page(pno, pno + 1)
    n = doc.page_count
    _save_over(doc, path)
    return n


def reorder_pages(path: Path, order: list[int]):
    doc = fitz.open(str(path))
    if sorted(order) != list(range(doc.page_count)):
        doc.close()
        raise ValueError("Order must be a permutation of all pages")
    doc.select(order)
    _save_over(doc, path)


def extract_pages(path: Path, pages: list[int]) -> bytes:
    doc = fitz.open(str(path))
    valid = [p for p in pages if 0 <= p < doc.page_count]
    if not valid:
        doc.close()
        raise ValueError("No valid pages selected")
    doc.select(valid)
    buf = doc.tobytes(garbage=3, deflate=True)
    doc.close()
    return buf


def split_document(path: Path, groups: list[list[int]]) -> list[bytes]:
    out = []
    for group in groups:
        out.append(extract_pages(path, group))
    return out


def merge_documents(paths: list[Path]) -> bytes:
    merged = fitz.open()
    for p in paths:
        with fitz.open(str(p)) as src:
            merged.insert_pdf(src)
    buf = merged.tobytes(garbage=3, deflate=True)
    merged.close()
    return buf


# ---------------------------------------------------------------- export

def export_images(path: Path, pages: list[int], fmt: str, dpi: int) -> list[tuple[str, bytes]]:
    """Render pages to PNG/JPG. Returns [(filename, bytes)]."""
    doc = fitz.open(str(path))
    ext = "png" if fmt == "png" else "jpg"
    out = []
    for pno in pages:
        if not (0 <= pno < doc.page_count):
            continue
        pix = doc[pno].get_pixmap(dpi=dpi, alpha=False)
        data = pix.tobytes(output="png" if fmt == "png" else "jpeg",
                           jpg_quality=88)
        out.append((f"page-{pno + 1}.{ext}", data))
    doc.close()
    return out


def zip_bytes(entries: list[tuple[str, bytes]]) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for name, data in entries:
            zf.writestr(name, data)
    return buf.getvalue()
