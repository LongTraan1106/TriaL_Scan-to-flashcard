import json
import os
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any, Dict, List, Optional

import cv2
import fitz  # PyMuPDF
import numpy as np
import requests
from paddleocr import LayoutDetection

import base64

from config import (
    LAYOUT_MODEL_NAME,
    LAYOUT_VISUALIZATION_DIR,
    OCR_API_URL,
    OCR_CENTER_TOLERANCE,
    OCR_INCLUDE_IMAGE_BASE64,
    OCR_MAX_WORKERS,
    OCR_MODEL_NAME,
    OCR_TIMEOUT_SECONDS,
)

LABEL_COLORS = {
    "text": (255, 0, 0),
    "paragraph_title": (0, 0, 255),
    "table": (0, 255, 0),
    "table_title": (0, 200, 200),
    "figure": (255, 0, 255),
    "figure_title": (255, 100, 200),
    "formula": (0, 165, 255),
    "list": (255, 255, 0),
    "abstract": (0, 255, 255),
    "reference": (128, 0, 128),
    "header": (200, 200, 200),
    "footer": (150, 150, 150),
}

READABLE_LAYOUT_LABELS = {
    "text",
    "paragraph_title",
    "table",
    "table_title",
    "figure_title",
    "formula",
    "list",
    "abstract",
}

layout_model = None


def initialize_layout_model() -> bool:
    """Load Paddle layout model once when the backend starts."""
    global layout_model
    try:
        print("Loading Paddle OCR Layout Detection model...")
        layout_model = LayoutDetection(model_name=LAYOUT_MODEL_NAME)
        print("Paddle OCR model loaded successfully.")
        return True
    except Exception as exc:
        print(f"Failed to load Paddle OCR model: {exc}")
        return False


def get_layout_model():
    global layout_model
    if layout_model is None:
        initialize_layout_model()
    if layout_model is None:
        raise RuntimeError("Layout model could not be initialized.")
    return layout_model


# def call_mistral_ocr(file_bytes: bytes, filename: str, ocr_url: str = OCR_API_URL) -> str:
#     data = {
#         "model": OCR_MODEL_NAME,
#         "include_image_base64": OCR_INCLUDE_IMAGE_BASE64,
#     }
#     mime_type = "application/pdf" if filename.lower().endswith(".pdf") else "image/png"
#     files = {"file": (filename, file_bytes, mime_type)}

#     try:
#         response = requests.post(ocr_url, files=files, data=data, timeout=OCR_TIMEOUT_SECONDS)
#         if response.status_code == 200:
#             result_json = response.json()
#             extracted_page = result_json.get("pages", [{}])[0]
#             return extracted_page.get("markdown", "")

#         print(f"[OCR API error] {filename}: {response.status_code} - {response.text}")
#         return ""
#     except Exception as exc:
#         print(f"[OCR connection error] {filename}: {exc}")
#         return ""

def call_qwen_ocr(file_bytes: bytes, filename: str, ocr_url: str = OCR_API_URL) -> str:
    image_base64 = base64.b64encode(file_bytes).decode("utf-8")

    payload = {
        "model": OCR_MODEL_NAME,
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are an OCR engine. Extract all readable text from the image. "
                    "Return only the extracted text in Markdown format. Do not explain."
                ),
            },
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": (
                            "Extract all readable text from this image. "
                            "Preserve tables, formulas, headings, and line breaks when possible."
                        ),
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/png;base64,{image_base64}"
                        },
                    },
                ],
            },
        ],
        "temperature": 0,
        "max_tokens": 2048,
        "stream": False,
    }

    try:
        response = requests.post(
            ocr_url,
            json=payload,
            timeout=OCR_TIMEOUT_SECONDS,
        )

        if response.status_code == 200:
            result_json = response.json()
            return (
                result_json
                .get("choices", [{}])[0]
                .get("message", {})
                .get("content", "")
                .strip()
            )

        print(f"[OCR API error] {filename}: {response.status_code} - {response.text}")
        return ""

    except Exception as exc:
        print(f"[OCR connection error] {filename}: {exc}")
        return ""


def visualize_layout(
    img_cv2,
    boxes: List[Dict[str, Any]],
    page_idx: int,
    save_dir: str = LAYOUT_VISUALIZATION_DIR,
) -> str:
    os.makedirs(save_dir, exist_ok=True)
    img_viz = img_cv2.copy()

    for box in boxes:
        label = box["label"]
        score = box.get("score", 0)
        x_min, y_min, x_max, y_max = map(int, box["coordinate"])
        color = LABEL_COLORS.get(label, (128, 128, 128))

        cv2.rectangle(img_viz, (x_min, y_min), (x_max, y_max), color, 2)
        label_text = f"{label} ({score:.2f})" if score else label
        text_size, baseline = cv2.getTextSize(
            label_text,
            cv2.FONT_HERSHEY_SIMPLEX,
            0.5,
            1,
        )
        text_w, text_h = text_size
        cv2.rectangle(
            img_viz,
            (x_min, y_min - text_h - baseline - 4),
            (x_min + text_w, y_min),
            color,
            -1,
        )
        cv2.putText(
            img_viz,
            label_text,
            (x_min, y_min - baseline - 2),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.5,
            (255, 255, 255),
            1,
            cv2.LINE_AA,
        )

    output_path = os.path.join(save_dir, f"layout_page_{page_idx + 1}.png")
    cv2.imwrite(output_path, img_viz)
    return output_path


def group_layout_boxes(boxes: List[Dict[str, Any]], center_tolerance: int = OCR_CENTER_TOLERANCE):
    """Group readable layout boxes into left-to-right columns, then top-to-bottom boxes."""
    text_boxes = [
        box
        for box in boxes
        if box.get("label") in READABLE_LAYOUT_LABELS
    ]

    if not text_boxes:
        return []

    page_x_min = min(box["coordinate"][0] for box in text_boxes)
    page_x_max = max(box["coordinate"][2] for box in text_boxes)
    page_width = max(1, page_x_max - page_x_min)
    wide_threshold = page_width * 0.65

    def build_column_groups(column_boxes: List[Dict[str, Any]]):
        groups = []

        column_boxes = sorted(
            column_boxes,
            key=lambda box: box["coordinate"][2] - box["coordinate"][0],
            reverse=True,
        )
        for box in column_boxes:
            x_min, y_min, x_max, y_max = box["coordinate"]
            center_x = (x_min + x_max) / 2
            placed = False

            for group in groups:
                same_center = abs(center_x - group["center_x"]) < center_tolerance
                inside_width = (
                    x_min >= group["x_min"] - 20 and x_max <= group["x_max"] + 20
                )
                if same_center or inside_width:
                    group["boxes"].append(box)
                    group["center_x"] = sum(
                        (item["coordinate"][0] + item["coordinate"][2]) / 2
                        for item in group["boxes"]
                    ) / len(group["boxes"])
                    group["x_min"] = min(group["x_min"], x_min)
                    group["x_max"] = max(group["x_max"], x_max)
                    group["y_min"] = min(group["y_min"], y_min)
                    group["y_max"] = max(group["y_max"], y_max)
                    placed = True
                    break

            if not placed:
                groups.append(
                    {
                        "center_x": center_x,
                        "x_min": x_min,
                        "y_min": y_min,
                        "x_max": x_max,
                        "y_max": y_max,
                        "boxes": [box],
                    }
                )

        for group in groups:
            group["boxes"] = sorted(group["boxes"], key=lambda box: box["coordinate"][1])

        return sorted(groups, key=lambda group: group["x_min"])

    wide_boxes = [
        box
        for box in text_boxes
        if box["coordinate"][2] - box["coordinate"][0] >= wide_threshold
    ]
    normal_boxes = [
        box
        for box in text_boxes
        if box["coordinate"][2] - box["coordinate"][0] < wide_threshold
    ]

    if not wide_boxes:
        return build_column_groups(text_boxes)

    ordered_groups = []
    remaining_normal = list(normal_boxes)

    for wide_box in sorted(wide_boxes, key=lambda box: box["coordinate"][1]):
        wide_y_min = wide_box["coordinate"][1]
        before_wide = [
            box for box in remaining_normal if box["coordinate"][1] < wide_y_min
        ]
        if before_wide:
            ordered_groups.extend(build_column_groups(before_wide))
            before_ids = {id(box) for box in before_wide}
            remaining_normal = [
                box for box in remaining_normal if id(box) not in before_ids
            ]

        x_min, y_min, x_max, y_max = wide_box["coordinate"]
        ordered_groups.append(
            {
                "center_x": (x_min + x_max) / 2,
                "x_min": x_min,
                "y_min": y_min,
                "x_max": x_max,
                "y_max": y_max,
                "boxes": [wide_box],
            }
        )

    if remaining_normal:
        ordered_groups.extend(build_column_groups(remaining_normal))

    return ordered_groups


def prepare_ocr_file_for_box(
    box: Dict[str, Any],
    page_idx: int,
    box_idx: int,
    is_pdf: bool,
    doc=None,
    page_rect=None,
    img_cv2=None,
    pad: int = 5,
) -> tuple[bytes, str]:
    coord = box["coordinate"]

    if is_pdf:
        x1, y1 = coord[0] - pad, coord[1] - pad
        x2, y2 = coord[2] + pad, coord[3] + pad
        crop_rect = fitz.Rect(x1, y1, x2, y2) & page_rect

        if crop_rect.is_empty or not crop_rect.is_valid:
            return b"", ""

        page = doc[page_idx]

        # Render vùng crop thành ảnh PNG.
        # Matrix(2, 2) giúp ảnh rõ hơn cho OCR.
        pix = page.get_pixmap(
            matrix=fitz.Matrix(2, 2),
            clip=crop_rect,
            alpha=False,
        )

        file_bytes = pix.tobytes("png")
        filename = f"page_{page_idx + 1}_box_{box_idx}.png"
    else:
        x1 = max(0, int(coord[0]) - pad)
        y1 = max(0, int(coord[1]) - pad)
        x2 = min(img_cv2.shape[1], int(coord[2]) + pad)
        y2 = min(img_cv2.shape[0], int(coord[3]) + pad)
        cropped_img = img_cv2[y1:y2, x1:x2]
        _, buffer = cv2.imencode(".png", cropped_img)
        file_bytes = buffer.tobytes()
        filename = f"page_{page_idx + 1}_box_{box_idx}.png"

    return file_bytes, filename


def crop_and_ocr_box(
    box: Dict[str, Any],
    page_idx: int,
    box_idx: int,
    is_pdf: bool,
    ocr_url: str,
    doc=None,
    page_rect=None,
    img_cv2=None,
    pad: int = 5,
) -> str:
    file_bytes, filename = prepare_ocr_file_for_box(
        box,
        page_idx,
        box_idx,
        is_pdf,
        doc=doc,
        page_rect=page_rect,
        img_cv2=img_cv2,
        pad=pad,
    )
    if not file_bytes or not filename:
        return ""

    print(f"    -> OCR {filename} ({box['label']})...")
    return call_qwen_ocr(file_bytes, filename, ocr_url)


def process_and_ocr_document(
    file_path: str,
    center_tolerance: int = OCR_CENTER_TOLERANCE,
    ocr_url: str = OCR_API_URL,
    ocr_max_workers: int = OCR_MAX_WORKERS,
    visualize: bool = False,
    visualization_dir: Optional[str] = None,
    output_json_path: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Process a PDF/image with the new structured OCR flow.

    Returns one item per detected text box:
    page, group_idx, box_idx, label, coordinate, ocr_text.
    """
    print(f"Analyzing layout for: {file_path}")
    model = get_layout_model()
    is_pdf = file_path.lower().endswith(".pdf")
    all_results = []

    if is_pdf:
        doc = fitz.open(file_path)
        num_pages = len(doc)
        img_orig = None
    else:
        doc = None
        num_pages = 1
        img_orig = cv2.imread(file_path)
        if img_orig is None:
            print(f"Cannot read image: {file_path}")
            return []

    box_counter = 0

    try:
        for page_idx in range(num_pages):
            print(f"\n--- Processing page {page_idx + 1}/{num_pages} ---")

            if is_pdf:
                page = doc[page_idx]
                page_rect = page.rect
                pix = page.get_pixmap()
                img_array = np.frombuffer(pix.samples, dtype=np.uint8).reshape(
                    pix.height,
                    pix.width,
                    pix.n,
                )
                img_cv2 = cv2.cvtColor(
                    img_array,
                    cv2.COLOR_RGBA2BGR if pix.n == 4 else cv2.COLOR_RGB2BGR,
                )
            else:
                page_rect = None
                img_cv2 = img_orig

            output = model.predict(img_cv2)
            res = output[0] if isinstance(output, list) else output

            boxes = []
            if isinstance(res, dict):
                if "res" in res and "boxes" in res["res"]:
                    boxes = res["res"]["boxes"]
                elif "boxes" in res:
                    boxes = res["boxes"]

            if not boxes:
                print(f"Page {page_idx + 1} is empty.")
                continue

            if visualize:
                visualize_layout(
                    img_cv2,
                    boxes,
                    page_idx,
                    save_dir=visualization_dir or LAYOUT_VISUALIZATION_DIR,
                )

            groups = group_layout_boxes(boxes, center_tolerance)

            page_jobs = []
            for col_idx, group in enumerate(groups):
                for box_in_group_idx, box in enumerate(group["boxes"]):
                    box_counter += 1
                    file_bytes, filename = prepare_ocr_file_for_box(
                        box,
                        page_idx,
                        box_counter,
                        is_pdf,
                        doc=doc,
                        page_rect=page_rect,
                        img_cv2=img_cv2,
                    )
                    page_jobs.append(
                        (
                            len(all_results) + len(page_jobs),
                            col_idx,
                            box_in_group_idx,
                            box,
                            file_bytes,
                            filename,
                        )
                    )

            def run_ocr(job):
                layout_order, col_idx, box_in_group_idx, box, file_bytes, filename = job
                if not file_bytes or not filename:
                    ocr_text = ""
                else:
                    print(f"    -> OCR {filename} ({box['label']})...")
                    ocr_text = call_qwen_ocr(file_bytes, filename, ocr_url)

                return {
                    "page": page_idx + 1,
                    "group_idx": col_idx,
                    "box_idx": box_in_group_idx,
                    "layout_order": layout_order,
                    "label": box["label"],
                    "coordinate": [float(value) for value in box["coordinate"]],
                    "ocr_text": ocr_text.strip(),
                }

            if page_jobs:
                max_workers = max(1, min(int(ocr_max_workers), len(page_jobs)))
                print(f"    -> Calling OCR API in parallel ({max_workers} workers)...")
                page_results = []
                with ThreadPoolExecutor(max_workers=max_workers) as executor:
                    future_map = {
                        executor.submit(run_ocr, job): job for job in page_jobs
                    }
                    for future in as_completed(future_map):
                        page_results.append(future.result())

                all_results.extend(
                    sorted(page_results, key=lambda item: item["layout_order"])
                )
    finally:
        if doc is not None:
            doc.close()

    if output_json_path:
        with open(output_json_path, "w", encoding="utf-8") as file:
            json.dump(all_results, file, ensure_ascii=False, indent=2)

    print("\n========= DONE =========")
    print(f"Total OCR text boxes: {len(all_results)}")
    return all_results


def structured_results_to_text(ocr_results: List[Dict[str, Any]]) -> str:
    parts = []
    sorted_results = sorted(
        ocr_results,
        key=lambda item: (
            int(item.get("page", 0)),
            int(item.get("layout_order", 10**9)),
            int(item.get("group_idx", 0)),
            int(item.get("box_idx", 0)),
        ),
    )

    for item in sorted_results:
        text = item.get("ocr_text", "").strip()
        if not text:
            continue
        page = item.get("page", 0)
        group = item.get("group_idx", 0)
        box = item.get("box_idx", 0)
        label = item.get("label", "text")
        parts.append(
            f"--- PAGE {page} | GROUP {group} | BOX {box} | LABEL {label} ---\n{text}\n"
        )

    return "\n".join(parts)
