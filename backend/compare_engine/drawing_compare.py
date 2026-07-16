"""
drawing_compare.py
==================
Compares vector drawing paths between two PDF pages using PyMuPDF's
get_drawings() API.

Each drawing is fingerprinted by its canonical geometry and visual properties.
Matched drawings produce no diff.  Unmatched drawings produce addition/deletion.
Repositioned drawings produce a layout modification.

Detected sub-types:
  underline     — thin horizontal line (height < 2 pt) below text
  strikethrough — thin horizontal line at mid-height of text
  line          — any other thin line (one dim < 3 pt)
  rectangle     — closed rectangular path
  circle        — ellipse / circle path
  highlight     — filled semi-transparent rectangle (yellow-ish fill)
  drawing       — all other paths
"""

from typing import List


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

THIN_THRESHOLD = 3.0       # pt — width OR height < this → thin element
POSITION_TOLERANCE = 4.0   # pt — positions within this are "same"
HIGHLIGHT_HEIGHT = 12.0    # pt — filled rect taller than this is probably not a highlight


# ---------------------------------------------------------------------------
# DrawingComparer
# ---------------------------------------------------------------------------

class DrawingComparer:

    @classmethod
    def compare(cls, page_orig, page_rev) -> List[dict]:
        """
        Compare vector drawings between two fitz.Page objects.
        Returns a list of diff dicts.
        """
        orig_drawings = cls._extract(page_orig)
        rev_drawings = cls._extract(page_rev)

        matched_orig = set()
        matched_rev = set()
        differences: List[dict] = []

        # --- Match by fingerprint (exact position + style) ---
        for i, o in enumerate(orig_drawings):
            for j, r in enumerate(rev_drawings):
                if j in matched_rev:
                    continue
                if o["fingerprint"] == r["fingerprint"]:
                    matched_orig.add(i)
                    matched_rev.add(j)
                    break

        # --- Match by proximity (same geometry, slightly shifted) ---
        for i, o in enumerate(orig_drawings):
            if i in matched_orig:
                continue
            for j, r in enumerate(rev_drawings):
                if j in matched_rev:
                    continue
                if cls._rects_close(o["bbox"], r["bbox"]) and o["subtype"] == r["subtype"]:
                    # Same shape type, close position — consider moved/resized
                    matched_orig.add(i)
                    matched_rev.add(j)
                    diff_bbox = r["bbox"]
                    differences.append({
                        "type": "modification",
                        "category": o["subtype"],
                        "text": "",
                        "rect": {
                            "x": diff_bbox[0], "y": diff_bbox[1],
                            "w": max(0.0, diff_bbox[2] - diff_bbox[0]),
                            "h": max(0.0, diff_bbox[3] - diff_bbox[1])
                        },
                        "description": f"Drawing element modified or repositioned",
                        "source": "DrawingComparer"
                    })
                    break

        # --- Deleted drawings (in orig, not in rev) ---
        for i, o in enumerate(orig_drawings):
            if i not in matched_orig:
                bbox = o["bbox"]
                differences.append({
                    "type": "deletion",
                    "category": o["subtype"],
                    "text": "",
                    "rect": {
                        "x": bbox[0], "y": bbox[1],
                        "w": max(0.0, bbox[2] - bbox[0]),
                        "h": max(0.0, bbox[3] - bbox[1])
                    },
                    "description": f"Removed {o['subtype']} drawing element",
                    "source": "DrawingComparer"
                })

        # --- Added drawings (in rev, not in orig) ---
        for j, r in enumerate(rev_drawings):
            if j not in matched_rev:
                bbox = r["bbox"]
                differences.append({
                    "type": "addition",
                    "category": r["subtype"],
                    "text": "",
                    "rect": {
                        "x": bbox[0], "y": bbox[1],
                        "w": max(0.0, bbox[2] - bbox[0]),
                        "h": max(0.0, bbox[3] - bbox[1])
                    },
                    "description": f"Added {r['subtype']} drawing element",
                    "source": "DrawingComparer"
                })

        return differences

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    @classmethod
    def _extract(cls, page) -> List[dict]:
        """Extract all drawings from a page and return normalised dicts."""
        result = []
        try:
            page_w = page.rect.width
            page_h = page.rect.height
            for draw in page.get_drawings():
                rect = draw.get("rect")
                if rect is None:
                    continue
                x0, y0, x1, y1 = rect.x0, rect.y0, rect.x1, rect.y1
                width = max(0.0, x1 - x0)
                height = max(0.0, y1 - y0)
                if width < 0.5 and height < 0.5:
                    continue  # invisible / degenerate

                # Page-scale filter to exclude ghost background rectangles or page-boundary borders
                if width > (page_w * 0.9) and height > (page_h * 0.9):
                    continue

                subtype = cls._classify_drawing(draw, page)
                color = draw.get("color") or draw.get("stroke_color")
                fill = draw.get("fill")

                # Fingerprint: rounded geometry + subtype + color
                fp = (
                    subtype,
                    round(x0, 1), round(y0, 1),
                    round(x1, 1), round(y1, 1),
                    str(color), str(fill)
                )
                result.append({
                    "bbox": (x0, y0, x1, y1),
                    "subtype": subtype,
                    "fingerprint": fp
                })
        except Exception:
            pass
        return result

    @staticmethod
    def _classify_drawing(draw: dict, page) -> str:
        """Classify a drawing dict into a semantic sub-type."""
        rect = draw.get("rect")
        if rect is None:
            return "drawing"

        width = rect.width
        height = rect.height
        fill = draw.get("fill")
        items = draw.get("items", [])

        # Thin horizontal line
        if height < THIN_THRESHOLD and width > height:
            # Check if there is text immediately above (underline) or at mid-height (strikethrough)
            try:
                text_above = page.get_text(
                    "text",
                    clip=type(rect)(rect.x0, rect.y0 - 14, rect.x1, rect.y0)
                ).strip()
                text_mid = page.get_text(
                    "text",
                    clip=type(rect)(rect.x0, rect.y0 - 7, rect.x1, rect.y0 + 7)
                ).strip()
            except Exception:
                text_above, text_mid = "", ""

            if text_mid:
                return "strikethrough"
            if text_above:
                return "underline"
            return "line"

        # Thin vertical line
        if width < THIN_THRESHOLD and height > width:
            return "line"

        # Filled semi-transparent rectangle (highlight)
        if fill is not None and height <= HIGHLIGHT_HEIGHT:
            fill_r, fill_g, fill_b = (fill + (0, 0, 0))[:3]
            if fill_r > 0.8 and fill_g > 0.7:  # yellowish
                return "highlight"

        # Closed rectangular path
        if len(items) >= 4:
            # Check if all items are line segments forming a rectangle
            types = [it[0] for it in items]
            if all(t in ("l", "re") for t in types):
                return "rectangle"

        # Ellipse / arc
        if any(it[0] == "c" for it in items):
            return "circle"

        return "drawing"

    @staticmethod
    def _rects_close(a: tuple, b: tuple, tol: float = POSITION_TOLERANCE) -> bool:
        """True if two bboxes are within tolerance on all four sides."""
        return (
            abs(a[0] - b[0]) <= tol and abs(a[1] - b[1]) <= tol and
            abs(a[2] - b[2]) <= tol and abs(a[3] - b[3]) <= tol
        )
