class DifferenceMerger:
    @staticmethod
    def get_iou(boxA: dict, boxB: dict) -> float:
        xA = max(boxA["x"], boxB["x"])
        yA = max(boxA["y"], boxB["y"])
        xB = min(boxA["x"] + boxA["w"], boxB["x"] + boxB["w"])
        yB = min(boxA["y"] + boxA["h"], boxB["y"] + boxB["h"])
        
        interArea = max(0, xB - xA) * max(0, yB - yA)
        boxAArea = boxA["w"] * boxA["h"]
        boxBArea = boxB["w"] * boxB["h"]
        
        unionArea = boxAArea + boxBArea - interArea
        return interArea / unionArea if unionArea > 0 else 0

    @staticmethod
    def get_overlap_ratio(boxA: dict, boxB: dict) -> float:
        """Returns how much of boxA is contained inside boxB."""
        xA = max(boxA["x"], boxB["x"])
        yA = max(boxA["y"], boxB["y"])
        xB = min(boxA["x"] + boxA["w"], boxB["x"] + boxB["w"])
        yB = min(boxA["y"] + boxA["h"], boxB["y"] + boxB["h"])
        
        interArea = max(0, xB - xA) * max(0, yB - yA)
        boxAArea = boxA["w"] * boxA["h"]
        return interArea / boxAArea if boxAArea > 0 else 0

    @staticmethod
    def merge_adjacent_differences(diffs: list, x_threshold: float = 20.0, y_threshold: float = 4.0) -> list:
        """
        Merges adjacent differences of the same type and category.
        If the category is "text", they are merged strictly per line using their line_key.
        """
        if not diffs:
            return []
            
        # Group diffs by (type, category, line_key)
        groups = {}
        for d in diffs:
            lkey = d.get("line_key") if d["category"] == "text" else None
            key = (d["type"], d["category"], lkey)
            if key not in groups:
                groups[key] = []
            groups[key].append(d)
            
        merged_diffs = []
        
        for (dtype, cat, lkey), group in groups.items():
            if not group:
                continue
                
            # Text differences: keep individual word rectangles for tight wrapping
            # Do NOT merge all words on the same line - each changed word gets its own rectangle
            if lkey is not None:
                # Sort by horizontal coordinate (x) to maintain text order
                group.sort(key=lambda d: d["rect"]["x"])
                
                # Only merge if words are truly adjacent (within 6px horizontally)
                # This handles multi-word changes while keeping single-word changes tight
                merged_group = []
                current_merge = [group[0]]
                
                for i in range(1, len(group)):
                    prev = current_merge[-1]
                    curr = group[i]
                    # Check if current word is adjacent to previous (within 6px gap)
                    gap = curr["rect"]["x"] - (prev["rect"]["x"] + prev["rect"]["w"])
                    if gap <= 6.0:
                        current_merge.append(curr)
                    else:
                        merged_group.append(current_merge)
                        current_merge = [curr]
                merged_group.append(current_merge)
                
                # Create rectangles for each merged group
                for word_group in merged_group:
                    min_x = min(d["rect"]["x"] for d in word_group)
                    min_y = min(d["rect"]["y"] for d in word_group)
                    max_x = max(d["rect"]["x"] + d["rect"]["w"] for d in word_group)
                    max_y = max(d["rect"]["y"] + d["rect"]["h"] for d in word_group)
                    
                    combined_texts = [d["text"] for d in word_group if d["text"]]
                    combined_text = " ".join(combined_texts)
                    
                    descriptions = []
                    for d in word_group:
                        if d["description"] and d["description"] not in descriptions:
                            descriptions.append(d["description"])
                    combined_desc = "; ".join(descriptions)
                    
                    merged_diffs.append({
                        "type": dtype,
                        "category": cat,
                        "text": combined_text,
                        "rect": {
                            "x": min_x,
                            "y": min_y,
                            "w": max_x - min_x,
                            "h": max_y - min_y
                        },
                        "description": combined_desc,
                        "source": word_group[0].get("source", "DocumentEngine"),
                        "line_key": lkey
                    })
                continue
                
            # Non-text (e.g. Visual, Image) differences -> standard distance-based clustering
            # Sort by y first, then x
            group.sort(key=lambda d: (d["rect"]["y"], d["rect"]["x"]))
            
            n = len(group)
            parent = list(range(n))
            
            def find(i):
                if parent[i] == i:
                    return i
                parent[i] = find(parent[i])
                return parent[i]
                
            def union(i, j):
                root_i = find(i)
                root_j = find(j)
                if root_i != root_j:
                    parent[root_i] = root_j
                    
            def should_merge(d1, d2):
                r1 = d1["rect"]
                r2 = d2["rect"]
                
                # Vertical distance
                y_dist = max(0.0, r2["y"] - (r1["y"] + r1["h"]), r1["y"] - (r2["y"] + r2["h"]))
                # Horizontal distance
                x_dist = max(0.0, r2["x"] - (r1["x"] + r1["w"]), r1["x"] - (r2["x"] + r2["w"]))
                
                return y_dist <= y_threshold and x_dist <= x_threshold
                
            for i in range(n):
                for j in range(i + 1, n):
                    if should_merge(group[i], group[j]):
                        union(i, j)
                        
            # Gather groups
            grouped_diffs = {}
            for i in range(n):
                root = find(i)
                if root not in grouped_diffs:
                    grouped_diffs[root] = []
                grouped_diffs[root].append(group[i])
                
            # Merge each group
            for g in grouped_diffs.values():
                min_x = min(d["rect"]["x"] for d in g)
                min_y = min(d["rect"]["y"] for d in g)
                max_x = max(d["rect"]["x"] + d["rect"]["w"] for d in g)
                max_y = max(d["rect"]["y"] + d["rect"]["h"] for d in g)
                
                combined_texts = [d["text"] for d in g if d["text"]]
                combined_text = " ".join(combined_texts)
                
                descriptions = []
                for d in g:
                    if d["description"] and d["description"] not in descriptions:
                        descriptions.append(d["description"])
                combined_desc = "; ".join(descriptions)
                
                merged_diffs.append({
                    "type": dtype,
                    "category": cat,
                    "text": combined_text,
                    "rect": {
                        "x": min_x,
                        "y": min_y,
                        "w": max_x - min_x,
                        "h": max_y - min_y
                    },
                    "description": combined_desc,
                    "source": g[0].get("source", "DocumentEngine")
                })
                
        return merged_diffs

    @staticmethod
    def rects_intersect(r1: dict, r2: dict, padding: float = 2.0) -> bool:
        """Checks if two rectangles intersect with a small padding."""
        x1 = r1["x"] - padding
        y1 = r1["y"] - padding
        w1 = r1["w"] + 2 * padding
        h1 = r1["h"] + 2 * padding
        
        x2 = r2["x"] - padding
        y2 = r2["y"] - padding
        w2 = r2["w"] + 2 * padding
        h2 = r2["h"] + 2 * padding
        
        return not (x1 + w1 < x2 or x2 + w2 < x1 or y1 + h1 < y2 or y2 + h2 < y1)

    @classmethod
    def merge(cls, pages_diff: list) -> list:
        """
        Deduplicates identical detections and resolves overlapping difference rectangles.
        Favors specific categories over general layout or visual diffs:
        Hierarchy: text > image > drawing > line > underline > table > layout > page > visual
        """
        category_weights = {
            "text": 10,
            "image": 9,
            "drawing": 8,
            "line": 7,
            "underline": 7,
            "strikethrough": 7,
            "highlight": 7,
            "rectangle": 7,
            "circle": 7,
            "table": 7,
            "layout": 6,
            "page": 4,
            "visual": 1
        }
        
        merged_pages_diff = []
        
        for page_data in pages_diff:
            pno = page_data["page_index"]
            diffs = page_data["differences"]
            
            if not diffs:
                merged_pages_diff.append(page_data)
                continue
                
            # 1. Merge adjacent differences of the same type and category
            merged_adj = cls.merge_adjacent_differences(diffs)
            
            # 2. Deduplicate identical rectangles and filter tiny boxes
            unique_diffs = []
            seen = set()
            for d in merged_adj:
                r = d["rect"]
                # Filter out tiny/noisy boxes (less than 3px in either dimension)
                if r["w"] < 3.0 or r["h"] < 3.0:
                    continue
                
                # Safety Valve size-filter to exclude massive layout/drawing addition ghost boxes
                if d["type"] == "addition" and d["category"] in ["layout", "drawing"]:
                    area = r["w"] * r["h"]
                    if area > (595.0 * 842.0 * 0.5):
                        continue

                # Round coordinates to eliminate floating point duplicates
                key = (
                    d["type"],
                    d["category"],
                    round(r["x"], 1),
                    round(r["y"], 1),
                    round(r["w"], 1),
                    round(r["h"], 1)
                )
                if key not in seen:
                    seen.add(key)
                    unique_diffs.append(d)
            
            # 3. Resolve overlapping bounding boxes
            # Sort by specificity weight (highest first)
            unique_diffs.sort(key=lambda x: category_weights.get(x["category"], 0), reverse=True)
            
            resolved_diffs = []
            for d in unique_diffs:
                r_d = d["rect"]
                overlap_found = False
                
                for existing in resolved_diffs:
                    r_e = existing["rect"]
                    
                    # Overlap checks to avoid duplicates - less aggressive thresholds
                    ratio_d = cls.get_overlap_ratio(r_d, r_e)
                    ratio_e = cls.get_overlap_ratio(r_e, r_d)
                    iou = cls.get_iou(r_d, r_e)
                    
                    if cls.rects_intersect(r_d, r_e) or ratio_d > 0.7 or ratio_e > 0.7 or iou > 0.5:
                        # Existing item is more specific, so discard current d
                        overlap_found = True
                        
                        # Add supplementary note to description if helpful
                        if existing["category"] != d["category"]:
                            supp_note = f" (also flagged as {d['category']})"
                            if supp_note not in existing["description"]:
                                existing["description"] += supp_note
                        break
                        
                if not overlap_found:
                    resolved_diffs.append(d)
            
            # Sort final differences by page position (top-to-bottom, left-to-right)
            resolved_diffs.sort(key=lambda x: (x["rect"]["y"], x["rect"]["x"]))
            
            merged_pages_diff.append({
                "page_index": pno,
                "differences": resolved_diffs
            })
            
        return merged_pages_diff
