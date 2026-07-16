import difflib

class TextComparer:
    @staticmethod
    def extract_words(page) -> list:
        words = []
        try:
            # Extract word structures: (x0, y0, x1, y1, "word", block_no, line_no, word_no)
            raw_words = page.get_text("words")
            for w in raw_words:
                txt = w[4].strip()
                if txt:
                    words.append({
                        "text": txt,
                        "bbox": (w[0], w[1], w[2], w[3]),
                        "block_no": w[5],
                        "line_no": w[6],
                        "word_no": w[7]
                    })
        except Exception as e:
            print(f"Error extracting words: {e}")
        return words

    @classmethod
    def compare(cls, doc_orig, doc_rev, pno) -> list:
        differences = []
        
        # Check page count bounds
        if pno >= doc_orig.page_count or pno >= doc_rev.page_count:
            return []
            
        orig_words = cls.extract_words(doc_orig[pno])
        rev_words = cls.extract_words(doc_rev[pno])
        
        # Compute page-level translation shift using matching words (extremely robust)
        tx, ty = 0.0, 0.0
        if orig_words and rev_words:
            orig_texts = [w["text"] for w in orig_words]
            rev_texts = [w["text"] for w in rev_words]
            matcher = difflib.SequenceMatcher(None, orig_texts, rev_texts, autojunk=False)
            matching_shifts_x = []
            matching_shifts_y = []
            for tag, i1, i2, j1, j2 in matcher.get_opcodes():
                if tag == "equal":
                    for k in range(i2 - i1):
                        o_w = orig_words[i1 + k]
                        r_w = rev_words[j1 + k]
                        matching_shifts_x.append(r_w["bbox"][0] - o_w["bbox"][0])
                        matching_shifts_y.append(r_w["bbox"][1] - o_w["bbox"][1])
            if matching_shifts_x:
                import numpy as np
                tx = float(np.median(matching_shifts_x))
                ty = float(np.median(matching_shifts_y))
                if abs(tx) < 0.5:
                    tx = 0.0
                if abs(ty) < 0.5:
                    ty = 0.0
        
        def group_words_into_lines(words: list) -> list:
            # Sort words to ensure reading order: block_no, line_no, word_no, x coordinate
            words.sort(key=lambda w: (w["block_no"], w["line_no"], w["word_no"], w["bbox"][0]))
            
            lines = []
            current_line_key = None
            current_line_words = []
            
            for w in words:
                key = (w["block_no"], w["line_no"])
                if key != current_line_key:
                    if current_line_words:
                        lines.append({
                            "text": " ".join(x["text"] for x in current_line_words),
                            "words": current_line_words
                        })
                    current_line_key = key
                    current_line_words = []
                current_line_words.append(w)
                
            if current_line_words:
                lines.append({
                    "text": " ".join(x["text"] for x in current_line_words),
                    "words": current_line_words
                })
                
            return lines

        orig_lines = group_words_into_lines(orig_words)
        rev_lines = group_words_into_lines(rev_words)
        
        orig_line_texts = [l["text"] for l in orig_lines]
        rev_line_texts = [l["text"] for l in rev_lines]
        
        # Line-level SequenceMatcher to align lines sequentially
        line_matcher = difflib.SequenceMatcher(None, orig_line_texts, rev_line_texts, autojunk=False)
        line_opcodes = line_matcher.get_opcodes()
        
        for tag, i1, i2, j1, j2 in line_opcodes:
            if tag == "equal":
                # Check for word movements (ignoring sub-pixel shifts)
                for k in range(i2 - i1):
                    o_line = orig_lines[i1 + k]
                    r_line = rev_lines[j1 + k]
                    
                    # Since texts are equal, they have the same words
                    n_words = min(len(o_line["words"]), len(r_line["words"]))
                    for idx in range(n_words):
                        o_w = o_line["words"][idx]
                        r_w = r_line["words"][idx]
                        o_x, o_y = o_w["bbox"][0], o_w["bbox"][1]
                        r_x, r_y = r_w["bbox"][0], r_w["bbox"][1]
                        
                        if abs((o_x + tx) - r_x) > 2.0 or abs((o_y + ty) - r_y) > 2.0:
                            differences.append({
                                "type": "modification",
                                "category": "text",
                                "text": r_w["text"],
                                "rect": {
                                    "x": r_w["bbox"][0],
                                    "y": r_w["bbox"][1],
                                    "w": r_w["bbox"][2] - r_w["bbox"][0],
                                    "h": r_w["bbox"][3] - r_w["bbox"][1]
                                },
                                "description": f"Word moved from ({o_x:.0f}, {o_y:.0f}) to ({r_x:.0f}, {r_y:.0f})",
                                "source": "TextComparer",
                                "line_key": f"{pno}_{r_w['block_no']}_{r_w['line_no']}"
                            })
                            
            elif tag == "delete":
                # Removed lines -> all words deleted
                for line_idx in range(i1, i2):
                    for o_w in orig_lines[line_idx]["words"]:
                        differences.append({
                            "type": "deletion",
                            "category": "text",
                            "text": o_w["text"],
                            "rect": {
                                "x": o_w["bbox"][0],
                                "y": o_w["bbox"][1],
                                "w": o_w["bbox"][2] - o_w["bbox"][0],
                                "h": o_w["bbox"][3] - o_w["bbox"][1]
                            },
                            "description": f"Removed word: '{o_w['text']}'",
                            "source": "TextComparer",
                            "line_key": f"{pno}_{o_w['block_no']}_{o_w['line_no']}"
                        })
                        
            elif tag == "insert":
                # Added lines -> all words added
                for line_idx in range(j1, j2):
                    for r_w in rev_lines[line_idx]["words"]:
                        differences.append({
                            "type": "addition",
                            "category": "text",
                            "text": r_w["text"],
                            "rect": {
                                "x": r_w["bbox"][0],
                                "y": r_w["bbox"][1],
                                "w": r_w["bbox"][2] - r_w["bbox"][0],
                                "h": r_w["bbox"][3] - r_w["bbox"][1]
                            },
                            "description": f"Added word: '{r_w['text']}'",
                            "source": "TextComparer",
                            "line_key": f"{pno}_{r_w['block_no']}_{r_w['line_no']}"
                        })
                        
            elif tag == "replace":
                # Block level replacements -> align words within the block
                orig_block_words = []
                for line_idx in range(i1, i2):
                    orig_block_words.extend(orig_lines[line_idx]["words"])
                    
                rev_block_words = []
                for line_idx in range(j1, j2):
                    rev_block_words.extend(rev_lines[line_idx]["words"])
                    
                orig_block_texts = [w["text"] for w in orig_block_words]
                rev_block_texts = [w["text"] for w in rev_block_words]
                
                word_matcher = difflib.SequenceMatcher(None, orig_block_texts, rev_block_texts, autojunk=False)
                word_opcodes = word_matcher.get_opcodes()
                
                for w_tag, wi1, wi2, wj1, wj2 in word_opcodes:
                    if w_tag == "equal":
                        # Check movements in matched block
                        for k in range(wi2 - wi1):
                            o_w = orig_block_words[wi1 + k]
                            r_w = rev_block_words[wj1 + k]
                            o_x, o_y = o_w["bbox"][0], o_w["bbox"][1]
                            r_x, r_y = r_w["bbox"][0], r_w["bbox"][1]
                            
                            if abs((o_x + tx) - r_x) > 2.0 or abs((o_y + ty) - r_y) > 2.0:
                                differences.append({
                                    "type": "modification",
                                    "category": "text",
                                    "text": r_w["text"],
                                    "rect": {
                                        "x": r_w["bbox"][0],
                                        "y": r_w["bbox"][1],
                                        "w": r_w["bbox"][2] - r_w["bbox"][0],
                                        "h": r_w["bbox"][3] - r_w["bbox"][1]
                                    },
                                    "description": f"Word moved from ({o_x:.0f}, {o_y:.0f}) to ({r_x:.0f}, {r_y:.0f})",
                                    "source": "TextComparer",
                                    "line_key": f"{pno}_{r_w['block_no']}_{r_w['line_no']}"
                                })
                                
                    elif w_tag == "replace":
                        if (wi2 - wi1) == (wj2 - wj1):
                            for k in range(wi2 - wi1):
                                o_w = orig_block_words[wi1 + k]
                                r_w = rev_block_words[wj1 + k]
                                differences.append({
                                    "type": "modification",
                                    "category": "text",
                                    "text": r_w["text"],
                                    "rect": {
                                        "x": r_w["bbox"][0],
                                        "y": r_w["bbox"][1],
                                        "w": r_w["bbox"][2] - r_w["bbox"][0],
                                        "h": r_w["bbox"][3] - r_w["bbox"][1]
                                    },
                                    "description": f"Word changed from '{o_w['text']}' to '{r_w['text']}'",
                                    "source": "TextComparer",
                                    "line_key": f"{pno}_{r_w['block_no']}_{r_w['line_no']}"
                                })
                        else:
                            for idx in range(wi1, wi2):
                                o_w = orig_block_words[idx]
                                differences.append({
                                    "type": "deletion",
                                    "category": "text",
                                    "text": o_w["text"],
                                    "rect": {
                                        "x": o_w["bbox"][0],
                                        "y": o_w["bbox"][1],
                                        "w": o_w["bbox"][2] - o_w["bbox"][0],
                                        "h": o_w["bbox"][3] - o_w["bbox"][1]
                                    },
                                    "description": f"Removed word: '{o_w['text']}'",
                                    "source": "TextComparer",
                                    "line_key": f"{pno}_{o_w['block_no']}_{o_w['line_no']}"
                                })
                            for idx in range(wj1, wj2):
                                r_w = rev_block_words[idx]
                                differences.append({
                                    "type": "addition",
                                    "category": "text",
                                    "text": r_w["text"],
                                    "rect": {
                                        "x": r_w["bbox"][0],
                                        "y": r_w["bbox"][1],
                                        "w": r_w["bbox"][2] - r_w["bbox"][0],
                                        "h": r_w["bbox"][3] - r_w["bbox"][1]
                                    },
                                    "description": f"Added word: '{r_w['text']}'",
                                    "source": "TextComparer",
                                    "line_key": f"{pno}_{r_w['block_no']}_{r_w['line_no']}"
                                })
                                
                    elif w_tag == "delete":
                        for idx in range(wi1, wi2):
                            o_w = orig_block_words[idx]
                            differences.append({
                                "type": "deletion",
                                "category": "text",
                                "text": o_w["text"],
                                "rect": {
                                    "x": o_w["bbox"][0],
                                    "y": o_w["bbox"][1],
                                    "w": o_w["bbox"][2] - o_w["bbox"][0],
                                    "h": o_w["bbox"][3] - o_w["bbox"][1]
                                },
                                "description": f"Removed word: '{o_w['text']}'",
                                "source": "TextComparer",
                                "line_key": f"{pno}_{o_w['block_no']}_{o_w['line_no']}"
                            })
                            
                    elif w_tag == "insert":
                        for idx in range(wj1, wj2):
                            r_w = rev_block_words[idx]
                            differences.append({
                                "type": "addition",
                                "category": "text",
                                "text": r_w["text"],
                                "rect": {
                                    "x": r_w["bbox"][0],
                                    "y": r_w["bbox"][1],
                                    "w": r_w["bbox"][2] - r_w["bbox"][0],
                                    "h": r_w["bbox"][3] - r_w["bbox"][1]
                                },
                                "description": f"Added word: '{r_w['text']}'",
                                "source": "TextComparer",
                                "line_key": f"{pno}_{r_w['block_no']}_{r_w['line_no']}"
                            })
                            
        return differences
