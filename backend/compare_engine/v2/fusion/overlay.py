from typing import Dict, Any

class OverlayGenerator:
    """
    Stage 10 - Overlay Engine.
    Ensures overlays tightly align to modified objects with zero offset shifts or excessive padding.
    Coordinates are kept in standard top-left origin format to match Web-ready HTML layout.
    """

    @staticmethod
    def create_overlay(diff_type: str, 
                       category: str, 
                       text: str, 
                       rect: Dict[str, float], 
                       description: str, 
                       source: str,
                       page_height: float) -> Dict[str, Any]:
        """
        Formats a tight overlay block mapping exactly to coordinates.
        Coordinates are maintained in top-left origin format (matching PyMuPDF and HTML).
        """
        if not rect or not isinstance(rect, dict):
            rect = {}

        pdf_x = rect.get("x", 0.0)
        pdf_y = rect.get("y", 0.0)
        width = rect.get("w", 0.0)
        height = rect.get("h", 0.0)

        # Fallback defaults for missing/None values
        pdf_x = pdf_x if pdf_x is not None else 0.0
        pdf_y = pdf_y if pdf_y is not None else 0.0
        width = width if width is not None else 0.0
        height = height if height is not None else 0.0

        # Enforce minimum size for visible highlights
        width = max(0.5, width)
        height = max(0.5, height)
        
        # Both PyMuPDF and HTML absolute coordinates use top-left origin (Y increases downwards).
        # No Y-axis flipping is needed.
        web_x = pdf_x
        web_y = pdf_y
        
        return {
            "type": diff_type,
            "category": category,
            "text": text,
            "rect": {
                "x": web_x,
                "y": web_y,
                "w": width,
                "h": height
            },
            "description": description,
            "source": source
        }
