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


def bake_annotations(path: Path, annotations: list[dict]):
    """Apply the client's pending edit layer permanently into the PDF."""
    doc = fitz.open(str(path))
    by_page: dict[int, list[dict]] = {}
    for a in annotations:
        pno = int(a.get("page", 0))
        if 0 <= pno < doc.page_count:
            by_page.setdefault(pno, []).append(a)

    for pno, items in by_page.items():
        page = doc[pno]
        # 1) text edits first: they redact original content, which would
        #    also wipe any annotation placed in the same area. fill=False
        #    removes the glyphs without painting a cover rectangle, so the
        #    page background (colors, images) shows through untouched.
        edits = [a for a in items if a["type"] == "textedit"]
        if edits:
            for a in edits:
                page.add_redact_annot(_rect(a), fill=False)
            try:
                page.apply_redactions(
                    images=fitz.PDF_REDACT_IMAGE_NONE,
                    graphics=fitz.PDF_REDACT_LINE_ART_NONE,
                )
            except (TypeError, AttributeError):
                # older PyMuPDF without the graphics parameter
                page.apply_redactions(images=fitz.PDF_REDACT_IMAGE_NONE)
            for a in edits:
                rect = _rect(a)
                text = a.get("text", "")
                font = fontname(a.get("fontFamily", "helv"), a.get("bold"), a.get("italic"))
                size = float(a.get("fontSize", 12))
                color = hex2rgb(a.get("color", "#000000"))
                align = ALIGN.get(a.get("align", "left"), 0)

                req_width = 0.0
                if text:
                    for line in text.split("\n"):
                        try:
                            w = fitz.get_text_length(line, fontname=font, fontsize=size)
                            if w > req_width:
                                req_width = w
                        except Exception:
                            pass

                insert_rect = fitz.Rect(rect)
                is_single_line = rect.height <= size * 2.0
                if is_single_line and req_width > rect.width:
                    diff = req_width - rect.width + 4  # +4 for slight padding
                    if align == 0:  # left
                        insert_rect.x1 += diff
                    elif align == 2:  # right
                        insert_rect.x0 -= diff
                    elif align == 1:  # center
                        insert_rect.x0 -= diff / 2
                        insert_rect.x1 += diff / 2
                    elif align == 3:  # justify (treat as left for expansion)
                        insert_rect.x1 += diff

                _insert_textbox_fit(
                    page, insert_rect, text,
                    font=font,
                    size=size,
                    color=color,
                    align=align,
                )
        # 2) everything else in creation order
        for a in items:
            fn = APPLIERS.get(a["type"])
            if fn:
                fn(page, a)

    _save_over(doc, path)


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


def _span_family(font: str, flags: int) -> tuple[str, bool, bool]:
    mono = bool(flags & 8) or "mono" in font.lower() or "courier" in font.lower()
    serif = bool(flags & 4) or "times" in font.lower() or "serif" in font.lower()
    bold = bool(flags & 16) or "bold" in font.lower()
    italic = bool(flags & 2) or "italic" in font.lower() or "oblique" in font.lower()
    fam = "cour" if mono else ("tiro" if serif else "helv")
    return fam, bold, italic


def _merge_text_blocks(blocks: list[dict]) -> list[dict]:
    if not blocks:
        return []
    
    # Sort blocks primarily by y (top to bottom), and then by x (left to right)
    sorted_blocks = sorted(blocks, key=lambda b: (round(b["y"], 1), round(b["x"], 1)))
    
    merged = []
    for b in sorted_blocks:
        if not merged:
            merged.append(b)
            continue
        
        merged_any = False
        # Look at the last few merged blocks to find a merge candidate
        for idx in range(len(merged) - 1, max(-1, len(merged) - 4), -1):
            prev = merged[idx]
            
            # Check Case A: On the same horizontal line
            same_line = abs(prev["y"] - b["y"]) < 3.0 or (
                max(prev["y"], b["y"]) < min(prev["y"] + prev["h"], b["y"] + b["h"])
            )
            
            # Check Case B: Vertically adjacent (b is below prev)
            gap_y = b["y"] - (prev["y"] + prev["h"])
            max_gap = max(5.0, prev["fontSize"] * 0.35)
            vertically_adjacent = 0 <= gap_y <= max_gap
            
            if same_line:
                # Same line horizontal adjacency
                gap_x = max(b["x"], prev["x"]) - min(b["x"] + b["w"], prev["x"] + prev["w"])
                horiz_close = gap_x < 25.0
                
                if horiz_close:
                    if prev["x"] <= b["x"]:
                        t1 = prev["text"].strip()
                        t2 = b["text"].strip()
                        main_block = prev if len(prev["text"]) >= len(b["text"]) else b
                    else:
                        t1 = b["text"].strip()
                        t2 = prev["text"].strip()
                        main_block = b if len(b["text"]) >= len(prev["text"]) else prev
                        
                    x0 = min(prev["x"], b["x"])
                    y0 = min(prev["y"], b["y"])
                    x1 = max(prev["x"] + prev["w"], b["x"] + b["w"])
                    y1 = max(prev["y"] + prev["h"], b["y"] + b["h"])
                    
                    prev["x"] = x0
                    prev["y"] = y0
                    prev["w"] = x1 - x0
                    prev["h"] = y1 - y0
                    prev["fontSize"] = main_block["fontSize"]
                    prev["fontFamily"] = main_block["fontFamily"]
                    prev["bold"] = main_block["bold"]
                    prev["italic"] = main_block["italic"]
                    prev["color"] = main_block["color"]
                    
                    prev["text"] = t1 + " " + t2 if t1 and t2 else (t1 or t2)
                    merged_any = True
                    break
                    
            elif vertically_adjacent:
                # Vertical adjacency: require matching family, size, color. Ignore bold/italic changes.
                font_match = (
                    prev["fontFamily"] == b["fontFamily"]
                    and abs(prev["fontSize"] - b["fontSize"]) < 0.5
                    and prev["color"] == b["color"]
                )
                if not font_match:
                    continue
                    
                horiz_overlap = max(prev["x"], b["x"]) < min(prev["x"] + prev["w"], b["x"] + b["w"])
                left_aligned = abs(prev["x"] - b["x"]) < 15.0
                
                if horiz_overlap or left_aligned:
                    x0 = min(prev["x"], b["x"])
                    y0 = min(prev["y"], b["y"])
                    x1 = max(prev["x"] + prev["w"], b["x"] + b["w"])
                    y1 = max(prev["y"] + prev["h"], b["y"] + b["h"])
                    
                    prev["x"] = x0
                    prev["y"] = y0
                    prev["w"] = x1 - x0
                    prev["h"] = y1 - y0
                    
                    t1 = prev["text"].strip()
                    t2 = b["text"].strip()
                    if t1.endswith("-"):
                        prev["text"] = t1[:-1] + t2
                    else:
                        prev["text"] = t1 + " " + t2
                    
                    merged_any = True
                    break
                    
        if not merged_any:
            merged.append(b)
            
    return merged


def get_text_blocks(path: Path, pno: int) -> list[dict]:
    """Editable text blocks for one page (for click-to-edit)."""
    doc = fitz.open(str(path))
    try:
        if not (0 <= pno < doc.page_count):
            return []
        d = doc[pno].get_text("dict")
        out = []
        for block in d.get("blocks", []):
            if block.get("type") != 0:
                continue
            parts = []
            first_span = None
            for line in block.get("lines", []):
                txt = "".join(s["text"] for s in line.get("spans", []))
                if line.get("spans") and first_span is None:
                    first_span = line["spans"][0]
                parts.append(txt)
            text = "\n".join(parts).strip()
            if not text or first_span is None:
                continue
            x0, y0, x1, y1 = block["bbox"]
            fam, bold, italic = _span_family(first_span.get("font", ""),
                                             first_span.get("flags", 0))
            c = first_span.get("color", 0)
            out.append({
                "x": x0, "y": y0, "w": x1 - x0, "h": y1 - y0,
                "text": text,
                "fontSize": round(first_span.get("size", 12), 1),
                "fontFamily": fam, "bold": bold, "italic": italic,
                "color": "#{:06x}".format(c if isinstance(c, int) else 0),
            })
        return _merge_text_blocks(out)
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
        for annot in doc[pno].annots(types=[fitz.PDF_ANNOT_TEXT]) or []:
            if annot.xref == xref:
                return doc[pno], annot
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
