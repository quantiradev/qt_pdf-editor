import uuid
from typing import List, Dict, Any, Tuple
from compare_engine.v2.dom.models import DOMNode

class DifferenceMerger:
    """
    Stage 9 - Difference Fusion Engine.
    Rules:
      - Never duplicate changes.
      - Merge consecutive character/word additions/deletions on the same lines.
      - Resolve overlaps (semantic edits override visual edits).
      - Perform parent-node subsumption (e.g. collapse multiple changed words into a single sentence modification).
    """

    @classmethod
    def fuse(cls, semantic_diffs: List[Dict[str, Any]], visual_diffs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Combines and deduplicates differences from all sub-engines.
        """
        merged_diffs = []

        # 1. Spatial Overlap Resolution: Drop visual differences that overlap with any semantic difference.
        semantic_by_page: Dict[int, List[Dict[str, Any]]] = {}
        for d in semantic_diffs:
            semantic_by_page.setdefault(d["page_number"], []).append(d)

        filtered_visual = []
        for v in visual_diffs:
            pno = v["page_number"]
            overlaps_semantic = False
            
            # Bounding box coordinates
            v_box = v["bounding_box"]
            vx0, vy0, vx1, vy1 = v_box["x"], v_box["y"], v_box["x"] + v_box["w"], v_box["y"] + v_box["h"]

            for s in semantic_by_page.get(pno, []):
                s_box = s["bounding_box"]
                sx0, sy0, sx1, sy1 = s_box["x"], s_box["y"], s_box["x"] + s_box["w"], s_box["y"] + s_box["h"]
                
                # Check intersection
                ix0 = max(vx0, sx0)
                iy0 = max(vy0, sy0)
                ix1 = min(vx1, sx1)
                iy1 = min(vy1, sy1)
                
                if ix1 > ix0 and iy1 > iy0:
                    overlaps_semantic = True
                    break
            
            if not overlaps_semantic:
                filtered_visual.append(v)

        # Combine
        raw_list = []
        for d in (semantic_diffs + filtered_visual):
            if d.get("type") == "addition" and d.get("category") in ["layout", "drawing"]:
                box = d.get("bounding_box") or d.get("rect", {})
                w = box.get("w", 0.0) if box.get("w") is not None else 0.0
                h = box.get("h", 0.0) if box.get("h") is not None else 0.0
                if w * h > (595.0 * 842.0 * 0.5):
                    continue
            raw_list.append(d)

        # 2. Merge consecutive inline additions or deletions on the same line
        # Group by page and type/category
        by_page_type: Dict[Tuple[int, str, str], List[Dict[str, Any]]] = {}
        for d in raw_list:
            key = (d["page_number"], d["type"], d["source_engine"])
            by_page_type.setdefault(key, []).append(d)

        for key, items in by_page_type.items():
            page_num, diff_type, engine = key
            
            # We only merge character/word level edits
            if engine == "TextEngine":
                merged_items = cls._merge_consecutive_text_edits(items)
                merged_diffs.extend(merged_items)
            else:
                merged_diffs.extend(items)

        # 3. Collapse multiple modifications into sentence/paragraph edits if density is high
        final_list = cls._apply_parent_subsumption(merged_diffs)

        # 4. Resolve overlapping bounding boxes across all differences on each page
        # Prioritize more specific/tighter engines (drawings, text, image) over annotation containers
        category_weights = {
            "text": 10,
            "image": 9,
            "table": 8,
            "drawing": 7,
            "annotation": 6,
            "layout": 5,
            "visual": 1
        }
        
        # Sort final_list by page position and specificity descending
        final_list.sort(key=lambda d: (d["page_number"], -category_weights.get(d.get("category", ""), 0)))
        
        resolved_diffs = []
        for d in final_list:
            d_box = d.get("bounding_box") or d.get("rect", {})
            overlap_found = False
            
            for existing in resolved_diffs:
                if existing["page_number"] != d["page_number"]:
                    continue
                
                # Check spatial overlap
                e_box = existing.get("bounding_box") or existing.get("rect", {})
                iou = cls.get_iou(d_box, e_box)
                ratio_d = cls.get_overlap_ratio(d_box, e_box)
                ratio_e = cls.get_overlap_ratio(e_box, d_box)
                
                if d["type"] == existing["type"] and (iou > 0.4 or ratio_d > 0.7 or ratio_e > 0.7):
                    overlap_found = True
                    break
                    
            if not overlap_found:
                resolved_diffs.append(d)
                
        # Final sort by page, then position
        resolved_diffs.sort(key=lambda d: (
            d["page_number"], 
            d.get("bounding_box", {}).get("y", 0.0), 
            d.get("bounding_box", {}).get("x", 0.0)
        ))
        
        return resolved_diffs

    @staticmethod
    def get_iou(boxA: dict, boxB: dict) -> float:
        xA = max(boxA.get("x", 0.0), boxB.get("x", 0.0))
        yA = max(boxA.get("y", 0.0), boxB.get("y", 0.0))
        xB = min(boxA.get("x", 0.0) + boxA.get("w", 0.0), boxB.get("x", 0.0) + boxB.get("w", 0.0))
        yB = min(boxA.get("y", 0.0) + boxA.get("h", 0.0), boxB.get("y", 0.0) + boxB.get("h", 0.0))
        
        interArea = max(0.0, xB - xA) * max(0.0, yB - yA)
        boxAArea = boxA.get("w", 0.0) * boxA.get("h", 0.0)
        boxBArea = boxB.get("w", 0.0) * boxB.get("h", 0.0)
        
        unionArea = boxAArea + boxBArea - interArea
        return interArea / unionArea if unionArea > 0 else 0.0

    @staticmethod
    def get_overlap_ratio(boxA: dict, boxB: dict) -> float:
        xA = max(boxA.get("x", 0.0), boxB.get("x", 0.0))
        yA = max(boxA.get("y", 0.0), boxB.get("y", 0.0))
        xB = min(boxA.get("x", 0.0) + boxA.get("w", 0.0), boxB.get("x", 0.0) + boxB.get("w", 0.0))
        yB = min(boxA.get("y", 0.0) + boxA.get("h", 0.0), boxB.get("y", 0.0) + boxB.get("h", 0.0))
        
        interArea = max(0.0, xB - xA) * max(0.0, yB - yA)
        boxAArea = boxA.get("w", 0.0) * boxA.get("h", 0.0)
        return interArea / boxAArea if boxAArea > 0 else 0.0

    @classmethod
    def _merge_consecutive_text_edits(cls, items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Groups adjacent/consecutive character or word level additions/deletions into single rectangles.
        """
        if not items:
            return []

        # Sort by bounding box y, then x
        items.sort(key=lambda d: (d["bounding_box"]["y"], d["bounding_box"]["x"]))

        merged = []
        current = items[0]

        for next_item in items[1:]:
            c_box = current["bounding_box"]
            n_box = next_item["bounding_box"]

            cx0, cy0, cx1, cy1 = c_box["x"], c_box["y"], c_box["x"] + c_box["w"], c_box["y"] + c_box["h"]
            nx0, ny0, nx1, ny1 = n_box["x"], n_box["y"], n_box["x"] + n_box["w"], n_box["y"] + n_box["h"]

            # Merge threshold: same line (y overlap) and small horizontal gap (dx < 15.0 pts)
            same_line = abs(cy0 - ny0) < 4.0 or (max(cy0, ny0) < min(cy1, ny1))
            close_horizontal = abs(nx0 - cx1) < 15.0

            if same_line and close_horizontal and current["difference_type"] == next_item["difference_type"]:
                # Merge boxes
                mx0 = min(cx0, nx0)
                my0 = min(cy0, ny0)
                mx1 = max(cx1, nx1)
                my1 = max(cy1, ny1)

                current["bounding_box"] = {
                    "x": mx0,
                    "y": my0,
                    "w": mx1 - mx0,
                    "h": my1 - my0
                }
                current["rect"] = current["bounding_box"] # keep sync
                
                # Combine content values
                if current["original_value"] and next_item["original_value"]:
                    current["original_value"] = f"{current['original_value']} {next_item['original_value']}"
                if current["revised_value"] and next_item["revised_value"]:
                    current["revised_value"] = f"{current['revised_value']} {next_item['revised_value']}"
                
                # Update text/description
                current["text"] = current["revised_value"] if current["revised_value"] is not None else current["original_value"]
                current["description"] = f"{current['difference_type']}: {current['original_value'] or ''} -> {current['revised_value'] or ''}"
            else:
                merged.append(current)
                current = next_item

        merged.append(current)
        return merged

    @classmethod
    def _apply_parent_subsumption(cls, items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Subsumes child edits (like many modified words in a sentence) into a single Sentence Modified edit.
        """
        # Group by page
        by_page: Dict[int, List[Dict[str, Any]]] = {}
        for d in items:
            by_page.setdefault(d["page_number"], []).append(d)

        final_list = []

        for pno, p_items in by_page.items():
            # If a page contains more than 5 word modifications on the same line,
            # we group them into a single modification for readability
            text_mods = [d for d in p_items if d["difference_type"] == "Word Modified"]
            other_mods = [d for d in p_items if d["difference_type"] != "Word Modified"]
            
            # Simple heuristic grouping of text modifications by line (approximate y-coordinate)
            by_line: Dict[int, List[Dict[str, Any]]] = {}
            for d in text_mods:
                line_y = int(d["bounding_box"]["y"] / 10.0) * 10 # bin by 10 pts
                by_line.setdefault(line_y, []).append(d)

            for line_y, line_items in by_line.items():
                if len(line_items) >= 4:
                    # Group into a single Sentence Modified
                    x0 = min(d["bounding_box"]["x"] for d in line_items)
                    y0 = min(d["bounding_box"]["y"] for d in line_items)
                    x1 = max(d["bounding_box"]["x"] + d["bounding_box"]["w"] for d in line_items)
                    y1 = max(d["bounding_box"]["y"] + d["bounding_box"]["h"] for d in line_items)
                    
                    orig_vals = " ... ".join(filter(None, [d["original_value"] for d in line_items]))
                    rev_vals = " ... ".join(filter(None, [d["revised_value"] for d in line_items]))

                    grouped_diff = {
                        "uuid": str(uuid.uuid4()),
                        "difference_type": "Sentence Modified",
                        "object_type": "Sentence",
                        "page_number": pno,
                        "bounding_box": {
                            "x": x0,
                            "y": y0,
                            "w": x1 - x0,
                            "h": y1 - y0
                        },
                        "original_value": orig_vals,
                        "revised_value": rev_vals,
                        "confidence_score": 0.95,
                        "source_engine": "TextEngine",
                        
                        "type": "modification",
                        "category": "text",
                        "text": rev_vals,
                        "rect": {
                            "x": x0,
                            "y": y0,
                            "w": x1 - x0,
                            "h": y1 - y0
                        },
                        "description": f"Multiple sentence changes: {orig_vals} -> {rev_vals}",
                        "source": "TextEngine"
                    }
                    final_list.append(grouped_diff)
                else:
                    final_list.extend(line_items)

            final_list.extend(other_mods)

        return final_list
