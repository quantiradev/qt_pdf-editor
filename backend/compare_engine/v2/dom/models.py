from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any

@dataclass(slots=True)
class FontInfo:
    name: str
    size: float
    color: int
    flags: int

@dataclass(slots=True)
class DOMNode:
    id: str
    object_type: str  # e.g., 'Heading', 'Paragraph', 'Sentence', 'Word', 'Character', 'Space', 'Table', 'Table Row', 'Table Cell', etc.
    page_number: int  # 1-based page index/number
    bounding_box: List[float]  # [x0, y0, x1, y1] in PDF standard coordinates
    rotation: float = 0.0
    parent_id: Optional[str] = None
    children: List['DOMNode'] = field(default_factory=list)
    content: Optional[str] = None
    font_info: Optional[FontInfo] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert the node (and recursively children) into a serializable dictionary."""
        return {
            "id": self.id,
            "object_type": self.object_type,
            "page_number": self.page_number,
            "bounding_box": self.bounding_box,
            "rotation": self.rotation,
            "parent_id": self.parent_id,
            "content": self.content,
            "font_info": {
                "name": self.font_info.name,
                "size": self.font_info.size,
                "color": self.font_info.color,
                "flags": self.font_info.flags
            } if self.font_info else None,
            "metadata": self.metadata,
            "children": [child.to_dict() for child in self.children]
        }
