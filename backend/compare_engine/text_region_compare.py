"""
text_region_compare.py
=======================
Word-level text comparison WITHIN a single matched RegionPair.

Key design principles:
  - Words are NEVER compared across different region pairs.
  - The global tx/ty page-shift is eliminated entirely — region matching
    already aligns structurally corresponding blocks.
  - Movement is only reported when BOTH x and y coordinates change by more
    than MOVE_THRESHOLD points.  This eliminates the (147,41)→(147,41) bug.
  - Description and threshold check use the SAME coordinate values.
  - If only one word changes in a 50-word paragraph, exactly one diff is emitted.
"""

import difflib
from typing import List

from compare_engine.region_extractor import Region, WordInfo
from compare_engine.region_matcher import RegionPair


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# A word must move by more than this in BOTH x AND y to be reported as moved.
MOVE_THRESHOLD = 5.0   # PDF points


# ---------------------------------------------------------------------------
# TextRegionComparer
# ---------------------------------------------------------------------------

class TextRegionComparer:
    """
    Compares words within a matched region pair.

    Usage:
        diffs = TextRegionComparer.compare(pair, pno)
    """

    @classmethod
    def compare(cls, pair: RegionPair, pno: int) -> List[dict]:
        """
        Compare words inside a matched region pair.
        Returns a list of diff dicts (same schema as the rest of the engine).
        """
        if pair.orig_region is None or pair.rev_region is None:
            return []

        orig_words: List[WordInfo] = pair.orig_region.words
        rev_words: List[WordInfo] = pair.rev_region.words

        if not orig_words and not rev_words:
            return []

        orig_texts = [w.text.strip() for w in orig_words]
        rev_texts = [w.text.strip() for w in rev_words]

        matcher = difflib.SequenceMatcher(None, orig_texts, rev_texts, autojunk=False)
        opcodes = matcher.get_opcodes()

        differences: List[dict] = []

        for tag, i1, i2, j1, j2 in opcodes:

            if tag == "equal":
                # Only report if the word physically moved (both axes) AND text actually changed
                for k in range(i2 - i1):
                    o_w = orig_words[i1 + k]
                    r_w = rev_words[j1 + k]
                    # Skip if stripped text is identical (only whitespace difference)
                    if o_w.text.strip() == r_w.text.strip():
                        continue
                    dx = abs(o_w.bbox[0] - r_w.bbox[0])
                    dy = abs(o_w.bbox[1] - r_w.bbox[1])
                    if dx > MOVE_THRESHOLD and dy > MOVE_THRESHOLD:
                        # Genuine physical movement — both axes changed
                        differences.append(cls._make_diff(
                            diff_type="modification",
                            word=r_w,
                            pno=pno,
                            description=(
                                f"Word moved from "
                                f"({r_w.bbox[0]:.0f}, {r_w.bbox[1]:.0f}) to "
                                f"({o_w.bbox[0]:.0f}, {o_w.bbox[1]:.0f})"
                            )
                        ))

            elif tag == "replace":
                orig_block = orig_words[i1:i2]
                rev_block = rev_words[j1:j2]

                if len(orig_block) == len(rev_block):
                    # 1-to-1 word substitution
                    for k in range(len(orig_block)):
                        o_w = orig_block[k]
                        r_w = rev_block[k]
                        # Skip if words are actually the same (only whitespace difference)
                        if o_w.text.strip() == r_w.text.strip():
                            continue
                        # Skip if either word is just whitespace
                        if not o_w.text.strip() or not r_w.text.strip():
                            continue
                        differences.append(cls._make_diff(
                            diff_type="modification",
                            word=r_w,
                            pno=pno,
                            description=f"Word changed from '{o_w.text}' to '{r_w.text}'"
                        ))
                else:
                    # Count mismatch — emit discrete delete + insert
                    for o_w in orig_block:
                        # Skip whitespace-only deletions
                        if not o_w.text.strip():
                            continue
                        differences.append(cls._make_diff(
                            diff_type="deletion",
                            word=o_w,
                            pno=pno,
                            description=f"Removed word: '{o_w.text}'"
                        ))
                    for r_w in rev_block:
                        # Skip whitespace-only additions
                        if not r_w.text.strip():
                            continue
                        differences.append(cls._make_diff(
                            diff_type="addition",
                            word=r_w,
                            pno=pno,
                            description=f"Added word: '{r_w.text}'"
                        ))

            elif tag == "delete":
                for o_w in orig_words[i1:i2]:
                    # Skip whitespace-only deletions
                    if not o_w.text.strip():
                        continue
                    differences.append(cls._make_diff(
                        diff_type="deletion",
                        word=o_w,
                        pno=pno,
                        description=f"Removed word: '{o_w.text}'"
                    ))

            elif tag == "insert":
                for r_w in rev_words[j1:j2]:
                    # Skip whitespace-only additions
                    if not r_w.text.strip():
                        continue
                    differences.append(cls._make_diff(
                        diff_type="addition",
                        word=r_w,
                        pno=pno,
                        description=f"Added word: '{r_w.text}'"
                    ))

        return differences

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _make_diff(diff_type: str, word: WordInfo, pno: int,
                   description: str) -> dict:
        """Build a standard diff dict from a WordInfo and metadata."""
        x0, y0, x1, y1 = word.bbox
        return {
            "type": diff_type,
            "category": "text",
            "text": word.text,
            "rect": {
                "x": x0,
                "y": y0,
                "w": max(0.0, x1 - x0),
                "h": max(0.0, y1 - y0),
            },
            "description": description,
            "source": "TextRegionComparer",
            "line_key": f"{pno}_{word.block_no}_{word.line_no}",
        }
