"""
layout_compare.py
==================
Detects structural layout differences (blocks moved, added, or deleted)
by inspecting the RegionPair list produced by RegionMatcher.

This is the natural home for diffs where the CONTENT is the same but the
POSITION changed (moved paragraph, moved image, etc.).

Note: Image moves are handled by ImageComparer.
      This module handles text-region layout diffs only.
"""

from typing import List
from compare_engine.region_matcher import RegionPair


# ---------------------------------------------------------------------------
# LayoutComparer
# ---------------------------------------------------------------------------

class LayoutComparer:

    @staticmethod
    def compare(pairs: List[RegionPair], pno: int) -> List[dict]:
        """
        Inspect RegionPairs and emit layout-level differences.

        Emits a diff for:
          - moved   → same content, different position (category=layout)
          - added   → region exists only in rev
          - deleted → region exists only in orig
          - type_changed → same area, different region type

        Text-region additions/deletions are also emitted here so they appear
        as layout diffs rather than word-level diffs (the content may be
        entirely new or entirely removed).
        """
        differences: List[dict] = []

        for pair in pairs:
            mtype = pair.match_type

            if mtype == "moved" and pair.orig_region and pair.rev_region:
                # Same text, different position
                r = pair.rev_region
                bbox = r.bbox
                differences.append({
                    "type": "modification",
                    "category": "layout",
                    "text": r.text[:60] if r.text else f"[{r.region_type}]",
                    "rect": {
                        "x": bbox[0], "y": bbox[1],
                        "w": max(0.0, bbox[2] - bbox[0]),
                        "h": max(0.0, bbox[3] - bbox[1])
                    },
                    "description": (
                        f"{r.region_type.capitalize()} block moved from "
                        f"({pair.orig_region.bbox[0]:.0f}, {pair.orig_region.bbox[1]:.0f}) "
                        f"to ({bbox[0]:.0f}, {bbox[1]:.0f})"
                    ),
                    "source": "LayoutComparer"
                })

            elif mtype == "type_changed" and pair.orig_region and pair.rev_region:
                r = pair.rev_region
                bbox = r.bbox
                differences.append({
                    "type": "modification",
                    "category": "layout",
                    "text": r.text[:60] if r.text else f"[{r.region_type}]",
                    "rect": {
                        "x": bbox[0], "y": bbox[1],
                        "w": max(0.0, bbox[2] - bbox[0]),
                        "h": max(0.0, bbox[3] - bbox[1])
                    },
                    "description": (
                        f"Block type changed from '{pair.orig_region.region_type}' "
                        f"to '{r.region_type}'"
                    ),
                    "source": "LayoutComparer"
                })

            # Note: "added" and "deleted" pairs for TEXT regions are handled
            # by the TextRegionComparer (one_sided pair → all words added/deleted).
            # "added"/"deleted" for images/drawings are handled by their own comparers.

        return differences
