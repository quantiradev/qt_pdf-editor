import difflib
from typing import List, Dict, Tuple, Any

# Standalone DOMNode type fallback to prevent import errors in different environments
try:
    from compare_engine.v2.dom.models import DOMNode
except ImportError:
    class DOMNode:
        def __init__(self, node_id: str, object_type: str, page_number: int, bbox: Any, text_content: str = ""):
            self.id = node_id
            self.object_type = object_type
            self.page_number = page_number
            self.bbox = bbox
            self.text_content = text_content


def calculate_text_similarity(text1: str, text2: str) -> float:
    """
    Calculate similarity ratio between two text strings using SequenceMatcher.
    Returns a value between 0.0 and 1.0.
    """
    if not text1 and not text2:
        return 1.0
    if not text1 or not text2:
        return 0.0
    return difflib.SequenceMatcher(None, text1, text2, autojunk=False).ratio()


def calculate_iou(box1: dict, box2: dict) -> float:
    """
    Calculate the Intersection over Union (IoU) of two bounding boxes.
    Format for boxes: {'x': float, 'y': float, 'w': float, 'h': float}
    Returns a value between 0.0 and 1.0.
    """
    x1_min = box1.get('x', 0.0)
    y1_min = box1.get('y', 0.0)
    x1_max = x1_min + box1.get('w', 0.0)
    y1_max = y1_min + box1.get('h', 0.0)

    x2_min = box2.get('x', 0.0)
    y2_min = box2.get('y', 0.0)
    x2_max = x2_min + box2.get('w', 0.0)
    y2_max = y2_min + box2.get('h', 0.0)

    # Determine the intersection rectangle coordinates
    inter_x_min = max(x1_min, x2_min)
    inter_y_min = max(y1_min, y2_min)
    inter_x_max = min(x1_max, x2_max)
    inter_y_max = min(y1_max, y2_max)

    inter_w = max(0.0, inter_x_max - inter_x_min)
    inter_h = max(0.0, inter_y_max - inter_y_min)
    inter_area = inter_w * inter_h

    # Areas of both boxes
    area1 = box1.get('w', 0.0) * box1.get('h', 0.0)
    area2 = box2.get('w', 0.0) * box2.get('h', 0.0)
    union_area = area1 + area2 - inter_area

    if union_area <= 0.0:
        return 0.0

    return inter_area / union_area


def _get_text_content(node: DOMNode) -> str:
    """Extract content from node accommodating both V2 DOMNode names and test inputs."""
    if hasattr(node, "text_content"):
        return node.text_content or ""
    if hasattr(node, "content"):
        return node.content or ""
    return ""


def _get_bbox_dict(node: DOMNode) -> dict:
    """Converts standard list bounds or dictionary bounds to {'x', 'y', 'w', 'h'} format."""
    raw_box = getattr(node, "bbox", None) or getattr(node, "bounding_box", None)
    if isinstance(raw_box, dict):
        return raw_box
    if isinstance(raw_box, (list, tuple)) and len(raw_box) == 4:
        # Standard PDF bounding box format [x0, y0, x1, y1]
        x0, y0, x1, y1 = raw_box
        w = x1 - x0
        h = y1 - y0
        if w >= 0 and h >= 0:
            return {'x': x0, 'y': y0, 'w': w, 'h': h}
        # Fallback if list represents [x, y, w, h]
        return {'x': raw_box[0], 'y': raw_box[1], 'w': raw_box[2], 'h': raw_box[3]}
    return {'x': 0.0, 'y': 0.0, 'w': 0.0, 'h': 0.0}


def match_nodes(original_nodes: List[DOMNode], revised_nodes: List[DOMNode]) -> Tuple[List[Tuple[DOMNode, DOMNode]], List[DOMNode], List[DOMNode]]:
    """
    Main matching algorithm aligning elements between original and revised document sets.
    Implements Reflow-Proof scoring overrides for text nodes.
    Matches are priority-sorted to select the globally best match first.
    """
    candidates = []

    # Iterate through original and revised nodes to compute scores
    for orig in original_nodes:
        for rev in revised_nodes:
            # Rule A: Type Strictness
            if orig.object_type != rev.object_type:
                continue

            # Load geometries and text content
            orig_box = _get_bbox_dict(orig)
            rev_box = _get_bbox_dict(rev)
            iou_sim = calculate_iou(orig_box, rev_box)

            orig_text = _get_text_content(orig)
            rev_text = _get_text_content(rev)

            score = 0.0

            # Rule B: Text Nodes
            if orig.object_type in ["Heading", "Paragraph", "Sentence", "Word"]:
                text_sim = calculate_text_similarity(orig_text, rev_text)
                # The Reflow Override
                if text_sim >= 0.85:
                    score = text_sim
                else:
                    score = (text_sim * 0.85) + (iou_sim * 0.15)

            # Rule C: Visual/Structural Nodes
            elif orig.object_type in ["Table", "Table Row", "Table Cell", "Image", "Vector Drawing", "Signature", "Annotation", "Highlight", "Underline", "Strikeout", "Form Field", "Header", "Footer"]:
                if orig.page_number == rev.page_number:
                    score = iou_sim
                else:
                    score = 0.0
            else:
                # Default scoring criteria
                text_sim = calculate_text_similarity(orig_text, rev_text)
                score = (text_sim * 0.5) + (iou_sim * 0.5)

            # Rule D: Thresholding
            if score >= 0.60:
                candidates.append((score, orig, rev))

    # Sort all matches globally by score descending to lock in best matches first
    candidates.sort(key=lambda x: x[0], reverse=True)

    matched_pairs: List[Tuple[DOMNode, DOMNode]] = []
    matched_orig_ids = set()
    matched_rev_ids = set()

    for score, orig, rev in candidates:
        if orig.id in matched_orig_ids or rev.id in matched_rev_ids:
            continue
        matched_pairs.append((orig, rev))
        matched_orig_ids.add(orig.id)
        matched_rev_ids.add(rev.id)

    # Collect unmatched original and revised nodes
    unmatched_original = [o for o in original_nodes if o.id not in matched_orig_ids]
    unmatched_revised = [r for r in revised_nodes if r.id not in matched_rev_ids]

    return matched_pairs, unmatched_original, unmatched_revised


class ObjectMatcher:
    """
    Adapter class for V2 Engine integration to preserve module-level backward compatibility.
    """
    @classmethod
    def match_page_nodes(cls, orig_nodes: List[DOMNode], rev_nodes: List[DOMNode], page_height: float) -> Any:
        pairs, unmatched_orig, unmatched_rev = match_nodes(orig_nodes, rev_nodes)
        
        class MatchResultWrapper:
            def __init__(self, matched_pairs, unmatched_original, unmatched_revised):
                self.matched_pairs = matched_pairs
                self.unmatched_original = unmatched_original
                self.unmatched_revised = unmatched_revised

        return MatchResultWrapper(pairs, unmatched_orig, unmatched_rev)
