"""
region_extractor.py
====================
Extracts logical structural regions from a single PDF page using PyMuPDF's
block → line → span tree.  No pixel rendering is performed here.

Each Region describes one logical content unit on the page:
    heading   — large/bold text block near the top
    paragraph — normal body text block
    header    — text block in the top margin (< 72 pt from page top)
    footer    — text block in the bottom margin (< 72 pt from page bottom)
    table     — text block with columnar / tabular structure
    image     — embedded raster image
    drawing   — vector drawing / path element

Regions are sorted in reading order (top-to-bottom, left-to-right).
"""

import hashlib
from dataclasses import dataclass, field
from typing import List, Optional


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

@dataclass
class WordInfo:
    """A single word extracted from a PDF page."""
    text: str
    bbox: tuple          # (x0, y0, x1, y1) in PDF points
    block_no: int
    line_no: int
    word_no: int


@dataclass
class Region:
    """One logical content region on a PDF page."""
    region_type: str     # heading | paragraph | header | footer | table | image | drawing
    bbox: tuple          # (x0, y0, x1, y1) in PDF points
    text: str            # full concatenated text (empty for image/drawing)
    words: List[WordInfo] = field(default_factory=list)
    block_no: int = -1   # source PyMuPDF block index (-1 for non-text)
    xref: int = 0        # image xref (images only)
    img_hash: str = ""   # SHA-256 of image bytes (images only)
    page_height: float = 0.0  # stored for footer detection


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

HEADING_FONT_SIZE_THRESHOLD = 13.0   # pt — blocks with avg size > this → heading
HEADING_BOLD_KEYWORDS = ("bold", "heavy", "black")  # font name substrings
MARGIN_THRESHOLD = 72.0              # pt — 1 inch from edge → header/footer
TABLE_MIN_LINES = 3                  # minimum lines in a block to consider as table
TABLE_COL_GAP = 15.0                 # pt — horizontal gap threshold for column detection


# ---------------------------------------------------------------------------
# RegionExtractor
# ---------------------------------------------------------------------------

class RegionExtractor:
    """
    Extracts all logical regions from a fitz.Page.

    Usage:
        regions = RegionExtractor.extract(page)
    """

    @staticmethod
    def extract(page) -> List[Region]:
        """
        Main entry point.  Returns a list of Region objects sorted in
        reading order (top → bottom, left → right).
        """
        page_width = page.rect.width
        page_height = page.rect.height

        regions: List[Region] = []

        # 1. Text blocks (type 0 in PyMuPDF)
        try:
            text_dict = page.get_text("dict", flags=0)
        except Exception:
            text_dict = {"blocks": []}

        for block in text_dict.get("blocks", []):
            btype = block.get("type", -1)
            block_no = block.get("number", -1)
            bbox = tuple(block.get("bbox", (0, 0, 0, 0)))

            if btype == 0:
                # Text block
                region = RegionExtractor._classify_text_block(
                    block, block_no, bbox, page_height
                )
                regions.append(region)

            elif btype == 1:
                # Inline image block
                xref = block.get("xref", 0)
                img_hash = ""
                try:
                    img_data = page.parent.extract_image(xref)
                    if img_data:
                        img_hash = hashlib.sha256(img_data["image"]).hexdigest()
                except Exception:
                    pass

                regions.append(Region(
                    region_type="image",
                    bbox=bbox,
                    text="",
                    words=[],
                    block_no=block_no,
                    xref=xref,
                    img_hash=img_hash,
                    page_height=page_height
                ))

        # 2. Raster images referenced via page image list (not always in text dict)
        try:
            for info in page.get_image_info(xrefs=True):
                xref = info.get("xref", 0)
                ibbox = tuple(info.get("bbox", (0, 0, 0, 0)))
                # Skip if already captured by block type==1
                already = any(
                    r.region_type == "image" and RegionExtractor._boxes_overlap(r.bbox, ibbox)
                    for r in regions
                )
                if already:
                    continue
                img_hash = ""
                try:
                    img_data = page.parent.extract_image(xref)
                    if img_data:
                        img_hash = hashlib.sha256(img_data["image"]).hexdigest()
                except Exception:
                    pass
                regions.append(Region(
                    region_type="image",
                    bbox=ibbox,
                    text="",
                    words=[],
                    block_no=-1,
                    xref=xref,
                    img_hash=img_hash,
                    page_height=page_height
                ))
        except Exception:
            pass

        # 3. Vector drawings (paths)
        try:
            for draw in page.get_drawings():
                drect = draw.get("rect")
                if drect is None:
                    continue
                dbbox = (drect.x0, drect.y0, drect.x1, drect.y1)
                if (drect.width < 1 and drect.height < 1):
                    continue  # degenerate / invisible
                regions.append(Region(
                    region_type="drawing",
                    bbox=dbbox,
                    text="",
                    words=[],
                    block_no=-1,
                    page_height=page_height
                ))
        except Exception:
            pass

        # 4. Sort reading order
        regions.sort(key=lambda r: (r.bbox[1], r.bbox[0]))

        return regions

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _classify_text_block(block: dict, block_no: int, bbox: tuple,
                              page_height: float) -> Region:
        """
        Classify a type-0 (text) block into one of:
        header | footer | heading | table | paragraph
        and extract its words.
        """
        lines = block.get("lines", [])

        # --- Collect all spans for font analysis ---
        all_spans = []
        for line in lines:
            for span in line.get("spans", []):
                all_spans.append(span)

        # Average font size across all spans
        sizes = [s.get("size", 0) for s in all_spans if s.get("size", 0) > 0]
        avg_size = sum(sizes) / len(sizes) if sizes else 0

        # Is any span bold?
        is_bold = any(
            any(kw in s.get("font", "").lower() for kw in HEADING_BOLD_KEYWORDS)
            for s in all_spans
        )

        # Full text of the block
        full_text = " ".join(
            s.get("text", "").strip()
            for line in lines
            for s in line.get("spans", [])
        ).strip()

        # --- Extract word-level info using block's bbox from raw words ---
        # We re-derive words from the span chars for accurate bbox.
        words = RegionExtractor._extract_words_from_spans(lines, block_no)

        # --- Classify ---
        y0 = bbox[1]
        y1 = bbox[3]

        region_type: str
        if y0 < MARGIN_THRESHOLD:
            region_type = "header"
        elif y1 > page_height - MARGIN_THRESHOLD:
            region_type = "footer"
        elif avg_size >= HEADING_FONT_SIZE_THRESHOLD or (is_bold and avg_size >= 11.0):
            region_type = "heading"
        elif RegionExtractor._looks_like_table(lines):
            region_type = "table"
        else:
            region_type = "paragraph"

        return Region(
            region_type=region_type,
            bbox=bbox,
            text=full_text,
            words=words,
            block_no=block_no,
            page_height=page_height
        )

    @staticmethod
    def _extract_words_from_spans(lines: list, block_no: int) -> List[WordInfo]:
        """
        Extract WordInfo objects from the span list of a block's lines.
        Falls back to splitting span text if per-char info is unavailable.
        """
        words: List[WordInfo] = []
        for line_no, line in enumerate(lines):
            word_no = 0
            # Concatenate span text for the line then split into tokens
            line_text = ""
            line_bbox = list(line.get("bbox", [0, 0, 0, 0]))
            for span in line.get("spans", []):
                line_text += span.get("text", "")

            # Use the span-level origin and width to approximate word positions
            # We iterate spans and split on whitespace, estimating x offsets.
            span_cursor_x = line_bbox[0]
            for span in line.get("spans", []):
                span_text = span.get("text", "")
                span_bbox = list(span.get("bbox", line_bbox))
                span_size = span.get("size", 10)

                tokens = span_text.split()
                if not tokens:
                    continue

                # Approximate each token's width proportionally
                total_chars = sum(len(t) for t in tokens) + max(0, len(tokens) - 1)
                span_width = span_bbox[2] - span_bbox[0]
                char_width = span_width / total_chars if total_chars > 0 else span_size * 0.5

                cursor = span_bbox[0]
                for token in tokens:
                    tok_width = len(token) * char_width
                    words.append(WordInfo(
                        text=token,
                        bbox=(cursor, span_bbox[1], cursor + tok_width, span_bbox[3]),
                        block_no=block_no,
                        line_no=line_no,
                        word_no=word_no
                    ))
                    word_no += 1
                    cursor += tok_width + char_width  # advance past token + space

        return words

    @staticmethod
    def _looks_like_table(lines: list) -> bool:
        """
        Heuristic: a block looks like a table if it has >= TABLE_MIN_LINES
        and multiple lines that each contain multiple spans with large x-gaps,
        suggesting a columnar layout.
        """
        if len(lines) < TABLE_MIN_LINES:
            return False
        multi_column_lines = 0
        for line in lines:
            spans = line.get("spans", [])
            if len(spans) >= 2:
                for i in range(1, len(spans)):
                    prev_end = spans[i - 1].get("bbox", [0, 0, 0, 0])[2]
                    curr_start = spans[i].get("bbox", [0, 0, 0, 0])[0]
                    if curr_start - prev_end >= TABLE_COL_GAP:
                        multi_column_lines += 1
                        break
        return multi_column_lines >= 2

    @staticmethod
    def _boxes_overlap(a: tuple, b: tuple, tol: float = 2.0) -> bool:
        """Returns True if two bboxes overlap (within tolerance)."""
        return not (
            a[2] + tol < b[0] or b[2] + tol < a[0] or
            a[3] + tol < b[1] or b[3] + tol < a[1]
        )
