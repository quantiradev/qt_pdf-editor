class OverlayGenerator:
    @staticmethod
    def create_overlay(diff_type: str, category: str, text: str, rect: dict, description: str, source: str) -> dict:
        """
        Creates an overlay dictionary representation.
        Includes type, category, text, rect, description, and source module properties.
        """
        return {
            "type": diff_type,
            "category": category,
            "text": text,
            "rect": rect,
            "description": description,
            "source": source
        }
