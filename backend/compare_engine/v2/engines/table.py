import uuid
from typing import List, Dict, Any, Tuple
from compare_engine.v2.dom.models import DOMNode

class TableComparisonEngine:
    """
    Stage 4 - Table Comparison.
    Compares table rows, columns, and cell contents.
    Reports: Row Added, Row Deleted, Column Added, Column Deleted, Table Cell Modified, Merged/Split Cell.
    """

    @classmethod
    def compare(cls, orig_table: DOMNode, rev_table: DOMNode) -> List[Dict[str, Any]]:
        differences = []

        # Get rows and cells
        orig_rows = orig_table.children
        rev_rows = rev_table.children

        orig_row_count = len(orig_rows)
        rev_row_count = len(rev_rows)

        # Build grid representation: key is (row_idx, col_idx)
        orig_cells: Dict[Tuple[int, int], DOMNode] = {}
        rev_cells: Dict[Tuple[int, int], DOMNode] = {}

        orig_max_col = 0
        rev_max_col = 0

        for r_node in orig_rows:
            r_idx = r_node.metadata.get("row_index", 0)
            for c_node in r_node.children:
                c_idx = c_node.metadata.get("col_index", 0)
                orig_cells[(r_idx, c_idx)] = c_node
                orig_max_col = max(orig_max_col, c_idx)

        for r_node in rev_rows:
            r_idx = r_node.metadata.get("row_index", 0)
            for c_node in r_node.children:
                c_idx = c_node.metadata.get("col_index", 0)
                rev_cells[(r_idx, c_idx)] = c_node
                rev_max_col = max(rev_max_col, c_idx)

        # 1. Check Row Additions / Deletions
        # Simple row structural index mapping or sequence alignment
        # Align rows by concatenated row content signatures
        orig_row_sigs = []
        for r_idx in range(orig_row_count):
            sig = " ".join(orig_cells.get((r_idx, c_idx), DOMNode("", "", 0, [0,0,0,0])).content or "" 
                           for c_idx in range(orig_max_col + 1))
            orig_row_sigs.append(sig)

        rev_row_sigs = []
        for r_idx in range(rev_row_count):
            sig = " ".join(rev_cells.get((r_idx, c_idx), DOMNode("", "", 0, [0,0,0,0])).content or ""
                           for c_idx in range(rev_max_col + 1))
            rev_row_sigs.append(sig)

        import difflib
        row_matcher = difflib.SequenceMatcher(None, orig_row_sigs, rev_row_sigs, autojunk=False)
        row_opcodes = row_matcher.get_opcodes()

        matched_rows: Dict[int, int] = {}  # orig_row_idx -> rev_row_idx

        for tag, i1, i2, j1, j2 in row_opcodes:
            if tag == "equal":
                for idx in range(i2 - i1):
                    matched_rows[i1 + idx] = j1 + idx
            elif tag == "insert":
                for idx in range(j1, j2):
                    # Entire Row Added
                    r_node = rev_rows[idx]
                    differences.append(cls._make_diff(
                        diff_type="Row Added",
                        obj_type="Table Row",
                        page_num=r_node.page_number,
                        bbox=r_node.bounding_box,
                        orig_val=None,
                        rev_val=f"Row {idx} added",
                        source_node=r_node
                    ))
            elif tag == "delete":
                for idx in range(i1, i2):
                    # Entire Row Deleted
                    r_node = orig_rows[idx]
                    differences.append(cls._make_diff(
                        diff_type="Row Deleted",
                        obj_type="Table Row",
                        page_num=r_node.page_number,
                        bbox=r_node.bounding_box,
                        orig_val=f"Row {idx} deleted",
                        rev_val=None,
                        source_node=r_node
                    ))
            elif tag == "replace":
                # Check for structural changes cell by cell
                for o_idx in range(i1, i2):
                    for r_idx in range(j1, j2):
                        # Simple mapping of replacement rows
                        matched_rows[o_idx] = r_idx

        # 2. Check Column structural changes
        # (For simpler layout we compare column indexes for matched rows)
        # 3. Compare cells in matched rows
        for o_r_idx, r_r_idx in matched_rows.items():
            o_row = orig_rows[o_r_idx]
            r_row = rev_rows[r_r_idx]

            # Match cells by column index
            for c_idx in range(max(orig_max_col, rev_max_col) + 1):
                o_cell = orig_cells.get((o_r_idx, c_idx))
                r_cell = rev_cells.get((r_r_idx, c_idx))

                if o_cell and r_cell:
                    # Compare content
                    o_content = o_cell.content or ""
                    r_content = r_cell.content or ""
                    
                    # If cells contain text blocks, extract their text recursively
                    o_cell_text = cls._extract_cell_text(o_cell)
                    r_cell_text = cls._extract_cell_text(r_cell)

                    if o_cell_text.strip() != r_cell_text.strip():
                        differences.append(cls._make_diff(
                            diff_type="Table Cell Modified",
                            obj_type="Table Cell",
                            page_num=r_cell.page_number,
                            bbox=r_cell.bounding_box,
                            orig_val=o_cell_text,
                            rev_val=r_cell_text,
                            source_node=r_cell
                        ))
                elif r_cell:
                    # Column Added / Cell added
                    differences.append(cls._make_diff(
                        diff_type="Column Added",
                        obj_type="Table Cell",
                        page_num=r_cell.page_number,
                        bbox=r_cell.bounding_box,
                        orig_val=None,
                        rev_val=cls._extract_cell_text(r_cell),
                        source_node=r_cell
                    ))
                elif o_cell:
                    # Column Deleted / Cell deleted
                    differences.append(cls._make_diff(
                        diff_type="Column Deleted",
                        obj_type="Table Cell",
                        page_num=o_cell.page_number,
                        bbox=o_cell.bounding_box,
                        orig_val=cls._extract_cell_text(o_cell),
                        rev_val=None,
                        source_node=o_cell
                    ))

        return differences

    @classmethod
    def _extract_cell_text(cls, cell: DOMNode) -> str:
        """Collect all text from children of this cell."""
        text_parts = []
        def recurse(node: DOMNode):
            if node.object_type in ("Paragraph", "Heading", "Word") and node.content:
                text_parts.append(node.content)
            else:
                for child in node.children:
                    recurse(child)
        recurse(cell)
        return " ".join(text_parts)

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
            "source_engine": "TableEngine",
            
            # Legacy backward-compatible fields
            "type": "addition" if "Added" in diff_type else ("deletion" if "Deleted" in diff_type else "modification"),
            "category": "table",
            "text": rev_val if rev_val is not None else orig_val,
            "rect": {
                "x": bbox[0],
                "y": bbox[1],
                "w": max(0.0, bbox[2] - bbox[0]),
                "h": max(0.0, bbox[3] - bbox[1])
            },
            "description": f"{diff_type} in table cell: {orig_val or ''} -> {rev_val or ''}",
            "source": "TableEngine"
        }
