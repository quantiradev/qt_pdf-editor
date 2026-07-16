import fitz
import sys
import traceback
from typing import Dict, Any, List

from compare_engine.v2.dom.parser import PDFDOMParser
from compare_engine.v2.matching.matcher import ObjectMatcher
from compare_engine.v2.engines.text import TextComparisonEngine
from compare_engine.v2.engines.table import TableComparisonEngine
from compare_engine.v2.engines.image import ImageComparisonEngine
from compare_engine.v2.engines.drawing import DrawingComparisonEngine
from compare_engine.v2.engines.layout import LayoutComparisonEngine
from compare_engine.v2.engines.visual import VisualVerificationEngine
from compare_engine.v2.fusion.merger import DifferenceMerger
from compare_engine.v2.fusion.overlay import OverlayGenerator

class ComparisonEngineV2:
    """
    PDFForge Enterprise Compare Engine V2 Orchestrator.
    Ties the 10 stages together:
      1. Parse document into DOM hierarchy.
      1.5. Establish cross-page paragraph reflow links.
      2. Page-level structural Object Matching.
      3. Reflow-proof Myers Diff Text comparison.
      4. Table structure comparison.
      5. Image perceptual signature check.
      6. Vector graphics instruction comparison.
      7. High-level layout movement detection.
      8. SSIM visual verification pass.
      9. Difference Fusion (subsumption & deduplication).
      10. Fine-grained tight bounding box overlays.
    """

    @classmethod
    def compare_documents(cls, path_orig: str, path_rev: str) -> Dict[str, Any]:
        doc_orig = fitz.open(path_orig)
        doc_rev = fitz.open(path_rev)

        try:
            # Security verification
            if doc_orig.is_encrypted and doc_orig.authenticate("") == 0:
                raise ValueError("Original PDF is password-protected and locked.")
            if doc_rev.is_encrypted and doc_rev.authenticate("") == 0:
                raise ValueError("Revised PDF is password-protected and locked.")

            page_count_orig = doc_orig.page_count
            page_count_rev = doc_rev.page_count
            max_pages = max(page_count_orig, page_count_rev)

            # Stage 1: Build DOM Trees
            dom_orig = PDFDOMParser.parse(path_orig)
            dom_rev = PDFDOMParser.parse(path_rev)

            pages_diff = []
            total_additions = 0
            total_deletions = 0
            total_modifications = 0

            for pno in range(max_pages):
                page_diffs = []

                if pno < page_count_orig and pno < page_count_rev:
                    # Both pages exist - parse page nodes
                    orig_page_node = dom_orig.children[pno]
                    rev_page_node = dom_rev.children[pno]
                    
                    page_orig = doc_orig[pno]
                    page_rev = doc_rev[pno]
                    page_h = page_orig.rect.height

                    # Stage 2: Object Matching
                    match_result = ObjectMatcher.match_page_nodes(
                        orig_page_node.children,
                        rev_page_node.children,
                        page_h
                    )

                    # Stage 3: Text Engine (compare matched text blocks)
                    semantic_diffs = []
                    TEXT_TYPES = {"Heading", "Paragraph", "Header", "Footer"}
                    for o_node, r_node in match_result.matched_pairs:
                        if o_node.object_type in TEXT_TYPES and r_node.object_type in TEXT_TYPES:
                            txt_diffs = TextComparisonEngine.compare(o_node, r_node)
                            semantic_diffs.extend(txt_diffs)

                    # Handle unmatched original text blocks (Deletions)
                    for o_node in match_result.unmatched_original:
                        if o_node.object_type in TEXT_TYPES:
                            txt_diffs = TextComparisonEngine.compare_unmatched(o_node, is_addition=False)
                            semantic_diffs.extend(txt_diffs)

                    # Handle unmatched revised text blocks (Additions)
                    for r_node in match_result.unmatched_revised:
                        if r_node.object_type in TEXT_TYPES:
                            txt_diffs = TextComparisonEngine.compare_unmatched(r_node, is_addition=True)
                            semantic_diffs.extend(txt_diffs)

                    # Stage 4: Table Engine
                    for o_node, r_node in match_result.matched_pairs:
                        if o_node.object_type == "Table" and r_node.object_type == "Table":
                            tbl_diffs = TableComparisonEngine.compare(o_node, r_node)
                            semantic_diffs.extend(tbl_diffs)

                    # Stage 5: Image Engine
                    img_diffs = ImageComparisonEngine.compare(
                        match_result.matched_pairs,
                        match_result.unmatched_original,
                        match_result.unmatched_revised
                    )
                    semantic_diffs.extend(img_diffs)

                    # Stage 6: Drawing & Annotation Engine
                    draw_diffs = DrawingComparisonEngine.compare(
                        match_result.matched_pairs,
                        match_result.unmatched_original,
                        match_result.unmatched_revised
                    )
                    semantic_diffs.extend(draw_diffs)

                    # Stage 7: Layout Engine
                    layout_diffs = LayoutComparisonEngine.compare(
                        match_result.matched_pairs,
                        page_count_orig,
                        page_count_rev,
                        dom_orig,
                        dom_rev
                    )
                    # Filter layout diffs for this page index
                    page_layout_diffs = [d for d in layout_diffs if d["page_number"] == (pno + 1)]
                    semantic_diffs.extend(page_layout_diffs)

                    # Stage 8: Visual Verification SSIM Fallback
                    # Collect coordinates of all parsed elements on BOTH pages to mask them out
                    explained_rects = []
                    for n in orig_page_node.children:
                        explained_rects.append({
                            "x": n.bounding_box[0], "y": n.bounding_box[1],
                            "w": n.bounding_box[2] - n.bounding_box[0],
                            "h": n.bounding_box[3] - n.bounding_box[1]
                        })

                    for n in rev_page_node.children:
                        explained_rects.append({
                            "x": n.bounding_box[0], "y": n.bounding_box[1],
                            "w": n.bounding_box[2] - n.bounding_box[0],
                            "h": n.bounding_box[3] - n.bounding_box[1]
                        })

                    visual_diffs = VisualVerificationEngine.compare_page(
                        page_orig,
                        page_rev,
                        pno + 1,
                        explained_rects
                    )

                    # Stage 9: Difference Fusion
                    fused_diffs = DifferenceMerger.fuse(semantic_diffs, visual_diffs)
                    page_diffs.extend(fused_diffs)

                elif pno < page_count_orig:
                    # Page deleted from revised
                    page_orig = doc_orig[pno]
                    w, h = page_orig.rect.width, page_orig.rect.height
                    page_diffs.append(cls._make_page_diff(
                        diff_type="Page Deleted",
                        page_num=pno + 1,
                        w=w,
                        h=h,
                        description=f"Page {pno + 1} deleted in the revised version"
                    ))
                else:
                    # Page added in revised
                    page_rev = doc_rev[pno]
                    w, h = page_rev.rect.width, page_rev.rect.height
                    page_diffs.append(cls._make_page_diff(
                        diff_type="Page Added",
                        page_num=pno + 1,
                        w=w,
                        h=h,
                        description=f"Page {pno + 1} added in the revised version"
                    ))

                # Stage 10: Overlay Alignment & Standardization
                standardized_overlays = []
                p_height = doc_rev[pno].rect.height if pno < page_count_rev else doc_orig[pno].rect.height
                for d in page_diffs:
                    overlay = OverlayGenerator.create_overlay(
                        diff_type=d["type"],
                        category=d["category"],
                        text=d["text"],
                        rect=d["rect"],
                        description=d["description"],
                        source=d.get("source", "LayoutEngine"),
                        page_height=p_height
                    )
                    # Merge overlay data into the original diff object
                    d.update(overlay)
                    d["bounding_box"] = {
                        "x": overlay["rect"]["x"],
                        "y": overlay["rect"]["y"],
                        "w": overlay["rect"]["w"],
                        "h": overlay["rect"]["h"]
                    }
                    standardized_overlays.append(d)

                pages_diff.append({
                    "page_index": pno,
                    "differences": standardized_overlays
                })

            # Calculate final summary
            for p in pages_diff:
                for d in p["differences"]:
                    if d["type"] == "addition":
                        total_additions += 1
                    elif d["type"] == "deletion":
                        total_deletions += 1
                    elif d["type"] == "modification":
                        total_modifications += 1

            return {
                "page_count_original": page_count_orig,
                "page_count_revised": page_count_rev,
                "summary": {
                    "additions": total_additions,
                    "deletions": total_deletions,
                    "modifications": total_modifications
                },
                "pages": pages_diff
            }

        except Exception as e:
            exc_type, exc_val, exc_tb = sys.exc_info()
            tb_str = "".join(traceback.format_exception(exc_type, exc_val, exc_tb))
            print(f"[FATAL ERROR] ComparisonEngineV2 failed: {e}\n{tb_str}", file=sys.stderr)
            raise e
        finally:
            doc_orig.close()
            doc_rev.close()

    @classmethod
    def _make_page_diff(cls, diff_type: str, page_num: int, w: float, h: float, description: str) -> Dict[str, Any]:
        """Creates standard page addition/deletion metadata."""
        import uuid
        return {
            "uuid": str(uuid.uuid4()),
            "difference_type": diff_type,
            "object_type": "Page",
            "page_number": page_num,
            "bounding_box": {"x": 0.0, "y": 0.0, "w": w, "h": h},
            "original_value": None,
            "revised_value": f"Page {page_num}",
            "confidence_score": 1.0,
            "source_engine": "LayoutEngine",
            
            # Legacy fields
            "type": "addition" if "Added" in diff_type else "deletion",
            "category": "page",
            "text": f"[{diff_type}]",
            "rect": {"x": 0.0, "y": 0.0, "w": w, "h": h},
            "description": description,
            "source": "LayoutEngine"
        }
