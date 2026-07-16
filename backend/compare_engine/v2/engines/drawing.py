import uuid
from typing import List, Dict, Any
from compare_engine.v2.dom.models import DOMNode

class DrawingComparisonEngine:
    """
    Stage 6 - Vector Drawing & Annotations Engine.
    Handles vector shapes and markup annotations.
    Detects: Drawing Added, Drawing Deleted, Drawing Modified,
             Underline Added, Underline Deleted, Highlight Added, Highlight Deleted,
             Annotation Added, Annotation Removed, Signature Added, Signature Removed.
    """

    @classmethod
    def compare(cls, matched_pairs: List[tuple], unmatched_orig: List[DOMNode], unmatched_rev: List[DOMNode]) -> List[Dict[str, Any]]:
        differences = []

        # 1. Unmatched original (Deletions / Removals)
        for node in unmatched_orig:
            if node.object_type in ("Vector Drawing", "Underline", "Highlight", "Strikeout", "Annotation", "Signature"):
                diff_type = cls._deduce_diff_type(node, is_addition=False)
                differences.append(cls._make_diff(
                    diff_type=diff_type,
                    obj_type=node.object_type,
                    page_num=node.page_number,
                    bbox=node.bounding_box,
                    orig_val=node.content or "[Drawing Shape]",
                    rev_val=None,
                    source_node=node,
                    description=f"{node.object_type} removed/deleted"
                ))

        # 2. Unmatched revised (Additions)
        for node in unmatched_rev:
            if node.object_type in ("Vector Drawing", "Underline", "Highlight", "Strikeout", "Annotation", "Signature"):
                diff_type = cls._deduce_diff_type(node, is_addition=True)
                differences.append(cls._make_diff(
                    diff_type=diff_type,
                    obj_type=node.object_type,
                    page_num=node.page_number,
                    bbox=node.bounding_box,
                    orig_val=None,
                    rev_val=node.content or "[Drawing Shape]",
                    source_node=node,
                    description=f"{node.object_type} added"
                ))

        # 3. Matched pairs
        for o_node, r_node in matched_pairs:
            if o_node.object_type not in ("Vector Drawing", "Underline", "Highlight", "Strikeout", "Annotation", "Signature"):
                continue

            # Compare their details (like drawing commands in metadata, or annotation content)
            o_cmds = o_node.metadata.get("shapes", [])
            r_cmds = r_node.metadata.get("shapes", [])

            if o_cmds != r_cmds or o_node.content != r_node.content:
                differences.append(cls._make_diff(
                    diff_type="Drawing Modified" if o_node.object_type == "Vector Drawing" else f"{o_node.object_type} Modified",
                    obj_type=r_node.object_type,
                    page_num=r_node.page_number,
                    bbox=r_node.bounding_box,
                    orig_val=o_node.content or str(o_cmds),
                    rev_val=r_node.content or str(r_cmds),
                    source_node=r_node,
                    description=f"{r_node.object_type} modified"
                ))

        return differences

    @classmethod
    def _deduce_diff_type(cls, node: DOMNode, is_addition: bool) -> str:
        otype = node.object_type
        if otype == "Vector Drawing":
            return "Drawing Added" if is_addition else "Drawing Deleted"
        elif otype == "Underline":
            return "Underline Added" if is_addition else "Underline Deleted"
        elif otype == "Highlight":
            return "Highlight Added" if is_addition else "Highlight Deleted"
        elif otype == "Signature":
            return "Signature Added" if is_addition else "Signature Removed"
        elif otype == "Annotation":
            return "Annotation Added" if is_addition else "Annotation Removed"
        else:
            # Fallback
            return f"{otype} Added" if is_addition else f"{otype} Deleted"

    @classmethod
    def _make_diff(cls, diff_type: str, obj_type: str, page_num: int, bbox: List[float],
                   orig_val: Any, rev_val: Any, source_node: DOMNode, description: str) -> Dict[str, Any]:
        return {
            "uuid": str(uuid.uuid4()),
            "difference_type": diff_type,
            "object_type": obj_type,
            "page_number": page_num,
            "bounding_box": {
                "x": bbox[0],
                "y": bbox[1],
                "w": max(0.0, bbox[2] - bbox[0]),
                "h": max(0.0, bbox[3] - bbox[1])
            },
            "original_value": orig_val,
            "revised_value": rev_val,
            "confidence_score": 1.0,
            "source_engine": "DrawingEngine",
            
            # Legacy fields
            "type": "addition" if "Added" in diff_type or "Inserted" in diff_type else ("deletion" if "Deleted" in diff_type or "Removed" in diff_type else "modification"),
            "category": "drawing",
            "text": "[Vector]" if obj_type == "Vector Drawing" else f"[{obj_type}]",
            "rect": {
                "x": bbox[0],
                "y": bbox[1],
                "w": max(0.0, bbox[2] - bbox[0]),
                "h": max(0.0, bbox[3] - bbox[1])
            },
            "description": description,
            "source": "DrawingEngine"
        }
