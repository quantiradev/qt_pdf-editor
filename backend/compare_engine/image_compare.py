import hashlib

class ImageComparer:
    @staticmethod
    def get_images_on_page(doc, pno) -> list:
        images = []
        try:
            page = doc[pno]
            img_infos = page.get_image_info(xrefs=True)
            for info in img_infos:
                xref = info.get("xref", 0)
                img_hash = ""
                if xref > 0:
                    try:
                        img_data = doc.extract_image(xref)
                        if img_data:
                            img_hash = hashlib.sha256(img_data["image"]).hexdigest()
                    except Exception:
                        pass
                
                bbox = info["bbox"] # (x0, y0, x1, y1)
                images.append({
                    "bbox": bbox,
                    "width": info["width"],
                    "height": info["height"],
                    "hash": img_hash,
                    "xref": xref
                })
        except Exception as e:
            print(f"Error getting images on page {pno}: {e}")
        return images

    @staticmethod
    def get_iou(boxA, boxB) -> float:
        xA = max(boxA[0], boxB[0])
        yA = max(boxA[1], boxB[1])
        xB = min(boxA[2], boxB[2])
        yB = min(boxA[3], boxB[3])
        interArea = max(0, xB - xA) * max(0, yB - yA)
        boxAArea = (boxA[2] - boxA[0]) * (boxA[3] - boxA[1])
        boxBArea = (boxB[2] - boxB[0]) * (boxB[3] - boxB[1])
        unionArea = boxAArea + boxBArea - interArea
        return interArea / unionArea if unionArea > 0 else 0

    @classmethod
    def compare(cls, doc_orig, doc_rev, pno) -> list:
        differences = []
        
        # Check page count bounds
        if pno >= doc_orig.page_count or pno >= doc_rev.page_count:
            return []
            
        orig_imgs = cls.get_images_on_page(doc_orig, pno)
        rev_imgs = cls.get_images_on_page(doc_rev, pno)
        
        matched_orig = set()
        matched_rev = set()
        
        # 1. Match Exact (same hash, same bbox)
        for i, o in enumerate(orig_imgs):
            for j, r in enumerate(rev_imgs):
                if j in matched_rev:
                    continue
                if o["hash"] == r["hash"] and o["hash"] != "":
                    # Bounding box closeness within 1.5 points
                    if (abs(o["bbox"][0] - r["bbox"][0]) < 1.5 and
                        abs(o["bbox"][1] - r["bbox"][1]) < 1.5 and
                        abs(o["bbox"][2] - r["bbox"][2]) < 1.5 and
                        abs(o["bbox"][3] - r["bbox"][3]) < 1.5):
                        matched_orig.add(i)
                        matched_rev.add(j)
                        break

        # 2. Match Moved or Resized Images (same hash, different location/size)
        for i, o in enumerate(orig_imgs):
            if i in matched_orig:
                continue
            for j, r in enumerate(rev_imgs):
                if j in matched_rev:
                    continue
                if o["hash"] == r["hash"] and o["hash"] != "":
                    matched_orig.add(i)
                    matched_rev.add(j)
                    
                    # Check size change
                    w_o, h_o = o["bbox"][2] - o["bbox"][0], o["bbox"][3] - o["bbox"][1]
                    w_r, h_r = r["bbox"][2] - r["bbox"][0], r["bbox"][3] - r["bbox"][1]
                    
                    desc = []
                    if abs(w_o - w_r) > 1.5 or abs(h_o - h_r) > 1.5:
                        desc.append(f"resized from {w_o:.0f}x{h_o:.0f} to {w_r:.0f}x{h_r:.0f}")
                    
                    # Check position change
                    if abs(o["bbox"][0] - r["bbox"][0]) >= 1.5 or abs(o["bbox"][1] - r["bbox"][1]) >= 1.5:
                        desc.append(f"moved from ({o['bbox'][0]:.0f}, {o['bbox'][1]:.0f}) to ({r['bbox'][0]:.0f}, {r['bbox'][1]:.0f})")
                        
                    description = "Image modified: " + ", ".join(desc) if desc else "Image formatting updated"
                    differences.append({
                        "type": "modification",
                        "category": "image",
                        "text": f"[Image {r['xref']}]",
                        "rect": {"x": r["bbox"][0], "y": r["bbox"][1], "w": r["bbox"][2] - r["bbox"][0], "h": r["bbox"][3] - r["bbox"][1]},
                        "description": description,
                        "source": "ImageComparer"
                    })
                    break

        # 3. Match Replaced Images (different hash, but overlapping bounding box)
        for i, o in enumerate(orig_imgs):
            if i in matched_orig:
                continue
            for j, r in enumerate(rev_imgs):
                if j in matched_rev:
                    continue
                if cls.get_iou(o["bbox"], r["bbox"]) > 0.4:
                    matched_orig.add(i)
                    matched_rev.add(j)
                    differences.append({
                        "type": "modification",
                        "category": "image",
                        "text": f"[Image {r['xref']}]",
                        "rect": {"x": r["bbox"][0], "y": r["bbox"][1], "w": r["bbox"][2] - r["bbox"][0], "h": r["bbox"][3] - r["bbox"][1]},
                        "description": f"Image replaced (content changed from xref {o['xref']} to xref {r['xref']})",
                        "source": "ImageComparer"
                    })
                    break

        # 4. Removed Images
        for i, o in enumerate(orig_imgs):
            if i not in matched_orig:
                differences.append({
                    "type": "deletion",
                    "category": "image",
                    "text": f"[Image {o['xref']}]",
                    "rect": {"x": o["bbox"][0], "y": o["bbox"][1], "w": o["bbox"][2] - o["bbox"][0], "h": o["bbox"][3] - o["bbox"][1]},
                    "description": f"Removed image (xref {o['xref']})",
                    "source": "ImageComparer"
                })

        # 5. Added Images
        for j, r in enumerate(rev_imgs):
            if j not in matched_rev:
                differences.append({
                    "type": "addition",
                    "category": "image",
                    "text": f"[Image {r['xref']}]",
                    "rect": {"x": r["bbox"][0], "y": r["bbox"][1], "w": r["bbox"][2] - r["bbox"][0], "h": r["bbox"][3] - r["bbox"][1]},
                    "description": f"Added image (xref {r['xref']})",
                    "source": "ImageComparer"
                })

        return differences
