import fitz

class ComparisonReportGenerator:
    @staticmethod
    def generate(summary: dict) -> bytes:
        """
        Generates a detailed A4 PDF comparison report detailing:
        - Page differences
        - Text modifications, additions, and deletions
        - Image substitutions, movements, or scaling
        - Visual/rendering layout differences
        Includes the page number, category, description, bounding rectangle, and the source module.
        """
        doc = fitz.open()
        page = doc.new_page(width=595, height=842)
        
        # Title and basic header details
        page.insert_text((50, 50), "PDFForge PDF Comparison Engine v2 Report", fontname="hebo", fontsize=16, color=(0.09, 0.22, 0.52))
        page.insert_text((50, 75), f"Original Document Page Count: {summary.get('page_count_original', 0)}", fontname="helv", fontsize=9.5)
        page.insert_text((50, 92), f"Revised Document Page Count: {summary.get('page_count_revised', 0)}", fontname="helv", fontsize=9.5)
        
        orig_pc = summary.get("page_count_original", 0)
        rev_pc = summary.get("page_count_revised", 0)
        y = 115
        
        # Page count changes
        if orig_pc != rev_pc:
            page.insert_text((50, y), "Page Layout Changes:", fontname="hebo", fontsize=11, color=(0.7, 0.1, 0.1))
            y += 16
            if rev_pc > orig_pc:
                page.insert_text((55, y), f"- Added pages: Pages {orig_pc + 1} to {rev_pc} exist only in the revised version.", fontname="helv", fontsize=9)
            else:
                page.insert_text((55, y), f"- Removed pages: Pages {rev_pc + 1} to {orig_pc} were deleted in the revised version.", fontname="helv", fontsize=9)
            y += 24
            
        stats = summary.get("summary", {})
        page.insert_text((50, y), "Summary Metrics:", fontname="hebo", fontsize=11)
        y += 16
        page.insert_text((55, y), f"• Total Additions (Green): {stats.get('additions', 0)} items", fontname="helv", fontsize=9, color=(0.1, 0.45, 0.1))
        page.insert_text((55, y + 14), f"• Total Deletions (Red): {stats.get('deletions', 0)} items", fontname="helv", fontsize=9, color=(0.7, 0.1, 0.1))
        page.insert_text((55, y + 28), f"• Total Modifications (Yellow): {stats.get('modifications', 0)} items", fontname="helv", fontsize=9, color=(0.7, 0.5, 0.1))
        y += 50
        
        page.insert_text((50, y), "Comparison Difference Logs:", fontname="hebo", fontsize=11)
        y += 20
        
        for p_diff in summary.get("pages", []):
            pno = p_diff.get("page_index", 0) + 1
            diffs = p_diff.get("differences", [])
            if not diffs:
                continue
                
            for d in diffs:
                if y > 790:
                    page = doc.new_page(width=595, height=842)
                    y = 50
                    
                category = d.get("category", "General").upper()
                diff_type = d.get("type", "Change").capitalize()
                desc = d.get("description", "")
                rect = d.get("rect", {})
                source = d.get("source", "VisualComparer")
                
                bbox_str = ""
                if rect:
                    bbox_str = f"at bbox ({rect.get('x', 0):.0f}, {rect.get('y', 0):.0f}, {rect.get('w', 0):.0f}x{rect.get('h', 0):.0f})"
                    
                log_line = f"Page {pno} | [{category}] {diff_type}: {desc} {bbox_str} (Detected by {source})"
                
                # Truncate line if it's too long
                if len(log_line) > 105:
                    log_line = log_line[:102] + "..."
                    
                color = (0.2, 0.2, 0.2)
                if d.get("type") == "addition":
                    color = (0.1, 0.45, 0.1)
                elif d.get("type") == "deletion":
                    color = (0.7, 0.1, 0.1)
                elif d.get("type") == "modification":
                    color = (0.7, 0.5, 0.1)
                    
                page.insert_text((50, y), log_line, fontname="helv", fontsize=8, color=color)
                y += 14
                
        buf = doc.tobytes(garbage=3, deflate=True)
        doc.close()
        return buf
