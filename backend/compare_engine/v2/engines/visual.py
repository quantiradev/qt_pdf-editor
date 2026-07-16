import fitz
import cv2
import numpy as np
import uuid
from typing import List, Dict, Any
from skimage.metrics import structural_similarity as ssim

class VisualVerificationEngine:
    """
    Stage 8 - Visual Verification (SSIM Fallback).
    Renders pages and runs SSIM only on regions NOT explained by semantic engines.
    Uses a density heuristic to dynamically scale from 150 DPI to 300 DPI.
    Masks out the union of all parsed elements in both original and revised pages to eliminate reflow false positives.
    """

    @classmethod
    def compare_page(cls, 
                     page_orig: fitz.Page, 
                     page_rev: fitz.Page, 
                     page_num: int,
                     explained_rects: List[Dict[str, float]]) -> List[Dict[str, Any]]:
        """
        Performs visual comparison on unexplained zones by masking out all parsed objects.
        """
        w, h = page_orig.rect.width, page_orig.rect.height
        if w <= 0 or h <= 0:
            return []

        # 1. Bounding Box Density Heuristic
        # Calculate total unmasked area ratio to decide DPI
        total_page_area = w * h
        explained_area = sum(r["w"] * r["h"] for r in explained_rects)
        unexplained_ratio = (total_page_area - explained_area) / max(1.0, total_page_area)
        
        # If unexplained area is dense, or we have large unexplained ratio, use 300 DPI, else 150 DPI
        dpi = 150
        if unexplained_ratio > 0.40:
            dpi = 300

        zoom = dpi / 72.0
        matrix = fitz.Matrix(zoom, zoom)

        # Render original and revised pages to pixmaps
        pix_o = page_orig.get_pixmap(matrix=matrix)
        pix_r = page_rev.get_pixmap(matrix=matrix)

        try:
            img_o = cv2.imdecode(np.frombuffer(pix_o.tobytes("png"), np.uint8), cv2.IMREAD_GRAYSCALE)
            img_r = cv2.imdecode(np.frombuffer(pix_r.tobytes("png"), np.uint8), cv2.IMREAD_GRAYSCALE)
        except Exception as e:
            print(f"[VisualEngine] Error rendering images: {e}")
            return []
        finally:
            pix_o = pix_r = None

        if img_o is None or img_r is None:
            return []

        # Resize to match dimensions if there are small variations
        if img_o.shape != img_r.shape:
            img_r = cv2.resize(img_r, (img_o.shape[1], img_o.shape[0]))

        # 2. Create the visual mask (using union of all explained/parsed rects)
        mask = np.full(img_o.shape, 255, dtype=np.uint8)

        img_h, img_w = img_o.shape
        scale_x = img_w / w
        scale_y = img_h / h

        # Apply explained page mask to both images
        for r in explained_rects:
            rx0 = int(r["x"] * scale_x)
            ry0 = int(r["y"] * scale_y)
            rx1 = int((r["x"] + r["w"]) * scale_x)
            ry1 = int((r["y"] + r["h"]) * scale_y)
            
            rx0 = max(0, min(rx0, img_w - 1))
            ry0 = max(0, min(ry0, img_h - 1))
            rx1 = max(0, min(rx1, img_w))
            ry1 = max(0, min(ry1, img_h))
            
            if rx1 > rx0 and ry1 > ry0:
                cv2.rectangle(mask, (rx0, ry0), (rx1, ry1), 0, -1)

        # Apply mask to images
        masked_o = cv2.bitwise_and(img_o, img_o, mask=mask)
        masked_r = cv2.bitwise_and(img_r, img_r, mask=mask)

        # 3. SSIM Comparison
        # Skip if mask is entirely empty (everything is explained)
        if cv2.countNonZero(mask) == 0:
            return []

        # Run SSIM
        score, diff_map = ssim(masked_o, masked_r, full=True)
        if score >= 0.9999:
            return []

        # Extract difference map
        diff_img = (diff_map * 255).astype("uint8")
        diff_img = cv2.bitwise_not(diff_img)
        diff_img = cv2.bitwise_and(diff_img, diff_img, mask=mask)

        # Threshold difference image
        _, thresh = cv2.threshold(diff_img, 30, 255, cv2.THRESH_BINARY)

        # Find contours of differences
        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        differences = []

        for contour in contours:
            area = cv2.contourArea(contour)
            # Filter noise
            if area < (5.0 * zoom):
                continue
                
            rx, ry, rw, rh = cv2.boundingRect(contour)
            
            # Map coordinates back to PDF points
            pdf_x = rx / scale_x
            pdf_y = ry / scale_y
            pdf_w = rw / scale_x
            pdf_h = rh / scale_y

            if pdf_w < 1.0 or pdf_h < 1.0:
                continue

            differences.append({
                "uuid": str(uuid.uuid4()),
                "difference_type": "Visual Modification",
                "object_type": "Raster Image",
                "page_number": page_num,
                "bounding_box": {
                    "x": pdf_x,
                    "y": pdf_y,
                    "w": pdf_w,
                    "h": pdf_h
                },
                "original_value": None,
                "revised_value": "[Raster Change]",
                "confidence_score": 0.85,
                "source_engine": "VisualEngine",
                
                # Legacy fields
                "type": "modification",
                "category": "visual",
                "text": "[Visual Difference]",
                "rect": {
                    "x": pdf_x,
                    "y": pdf_y,
                    "w": pdf_w,
                    "h": pdf_h
                },
                "description": "Raster visual change (handwritten mark, scanned change, or stamp)",
                "source": "VisualEngine"
            })

        return differences
