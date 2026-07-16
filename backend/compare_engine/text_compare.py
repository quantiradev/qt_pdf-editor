import difflib

class TextComparer:
    @staticmethod
    def extract_words(page) -> list:
        words = []
        try:
            # Extract raw words and sort them strictly in reading order (top-to-bottom, left-to-right)
            raw_words = page.get_text("words")
            # Sort by Y-coordinate first (rounded to nearest 5 to handle slight baseline jitter), then X-coordinate
            raw_words.sort(key=lambda w: (round(w[1] / 5) * 5, w[0]))
            
            for w in raw_words:
                txt = w[4].strip()
                if txt:
                    words.append({
                        "text": txt,
                        "bbox": (w[0], w[1], w[2], w[3])
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
            
        # 1. Flat Extraction (No grouping by lines or blocks)
        orig_words = cls.extract_words(doc_orig[pno])
        rev_words = cls.extract_words(doc_rev[pno])
        
        orig_texts = [w["text"] for w in orig_words]
        rev_texts = [w["text"] for w in rev_words]
        
        # 2. Flat 1D Sequence Alignment
        matcher = difflib.SequenceMatcher(None, orig_texts, rev_texts, autojunk=False)
        opcodes = matcher.get_opcodes()
        
        # 3. Strict 1-to-1 Pointer Mapping
        for tag, i1, i2, j1, j2 in opcodes:
            if tag == "insert":
                for k in range(j1, j2):
                    r_w = rev_words[k]
                    differences.append(cls._format_diff("addition", r_w, f"Added: '{r_w['text']}'", pno))
            
            elif tag == "delete":
                for k in range(i1, i2):
                    o_w = orig_words[k]
                    differences.append(cls._format_diff("deletion", o_w, f"Removed: '{o_w['text']}'", pno))
            
            elif tag == "replace":
                # Handle direct 1-to-1 replacements
                limit = min(i2 - i1, j2 - j1)
                for k in range(limit):
                    o_w = orig_words[i1 + k]
                    r_w = rev_words[j1 + k]
                    differences.append(cls._format_diff("modification", r_w, f"Modified: '{o_w['text']}' -> '{r_w['text']}'", pno))
                
                # Handle leftover deletions (if original had more words than revised)
                if (i2 - i1) > limit:
                    for k in range(i1 + limit, i2):
                        o_w = orig_words[k]
                        differences.append(cls._format_diff("deletion", o_w, f"Removed: '{o_w['text']}'", pno))
                
                # Handle leftover insertions (if revised had more words than original)
                if (j2 - j1) > limit:
                    for k in range(j1 + limit, j2):
                        r_w = rev_words[k]
                        differences.append(cls._format_diff("addition", r_w, f"Added: '{r_w['text']}'", pno))
                        
        return differences

    @staticmethod
    def _format_diff(diff_type: str, word_node: dict, description: str, pno: int) -> dict:
        """Helper to format the output dictionary consistently."""
        rect = word_node["bbox"]
        return {
            "type": diff_type,
            "category": "text",
            "text": word_node["text"],
            "rect": {
                "x": rect[0],
                "y": rect[1],
                "w": max(0.0, rect[2] - rect[0]),
                "h": max(0.0, rect[3] - rect[1])
            },
            "description": description,
            "source": "TextComparer",
            # Generate a pseudo-line key based on the Y-coordinate for the merger to use
            "line_key": f"{pno}_{round(rect[1] / 10)}" 
        }