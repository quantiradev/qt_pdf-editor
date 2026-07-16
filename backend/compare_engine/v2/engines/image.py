import uuid
from typing import List, Dict, Any
from compare_engine.v2.dom.models import DOMNode

class ImageComparisonEngine:
    """
    Stage 5 - Image Comparison.
    Detects: Image Added, Image Deleted, Image Replaced, Image Resized, Image Moved.
    """

    @classmethod
    def compare(cls, matched_pairs: List[tuple], unmatched_orig: List[DOMNode], unmatched_rev: List[DOMNode]) -> List[Dict[str, Any]]:
        differences = []

        # 1. Process Unmatched Original (Deletions)
        for node in unmatched_orig:
            if node.object_type == "Image":
                differences.append(cls._make_diff(
                    diff_type="Image Deleted",
                    obj_type="Image",
                    page_num=node.page_number,
                    bbox=node.bounding_box,
                    orig_val=node.content,
                    rev_val=None,
                    source_node=node,
                    description=f"Image deleted (hash: {node.content[:8]}...)"
                ))

        # 2. Process Unmatched Revised (Additions)
        for node in unmatched_rev:
            if node.object_type == "Image":
                differences.append(cls._make_diff(
                    diff_type="Image Added",
                    obj_type="Image",
                    page_num=node.page_number,
                    bbox=node.bounding_box,
                    orig_val=None,
                    rev_val=node.content,
                    source_node=node,
                    description=f"Image added (hash: {node.content[:8]}...)"
                ))

        # 3. Process Matched Pairs
        for o_node, r_node in matched_pairs:
            if o_node.object_type != "Image":
                continue

            o_hash = o_node.content
            r_hash = r_node.content

            o_w = o_node.bounding_box[2] - o_node.bounding_box[0]
            o_h = o_node.bounding_box[3] - o_node.bounding_box[1]
            r_w = r_node.bounding_box[2] - r_node.bounding_box[0]
            r_h = r_node.bounding_box[3] - r_node.bounding_box[1]

            # If hash differs, it's a replacement
            if o_hash != r_hash:
                differences.append(cls._make_diff(
                    diff_type="Image Modified",  # Or 'Image Replaced'
                    obj_type="Image",
                    page_num=r_node.page_number,
                    bbox=r_node.bounding_box,
                    orig_val=o_hash,
                    rev_val=r_hash,
                    source_node=r_node,
                    description=f"Image content replaced from hash {o_hash[:6]} to {r_hash[:6]}"
                ))
            else:
                # Same image content, check size and position
                dw = abs(o_w - r_w)
                dh = abs(o_h - r_h)
                
                dx = abs(o_node.bounding_box[0] - r_node.bounding_box[0])
                dy = abs(o_node.bounding_box[1] - r_node.bounding_box[1])

                if dw > 2.0 or dh > 2.0:
                    differences.append(cls._make_diff(
                        diff_type="Image Modified",  # Resized
                        obj_type="Image",
                        page_num=r_node.page_number,
                        bbox=r_node.bounding_box,
                        orig_val=f"{o_w:.0f}x{o_h:.0f}",
                        rev_val=f"{r_w:.0f}x{r_h:.0f}",
                        source_node=r_node,
                        description=f"Image resized from {o_w:.0f}x{o_h:.0f} to {r_w:.0f}x{r_h:.0f}"
                    ))
                elif dx > 2.0 or dy > 2.0:
                    differences.append(cls._make_diff(
                        diff_type="Image Modified",  # Moved
                        obj_type="Image",
                        page_num=r_node.page_number,
                        bbox=r_node.bounding_box,
                        orig_val=f"Position ({o_node.bounding_box[0]:.0f}, {o_node.bounding_box[1]:.0f})",
                        rev_val=f"Position ({r_node.bounding_box[0]:.0f}, {r_node.bounding_box[1]:.0f})",
                        source_node=r_node,
                        description=f"Image moved from ({o_node.bounding_box[0]:.0f}, {o_node.bounding_box[1]:.0f}) to ({r_node.bounding_box[0]:.0f}, {r_node.bounding_box[1]:.0f})"
                    ))

        return differences

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
            "source_engine": "ImageEngine",
            
            # Legacy fields
            "type": "addition" if "Added" in diff_type else ("deletion" if "Deleted" in diff_type else "modification"),
            "category": "image",
            "text": "[Image]",
            "rect": {
                "x": bbox[0],
                "y": bbox[1],
                "w": max(0.0, bbox[2] - bbox[0]),
                "h": max(0.0, bbox[3] - bbox[1])
            },
            "description": description,
            "source": "ImageEngine"
        }
