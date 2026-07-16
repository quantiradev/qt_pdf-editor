import uuid
import re
import hashlib
from typing import List, Dict, Any, Tuple
import fitz
from compare_engine.v2.dom.models import DOMNode, FontInfo

class PDFDOMParser:
    """
    Parses a PDF document into a structured DOM representation.
    Stages:
      1. Parse raw layout objects (characters, words, spaces, tables, drawings, images, annotations, form fields).
      2. Construct parent-child relationships (Document -> Page -> Region -> Object).
      3. Run Stage 1.5: Document-Level Linking Pass (to stitch cross-page paragraphs/sentences).
    """

    @classmethod
    def parse(cls, pdf_path: str) -> DOMNode:
        doc = fitz.open(pdf_path)
        doc_id = str(uuid.uuid4())
        doc_node = DOMNode(
            id=doc_id,
            object_type="Document",
            page_number=0,
            bounding_box=[0.0, 0.0, 0.0, 0.0],
            content=pdf_path,
            metadata={
                "title": doc.metadata.get("title", ""),
                "author": doc.metadata.get("author", ""),
                "creator": doc.metadata.get("creator", ""),
                "producer": doc.metadata.get("producer", ""),
                "format": doc.metadata.get("format", ""),
                "page_count": doc.page_count
            }
        )

        for pno in range(doc.page_count):
            page = doc[pno]
            page_node = cls._parse_page(page, pno + 1, doc_id)
            page_node.parent_id = doc_id
            doc_node.children.append(page_node)

        doc.close()

        # Run Stage 1.5: Document-Level Linking Pass
        cls._stitch_cross_page_reflow(doc_node)

        return doc_node

    @classmethod
    def _parse_page(cls, page: fitz.Page, page_num: int, doc_id: str) -> DOMNode:
        page_rect = page.rect
        page_node = DOMNode(
            id=str(uuid.uuid4()),
            object_type="Page",
            page_number=page_num,
            bounding_box=[page_rect.x0, page_rect.y0, page_rect.x1, page_rect.y1],
            rotation=page.rotation,
            parent_id=doc_id
        )

        # 1. Parse Tables
        table_nodes, table_boxes = cls._extract_tables(page, page_num, page_node.id)
        page_node.children.extend(table_nodes)

        # 2. Parse Annotations
        annot_nodes = cls._extract_annotations(page, page_num, page_node.id)
        page_node.children.extend(annot_nodes)

        # 3. Parse Form Fields
        field_nodes = cls._extract_form_fields(page, page_num, page_node.id)
        page_node.children.extend(field_nodes)

        # 4. Parse Vector Drawings
        drawing_nodes = cls._extract_drawings(page, page_num, page_node.id)
        page_node.children.extend(drawing_nodes)

        # 5. Parse Images
        image_nodes = cls._extract_images(page, page_num, page_node.id)
        page_node.children.extend(image_nodes)

        # 6. Parse Text Elements (Headings, Paragraphs, Header/Footer, Sentences, Words, Characters, Spaces)
        text_nodes = cls._extract_text(page, page_num, page_node.id, table_boxes)
        page_node.children.extend(text_nodes)

        return page_node

    @classmethod
    def _extract_tables(cls, page: fitz.Page, page_num: int, page_id: str) -> Tuple[List[DOMNode], List[Tuple[float, float, float, float]]]:
        nodes = []
        boxes = []
        try:
            tables = page.find_tables()
            for i, tbl in enumerate(tables):
                bbox = list(tbl.bbox)
                boxes.append(tbl.bbox)
                tbl_node = DOMNode(
                    id=str(uuid.uuid4()),
                    object_type="Table",
                    page_number=page_num,
                    bounding_box=bbox,
                    parent_id=page_id,
                    metadata={"columns_count": len(tbl.cols), "rows_count": len(tbl.rows), "table_index": i}
                )

                for r_idx, row in enumerate(tbl.rows):
                    row_node = DOMNode(
                        id=str(uuid.uuid4()),
                        object_type="Table Row",
                        page_number=page_num,
                        bounding_box=list(row.bbox),
                        parent_id=tbl_node.id,
                        metadata={"row_index": r_idx}
                    )
                    tbl_node.children.append(row_node)

                    # Extract cells in row
                    for c_idx, cell in enumerate(tbl.cells):
                        # Ensure cell belongs to this row (check overlap or bounds)
                        # tbl.cells has coords and spans
                        # cell is a bounding box tuple (x0, y0, x1, y1)
                        if cell is not None and abs(cell[1] - row.bbox[1]) < 2.0 and abs(cell[3] - row.bbox[3]) < 2.0:
                            cell_node = DOMNode(
                                id=str(uuid.uuid4()),
                                object_type="Table Cell",
                                page_number=page_num,
                                bounding_box=list(cell),
                                parent_id=row_node.id,
                                metadata={"col_index": c_idx, "row_index": r_idx}
                            )
                            row_node.children.append(cell_node)
                nodes.append(tbl_node)
        except Exception as e:
            print(f"[DOMParser] Warning: failed to parse tables on page {page_num}: {e}")
        return nodes, boxes

    @classmethod
    def _extract_annotations(cls, page: fitz.Page, page_num: int, page_id: str) -> List[DOMNode]:
        nodes = []
        for annot in page.annots():
            rect = list(annot.rect)
            annot_type = annot.type[1]  # string type name
            obj_type = "Annotation"
            if annot_type.lower() in ("highlight", "underline", "strikeout", "squiggly"):
                obj_type = annot_type.capitalize()
            elif annot_type.lower() == "sig" or annot_type.lower() == "signature":
                obj_type = "Signature"

            nodes.append(DOMNode(
                id=str(uuid.uuid4()),
                object_type=obj_type,
                page_number=page_num,
                bounding_box=rect,
                parent_id=page_id,
                content=annot.info.get("content", ""),
                metadata={"annot_type": annot_type, "author": annot.info.get("title", ""), "subject": annot.info.get("subject", "")}
            ))
        return nodes

    @classmethod
    def _extract_form_fields(cls, page: fitz.Page, page_num: int, page_id: str) -> List[DOMNode]:
        nodes = []
        for widget in page.widgets():
            rect = list(widget.rect)
            nodes.append(DOMNode(
                id=str(uuid.uuid4()),
                object_type="Form Field",
                page_number=page_num,
                bounding_box=rect,
                parent_id=page_id,
                content=widget.field_value,
                metadata={"field_name": widget.field_name, "field_type": widget.field_type_string}
            ))
        return nodes

    @classmethod
    def _extract_drawings(cls, page: fitz.Page, page_num: int, page_id: str) -> List[DOMNode]:
        nodes = []
        try:
            drawings = page.get_drawings()
            for i, drawing in enumerate(drawings):
                rect = list(drawing["rect"])
                if rect[2] - rect[0] < 0 or rect[3] - rect[1] < 0:
                    continue
                # Give horizontal/vertical lines a tiny thickness for box metrics
                if rect[2] - rect[0] == 0:
                    rect[2] += 0.5
                if rect[3] - rect[1] == 0:
                    rect[3] += 0.5
                
                # Deduce lines, rectangles, highlights etc.
                shapes = [item[0] for item in drawing["items"]]
                nodes.append(DOMNode(
                    id=str(uuid.uuid4()),
                    object_type="Vector Drawing",
                    page_number=page_num,
                    bounding_box=rect,
                    parent_id=page_id,
                    metadata={"drawing_index": i, "shapes": shapes, "color": drawing.get("color"), "fill": drawing.get("fill"), "width": drawing.get("width", 1)}
                ))
        except Exception as e:
            print(f"[DOMParser] Warning: failed to parse drawings on page {page_num}: {e}")
        return nodes

    @classmethod
    def _extract_images(cls, page: fitz.Page, page_num: int, page_id: str) -> List[DOMNode]:
        nodes = []
        try:
            images = page.get_image_info(hashes=True)
            for i, img in enumerate(images):
                bbox = list(img["bbox"])
                if bbox[2] - bbox[0] <= 0 or bbox[3] - bbox[1] <= 0:
                    continue
                # Calculate simple identifier
                img_hash = img.get("digest")
                if img_hash:
                    hash_str = img_hash.hex()
                else:
                    hash_str = hashlib.md5(f"img_{page_num}_{i}".encode()).hexdigest()

                nodes.append(DOMNode(
                    id=str(uuid.uuid4()),
                    object_type="Image",
                    page_number=page_num,
                    bounding_box=bbox,
                    parent_id=page_id,
                    content=hash_str,
                    metadata={"width": img["width"], "height": img["height"], "colorspace": img.get("colorspace", 3), "xres": img.get("xres", 72), "yres": img.get("yres", 72)}
                ))
        except Exception as e:
            print(f"[DOMParser] Warning: failed to parse images on page {page_num}: {e}")
        return nodes

    @classmethod
    def _extract_text(cls, page: fitz.Page, page_num: int, page_id: str, table_boxes: List[Tuple[float, float, float, float]]) -> List[DOMNode]:
        nodes = []
        page_height = page.rect.height

        # Retrieve structural rawdict text
        raw = page.get_text("rawdict")
        
        for block in raw.get("blocks", []):
            if "lines" not in block:
                continue

            block_bbox = list(block["bbox"])
            if block_bbox[2] - block_bbox[0] <= 0 or block_bbox[3] - block_bbox[1] <= 0:
                continue

            # Classify Header / Footer
            is_header = block_bbox[1] < 45.0
            is_footer = block_bbox[3] > (page_height - 45.0)

            # Classify Heading vs Paragraph
            # Default to Paragraph unless fonts or sizing suggest Heading
            is_heading = False
            total_chars = 0
            max_size = 0.0
            total_size = 0.0
            
            for line in block.get("lines", []):
                for span in line.get("spans", []):
                    max_size = max(max_size, span.get("size", 10.0))
                    total_size += span.get("size", 10.0) * len(span.get("chars", []))
                    total_chars += len(span.get("chars", []))
            
            avg_size = total_size / max(1, total_chars)
            # Heuristic: Heading if average font size is relatively large (e.g. >13pt) or block is short and bold
            if avg_size > 13.0 or (avg_size > 11.5 and total_chars < 80):
                is_heading = True

            obj_type = "Paragraph"
            if is_header:
                obj_type = "Header"
            elif is_footer:
                obj_type = "Footer"
            elif is_heading:
                obj_type = "Heading"

            block_node = DOMNode(
                id=str(uuid.uuid4()),
                object_type=obj_type,
                page_number=page_num,
                bounding_box=block_bbox,
                parent_id=page_id,
                metadata={"block_no": block.get("number", 0)}
            )

            # Extract words and characters from spans
            words_in_block = []
            current_word_chars = []
            
            for line in block.get("lines", []):
                for span in line.get("spans", []):
                    span_font = FontInfo(
                        name=span.get("font", "Helvetica"),
                        size=span.get("size", 10.0),
                        color=span.get("color", 0),
                        flags=span.get("flags", 0)
                    )

                    for char in span.get("chars", []):
                        char_text = char.get("c", "")
                        char_bbox = list(char["bbox"])

                        char_node = DOMNode(
                            id=str(uuid.uuid4()),
                            object_type="Character",
                            page_number=page_num,
                            bounding_box=char_bbox,
                            parent_id=None,  # will assign later
                            content=char_text,
                            font_info=span_font
                        )

                        # Group characters into words/spaces
                        if char_text.isspace():
                            # Save previous word if any
                            if current_word_chars:
                                word_node = cls._build_word_from_chars(current_word_chars, page_num)
                                words_in_block.append(word_node)
                                current_word_chars = []
                            
                            # Make a Space node
                            space_node = DOMNode(
                                id=str(uuid.uuid4()),
                                object_type="Space",
                                page_number=page_num,
                                bounding_box=char_bbox,
                                content=char_text,
                                font_info=span_font
                            )
                            words_in_block.append(space_node)
                        else:
                            current_word_chars.append(char_node)

            if current_word_chars:
                word_node = cls._build_word_from_chars(current_word_chars, page_num)
                words_in_block.append(word_node)

            if not words_in_block:
                continue

            # Group words into Sentence nodes
            sentences = cls._group_words_into_sentences(words_in_block, page_num, block_node.id)
            block_node.children.extend(sentences)

            # Finalize parent-child bounds & link for block_node
            # Deduce block content
            block_node.content = " ".join([w.content for w in words_in_block if w.object_type == "Word"])
            
            # Map block to Table Cell if it lies inside a table cell
            assigned_to_table = False
            # Check if this text block falls inside any table cell
            # To do this, we can search the tables on the page if they were extracted.
            # But since tables are parsed first, we can find the cell that contains this block's center.
            block_center = ((block_bbox[0] + block_bbox[2]) / 2, (block_bbox[1] + block_bbox[3]) / 2)
            # Find in table_boxes
            # We will handle nested structure mapping in the orchestrator or directly here.
            # (See later, we'll keep it as layout hierarchy adjustment)
            
            nodes.append(block_node)

        # Restructure page hierarchy: Map Paragraphs inside Tables to the Table Cell children!
        cls._associate_paragraphs_to_cells(nodes, page_id)

        return nodes

    @classmethod
    def _build_word_from_chars(cls, chars: List[DOMNode], page_num: int) -> DOMNode:
        x0 = min(c.bounding_box[0] for c in chars)
        y0 = min(c.bounding_box[1] for c in chars)
        x1 = max(c.bounding_box[2] for c in chars)
        y1 = max(c.bounding_box[3] for c in chars)
        
        word_text = "".join(c.content for c in chars)
        word_id = str(uuid.uuid4())
        
        word_node = DOMNode(
            id=word_id,
            object_type="Word",
            page_number=page_num,
            bounding_box=[x0, y0, x1, y1],
            content=word_text,
            font_info=chars[0].font_info
        )
        
        # Link children
        for c in chars:
            c.parent_id = word_id
            word_node.children.append(c)
            
        return word_node

    @classmethod
    def _group_words_into_sentences(cls, words_and_spaces: List[DOMNode], page_num: int, block_id: str) -> List[DOMNode]:
        sentences = []
        current_sentence_items = []
        
        for item in words_and_spaces:
            current_sentence_items.append(item)
            # Sentence ends on periods/punctuation for Word object
            if item.object_type == "Word" and re.search(r'[.!?]$', item.content):
                sentence_node = cls._build_sentence_from_items(current_sentence_items, page_num, block_id)
                sentences.append(sentence_node)
                current_sentence_items = []

        if current_sentence_items:
            sentence_node = cls._build_sentence_from_items(current_sentence_items, page_num, block_id)
            sentences.append(sentence_node)
            
        return sentences

    @classmethod
    def _build_sentence_from_items(cls, items: List[DOMNode], page_num: int, block_id: str) -> DOMNode:
        x0 = min(i.bounding_box[0] for i in items)
        y0 = min(i.bounding_box[1] for i in items)
        x1 = max(i.bounding_box[2] for i in items)
        y1 = max(i.bounding_box[3] for i in items)
        
        sentence_text = "".join(i.content if i.object_type == "Word" else " " for i in items).strip()
        sentence_id = str(uuid.uuid4())
        
        sentence_node = DOMNode(
            id=sentence_id,
            object_type="Sentence",
            page_number=page_num,
            bounding_box=[x0, y0, x1, y1],
            parent_id=block_id,
            content=sentence_text
        )
        
        for i in items:
            i.parent_id = sentence_id
            sentence_node.children.append(i)
            
        return sentence_node

    @classmethod
    def _associate_paragraphs_to_cells(cls, page_nodes: List[DOMNode], page_id: str):
        """
        Locates Paragraph/Heading nodes that fall inside Table Cell boundaries,
        and moves them to be children of the Table Cell node, rather than page-level layout.
        """
        tables = [n for n in page_nodes if n.object_type == "Table"]
        text_blocks = [n for n in page_nodes if n.object_type in ("Paragraph", "Heading", "Header", "Footer")]
        
        if not tables or not text_blocks:
            return
            
        # Collect all cells
        cells = []
        for tbl in tables:
            for row in tbl.children:
                for cell in row.children:
                    cells.append(cell)
                    
        if not cells:
            return
            
        # Check containment
        blocks_to_remove = []
        for block in text_blocks:
            # Calculate block center coordinate
            bx = (block.bounding_box[0] + block.bounding_box[2]) / 2.0
            by = (block.bounding_box[1] + block.bounding_box[3]) / 2.0
            
            for cell in cells:
                cx0, cy0, cx1, cy1 = cell.bounding_box
                # If block center falls inside cell
                if cx0 <= bx <= cx1 and cy0 <= by <= cy1:
                    block.parent_id = cell.id
                    cell.children.append(block)
                    blocks_to_remove.append(block)
                    break
                    
        # Remove re-associated blocks from page root list
        for b in blocks_to_remove:
            if b in page_nodes:
                page_nodes.remove(b)

    @classmethod
    def _stitch_cross_page_reflow(cls, doc_node: DOMNode):
        """
        Stage 1.5 - Document-Level Linking Pass
        Links dangling Paragraph nodes at the bottom of Page N to the top Paragraph of Page N+1.
        Adds linked indicators in `metadata` for subsequent Myers-Diff linear stream retrieval.
        """
        pages = doc_node.children
        for i in range(len(pages) - 1):
            page_current = pages[i]
            page_next = pages[i + 1]
            
            # Find paragraphs in current page (exclude tables, headers, footers)
            paragraphs_current = [
                n for n in page_current.children 
                if n.object_type == "Paragraph"
            ]
            # Find paragraphs in next page
            paragraphs_next = [
                n for n in page_next.children 
                if n.object_type == "Paragraph"
            ]
            
            if not paragraphs_current or not paragraphs_next:
                continue
                
            # Bottom-most paragraph of current page
            bottom_para = max(paragraphs_current, key=lambda p: p.bounding_box[3])
            # Top-most paragraph of next page
            top_para = min(paragraphs_next, key=lambda p: p.bounding_box[1])
            
            # Check if bottom_para ends with terminal punctuation: . ! ?
            ends_cleanly = False
            if bottom_para.content:
                text = bottom_para.content.strip()
                if text and text[-1] in ('.', '!', '?'):
                    ends_cleanly = True
            
            # Heuristic: If it does not end with terminal punctuation and font properties match
            if not ends_cleanly and bottom_para.content and top_para.content:
                # Find font_info from first character
                font_bot = None
                font_top = None
                
                # Drill down to find FontInfo
                for sent in bottom_para.children:
                    for word in sent.children:
                        if word.object_type == "Word" and word.font_info:
                            font_bot = word.font_info
                            break
                    if font_bot: break
                    
                for sent in top_para.children:
                    for word in sent.children:
                        if word.object_type == "Word" and word.font_info:
                            font_top = word.font_info
                            break
                    if font_top: break
                
                # If fonts are matching
                if font_bot and font_top and font_bot.name == font_top.name and abs(font_bot.size - font_top.size) < 0.5:
                    # Link them!
                    bottom_para.metadata["next_linked_node_id"] = top_para.id
                    top_para.metadata["prev_linked_node_id"] = bottom_para.id
