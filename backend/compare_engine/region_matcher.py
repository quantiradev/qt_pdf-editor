"""
region_matcher.py
==================
Matches structural regions from the original page to corresponding regions
in the revised page, before any word-level comparison takes place.

Matching strategy (per content type):
  - Images   → matched by SHA-256 hash, then by IoU fallback
  - Drawings → matched by fingerprint (type + rounded bbox + colour)
  - Text     → matched by (region_type + text similarity + IoU)

Output is a list of RegionPair objects.  Each pair carries:
  - orig_region: Region | None
  - rev_region:  Region | None
  - match_type:  "exact" | "moved" | "added" | "deleted" | "type_changed"

Words are NEVER compared across mismatched pairs.
"""

import difflib
from dataclasses import dataclass
from typing import List, Optional

from compare_engine.region_extractor import Region


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

@dataclass
class RegionPair:
    orig_region: Optional[Region]
    rev_region: Optional[Region]
    # exact   — same type, high IoU, high text similarity
    # moved   — same type + text, but different position
    # added   — exists only in rev
    # deleted — exists only in orig
    # type_changed — same area, different type
    match_type: str


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

IOI_EXACT_THRESHOLD = 0.40      # IoU to consider same position
TEXT_SIM_THRESHOLD = 0.85       # SequenceMatcher ratio for same content (increased to avoid false matches)
IMAGE_HASH_MATCH = True         # always match images by hash first


# ---------------------------------------------------------------------------
# RegionMatcher
# ---------------------------------------------------------------------------

class RegionMatcher:
    """
    Matches orig regions → rev regions using a greedy priority matching:
    1. Image regions (by hash)
    2. Drawing regions (by fingerprint)
    3. Text regions (heading → heading, paragraph → paragraph, etc.)
    """

    @classmethod
    def match(cls, orig_regions: List[Region],
              rev_regions: List[Region]) -> List[RegionPair]:
        pairs: List[RegionPair] = []

        matched_orig = set()
        matched_rev = set()

        # --- Pass 1: Image matching by hash ---
        orig_images = [(i, r) for i, r in enumerate(orig_regions)
                       if r.region_type == "image"]
        rev_images = [(j, r) for j, r in enumerate(rev_regions)
                      if r.region_type == "image"]

        for i, o in orig_images:
            if i in matched_orig:
                continue
            for j, r in rev_images:
                if j in matched_rev:
                    continue
                if o.img_hash and o.img_hash == r.img_hash:
                    iou = cls._iou(o.bbox, r.bbox)
                    mtype = "exact" if iou >= IOI_EXACT_THRESHOLD else "moved"
                    pairs.append(RegionPair(o, r, mtype))
                    matched_orig.add(i)
                    matched_rev.add(j)
                    break

        # Image hash mismatch — try positional (same area, different content)
        for i, o in orig_images:
            if i in matched_orig:
                continue
            for j, r in rev_images:
                if j in matched_rev:
                    continue
                if cls._iou(o.bbox, r.bbox) >= IOI_EXACT_THRESHOLD:
                    pairs.append(RegionPair(o, r, "exact"))
                    matched_orig.add(i)
                    matched_rev.add(j)
                    break

        # Unmatched images
        for i, o in orig_images:
            if i not in matched_orig:
                pairs.append(RegionPair(o, None, "deleted"))
                matched_orig.add(i)
        for j, r in rev_images:
            if j not in matched_rev:
                pairs.append(RegionPair(None, r, "added"))
                matched_rev.add(j)

        # --- Pass 2: Drawing matching by fingerprint ---
        orig_drawings = [(i, r) for i, r in enumerate(orig_regions)
                         if r.region_type == "drawing"]
        rev_drawings = [(j, r) for j, r in enumerate(rev_regions)
                        if r.region_type == "drawing"]

        for i, o in orig_drawings:
            if i in matched_orig:
                continue
            for j, r in rev_drawings:
                if j in matched_rev:
                    continue
                iou = cls._iou(o.bbox, r.bbox)
                if iou >= IOI_EXACT_THRESHOLD:
                    pairs.append(RegionPair(o, r, "exact"))
                    matched_orig.add(i)
                    matched_rev.add(j)
                    break

        for i, o in orig_drawings:
            if i not in matched_orig:
                pairs.append(RegionPair(o, None, "deleted"))
                matched_orig.add(i)
        for j, r in rev_drawings:
            if j not in matched_rev:
                pairs.append(RegionPair(None, r, "added"))
                matched_rev.add(j)

        # --- Pass 3: Text region matching ---
        TEXT_TYPES = {"heading", "paragraph", "header", "footer", "table"}

        orig_text = [(i, r) for i, r in enumerate(orig_regions)
                     if r.region_type in TEXT_TYPES and i not in matched_orig]
        rev_text = [(j, r) for j, r in enumerate(rev_regions)
                    if r.region_type in TEXT_TYPES and j not in matched_rev]

        # Build a similarity score matrix and greedily match best pairs
        scored: List[tuple] = []  # (score, i, j)
        for i, o in orig_text:
            for j, r in rev_text:
                score = cls._text_region_score(o, r)
                if score > 0:
                    scored.append((score, i, j))

        scored.sort(key=lambda x: -x[0])

        for score, i, j in scored:
            if i in matched_orig or j in matched_rev:
                continue
            o = orig_regions[i]
            r = rev_regions[j]
            iou = cls._iou(o.bbox, r.bbox)
            text_sim = cls._text_similarity(o.text, r.text)

            if text_sim >= TEXT_SIM_THRESHOLD and iou >= IOI_EXACT_THRESHOLD:
                mtype = "exact"
            elif text_sim >= TEXT_SIM_THRESHOLD:
                mtype = "moved"
            else:
                continue  # not a good match - don't compare regions with different content

            # Type mismatch check
            if o.region_type != r.region_type:
                mtype = "type_changed"

            pairs.append(RegionPair(o, r, mtype))
            matched_orig.add(i)
            matched_rev.add(j)

        # Unmatched text regions
        for i, o in orig_text:
            if i not in matched_orig:
                pairs.append(RegionPair(o, None, "deleted"))
                matched_orig.add(i)
        for j, r in rev_text:
            if j not in matched_rev:
                pairs.append(RegionPair(None, r, "added"))
                matched_rev.add(j)

        return pairs

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _iou(a: tuple, b: tuple) -> float:
        """Intersection over Union of two bboxes (x0,y0,x1,y1)."""
        ix0 = max(a[0], b[0])
        iy0 = max(a[1], b[1])
        ix1 = min(a[2], b[2])
        iy1 = min(a[3], b[3])
        inter = max(0.0, ix1 - ix0) * max(0.0, iy1 - iy0)
        area_a = max(0.0, a[2] - a[0]) * max(0.0, a[3] - a[1])
        area_b = max(0.0, b[2] - b[0]) * max(0.0, b[3] - b[1])
        union = area_a + area_b - inter
        return inter / union if union > 0 else 0.0

    @staticmethod
    def _text_similarity(a: str, b: str) -> float:
        """SequenceMatcher ratio on two text strings with whitespace normalization."""
        if not a and not b:
            return 1.0
        if not a or not b:
            return 0.0
        # Normalize whitespace to avoid false positives from spacing differences
        a_normalized = " ".join(a.strip().split())
        b_normalized = " ".join(b.strip().split())
        return difflib.SequenceMatcher(None, a_normalized, b_normalized, autojunk=False).ratio()

    @classmethod
    def _text_region_score(cls, o: Region, r: Region) -> float:
        """
        Combined score for matching two text regions.
        Prioritises same type, similar content, and overlapping position.
        Returns 0 if clearly incompatible.
        """
        # Strongly prefer matching the same structural type
        type_bonus = 1.0 if o.region_type == r.region_type else 0.3

        text_sim = cls._text_similarity(o.text, r.text)
        iou = cls._iou(o.bbox, r.bbox)

        # Proximity bonus: give extra weight to y-position closeness
        y_center_o = (o.bbox[1] + o.bbox[3]) / 2
        y_center_r = (r.bbox[1] + r.bbox[3]) / 2
        page_h = max(o.page_height, r.page_height, 842)
        y_proximity = max(0.0, 1.0 - abs(y_center_o - y_center_r) / page_h)

        score = type_bonus * (0.5 * text_sim + 0.3 * iou + 0.2 * y_proximity)
        return score
