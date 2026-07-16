import difflib
from typing import List, Dict, Any, Tuple
import uuid
from compare_engine.v2.dom.models import DOMNode

class TextComparisonEngine:
    """
    Stage 3 - Reflow-proof Text Comparison.
    Compares the linear sequence of words/spaces in matched text blocks.
    Ignores coordinates during diffing, using them only to construct final overlays.
    """

    @classmethod
    def compare(cls, orig_block: DOMNode, rev_block: DOMNode) -> List[Dict[str, Any]]:
        """
        Tokenizes matched blocks into Word and Space nodes, performs alignment,
        and runs character-level diff only on highly similar word clusters.
        """
        orig_tokens = cls._linearize_block(orig_block)
        rev_tokens = cls._linearize_block(rev_block)

        orig_str = [tok.content for tok in orig_tokens]
        rev_str = [tok.content for tok in rev_tokens]

        matcher = difflib.SequenceMatcher(None, orig_str, rev_str, autojunk=False)
        opcodes = matcher.get_opcodes()

        differences = []

        for tag, i1, i2, j1, j2 in opcodes:
            if tag == "equal":
                continue

            elif tag == "insert":
                # Words/Spaces inserted
                for idx in range(j1, j2):
                    tok = rev_tokens[idx]
                    diff_type = "Space Inserted" if tok.object_type == "Space" else "Word Inserted"
                    differences.append(cls._make_diff(
                        diff_type=diff_type,
                        obj_type=tok.object_type,
                        page_num=tok.page_number,
                        bbox=tok.bounding_box,
                        orig_val=None,
                        rev_val=tok.content,
                        source_node=tok
                    ))

            elif tag == "delete":
                # Words/Spaces deleted
                for idx in range(i1, i2):
                    tok = orig_tokens[idx]
                    diff_type = "Space Deleted" if tok.object_type == "Space" else "Word Deleted"
                    differences.append(cls._make_diff(
                        diff_type=diff_type,
                        obj_type=tok.object_type,
                        page_num=tok.page_number,
                        bbox=tok.bounding_box,
                        orig_val=tok.content,
                        rev_val=None,
                        source_node=tok
                    ))

            elif tag == "replace":
                # Word replacement block
                del_sub = orig_tokens[i1:i2]
                ins_sub = rev_tokens[j1:j2]

                del_text = "".join(t.content for t in del_sub)
                ins_text = "".join(t.content for t in ins_sub)

                # Check if it is a 1-to-1 word replacement
                if len(del_sub) == len(ins_sub):
                    for k in range(len(del_sub)):
                        o_tok = del_sub[k]
                        r_tok = ins_sub[k]
                        differences.append(cls._make_diff(
                            diff_type="Word Modified",
                            obj_type="Word",
                            page_num=r_tok.page_number,
                            bbox=r_tok.bounding_box,
                            orig_val=o_tok.content,
                            rev_val=r_tok.content,
                            source_node=r_tok
                        ))
                else:
                    # Check text similarity ratio
                    sim = difflib.SequenceMatcher(None, del_text, ins_text, autojunk=False).ratio()

                    if sim >= 0.65:
                        # Run character-level diff to identify precise insertions/deletions (e.g. extra space/letter)
                        char_diffs = cls._character_level_diff(del_sub, ins_sub)
                        differences.extend(char_diffs)
                    else:
                        # Multi-word replacements: report modifications
                        combined_bbox = cls._combine_bboxes(del_sub + ins_sub)
                        page_num = ins_sub[0].page_number if ins_sub else del_sub[0].page_number
                        differences.append(cls._make_diff(
                            diff_type="Word Modified",
                            obj_type="Word",
                            page_num=page_num,
                            bbox=combined_bbox,
                            orig_val=del_text,
                            rev_val=ins_text,
                            source_node=ins_sub[0] if ins_sub else del_sub[0]
                        ))

        return differences

    @classmethod
    def compare_unmatched(cls, node: DOMNode, is_addition: bool) -> List[Dict[str, Any]]:
        """Handles entire unmatched text blocks, reporting them as block-level insertions or deletions."""
        text = node.content or ""
        diff_type = "Word Inserted" if is_addition else "Word Deleted"
        return [cls._make_diff(
            diff_type=diff_type,
            obj_type=node.object_type,
            page_num=node.page_number,
            bbox=node.bounding_box,
            orig_val=text if not is_addition else None,
            rev_val=text if is_addition else None,
            source_node=node
        )]

    @classmethod
    def _character_level_diff(cls, orig_tokens: List[DOMNode], rev_tokens: List[DOMNode]) -> List[Dict[str, Any]]:
        """Runs character-level comparison on a cluster of tokens to locate precise character/space edits."""
        orig_chars = cls._get_character_nodes(orig_tokens)
        rev_chars = cls._get_character_nodes(rev_tokens)

        o_str = [c.content for c in orig_chars]
        r_str = [c.content for c in rev_chars]

        matcher = difflib.SequenceMatcher(None, o_str, r_str, autojunk=False)
        opcodes = matcher.get_opcodes()

        diffs = []

        for tag, i1, i2, j1, j2 in opcodes:
            if tag == "equal":
                continue
            elif tag == "insert":
                for idx in range(j1, j2):
                    tok = rev_chars[idx]
                    diff_type = "Space Inserted" if tok.object_type == "Space" else "Character Inserted"
                    diffs.append(cls._make_diff(
                        diff_type=diff_type,
                        obj_type=tok.object_type,
                        page_num=tok.page_number,
                        bbox=tok.bounding_box,
                        orig_val=None,
                        rev_val=tok.content,
                        source_node=tok
                    ))
            elif tag == "delete":
                for idx in range(i1, i2):
                    tok = orig_chars[idx]
                    diff_type = "Space Deleted" if tok.object_type == "Space" else "Character Deleted"
                    diffs.append(cls._make_diff(
                        diff_type=diff_type,
                        obj_type=tok.object_type,
                        page_num=tok.page_number,
                        bbox=tok.bounding_box,
                        orig_val=tok.content,
                        rev_val=None,
                        source_node=tok
                    ))
            elif tag == "replace":
                # Report character substitution as Word Modified
                combined_bbox = cls._combine_bboxes(orig_chars[i1:i2] + rev_chars[j1:j2])
                page_num = rev_chars[j1].page_number if j2 > j1 else orig_chars[i1].page_number
                del_t = "".join(o_str[i1:i2])
                ins_t = "".join(r_str[j1:j2])
                
                diffs.append(cls._make_diff(
                    diff_type="Word Modified",
                    obj_type="Word",
                    page_num=page_num,
                    bbox=combined_bbox,
                    orig_val=del_t,
                    rev_val=ins_t,
                    source_node=rev_chars[j1] if j2 > j1 else orig_chars[i1]
                ))

        return diffs

    @classmethod
    def _linearize_block(cls, block: DOMNode) -> List[DOMNode]:
        """Flattens a Paragraph/Heading node into a sequence of Word and Space nodes in reading order."""
        tokens = []
        for sentence in block.children:
            for item in sentence.children:
                if item.object_type in ("Word", "Space"):
                    tokens.append(item)
        return tokens

    @classmethod
    def _get_character_nodes(cls, tokens: List[DOMNode]) -> List[DOMNode]:
        """Extracts Character and Space nodes from Word/Space tokens."""
        nodes = []
        for t in tokens:
            if t.object_type == "Space":
                nodes.append(t)
            elif t.object_type == "Word":
                nodes.extend(t.children)
        return nodes

    @classmethod
    def _combine_bboxes(cls, nodes: List[DOMNode]) -> List[float]:
        if not nodes:
            return [0.0, 0.0, 0.0, 0.0]
        x0 = min(n.bounding_box[0] for n in nodes)
        y0 = min(n.bounding_box[1] for n in nodes)
        x1 = max(n.bounding_box[2] for n in nodes)
        y1 = max(n.bounding_box[3] for n in nodes)
        return [x0, y0, x1, y1]

    @classmethod
    def _make_diff(cls, diff_type: str, obj_type: str, page_num: int, bbox: List[float],
                   orig_val: Any, rev_val: Any, source_node: DOMNode) -> Dict[str, Any]:
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
            "source_engine": "TextEngine",
            
            # Legacy backward-compatible fields
            "type": "addition" if "Inserted" in diff_type or "Added" in diff_type else ("deletion" if "Deleted" in diff_type or "Removed" in diff_type else "modification"),
            "category": "text",
            "text": rev_val if rev_val is not None else orig_val,
            "rect": {
                "x": bbox[0],
                "y": bbox[1],
                "w": max(0.0, bbox[2] - bbox[0]),
                "h": max(0.0, bbox[3] - bbox[1])
            },
            "description": f"{diff_type}: {orig_val or ''} -> {rev_val or ''}",
            "source": "TextEngine"
        }
