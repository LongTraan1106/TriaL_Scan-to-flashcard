import asyncio
import logging
import re
import time
from typing import Any, Dict, List, Optional, Tuple

import httpx

from config import (
    LLM_API_URL,
    SUMMARY_LLM_TIMEOUT_SECONDS,
    SUMMARY_MODEL_NAME as MODEL_NAME,
)

logger = logging.getLogger("study_helper.llm")
if not logger.handlers:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    )


def _preview_text(value: str, limit: int = 500) -> str:
    value = value.replace("\n", "\\n")
    if len(value) <= limit:
        return value
    return value[:limit] + "...[truncated]"


async def summarize_single_page(
    client: httpx.AsyncClient,
    page_num: int,
    text_content: str,
    llm_endpoint: str = LLM_API_URL,
    model_name: str = MODEL_NAME,
) -> Tuple[int, str]:
    headers = {"Content-Type": "application/json"}

    prompt = f"""Bạn là một chuyên gia phân tích và tóm tắt tài liệu.

Hãy đọc kỹ nội dung của Trang {page_num} (được trích xuất từ OCR). Nhiệm vụ của bạn là tạo một bản tóm tắt có cấu trúc theo từng phần nội dung xuất hiện trong văn bản.

Yêu cầu:
- KHÔNG liệt kê từ khóa riêng lẻ.
- KHÔNG dùng markdown, bullet points, numbering, ký hiệu đặc biệt hoặc format trang trí.
- Chỉ trả về phần nội dung tóm tắt thuần văn bản.
- Tóm tắt phải bám sát nội dung gốc, theo đúng thứ tự xuất hiện trong tài liệu.
- Khi gặp thuật ngữ chuyên ngành, tên mô hình, công thức, số liệu, thuật toán, dataset, tên riêng hoặc khái niệm quan trọng, phải giữ nguyên chúng trong phần tóm tắt.
- Chia nội dung thành các đoạn ngắn tương ứng với từng ý/chủ đề của văn bản.
- Ưu tiên diễn giải logic giữa các ý thay vì liệt kê rời rạc.
- Không thêm kiến thức ngoài văn bản.
- Không suy diễn hoặc tự mở rộng nội dung không tồn tại trong OCR.
- Nếu văn bản OCR bị lỗi hoặc thiếu ngữ cảnh, hãy cố gắng suy luận tối thiểu dựa trên phần nhìn thấy được, nhưng không được bịa nội dung.

Nội dung Trang {page_num}:
{text_content}

Bản tóm tắt:"""

    prompt = f"""You are an expert document analyst and summarizer.

Read the OCR text from page {page_num} carefully and produce a coherent, structured summary of the content on this page.

Output language rules:
- First, identify the dominant language of the provided OCR text.
- Write the entire summary in that same dominant language.
- Do not mix languages. If the document is Vietnamese, answer in Vietnamese. If it is English, answer in English. If it is another language, answer in that language.
- Keep technical terms, model names, formulas, metrics, algorithms, dataset names, proper nouns, and important domain-specific concepts exactly as they appear in the source text.

Summary quality rules:
- Rewrite the content into clear, natural, connected prose.
- Preserve the original order of ideas and explain how the ideas relate to each other.
- Use short paragraphs for separate topics or sections.
- Avoid repetitive wording and avoid copying long fragments verbatim unless the wording is a term, metric, formula, or proper noun that must be preserved.
- Do not output isolated keywords, keyword lists, bullet points, numbering, markdown, tables, headings, decorative separators, or special formatting.
- Return only the plain-text summary.
- Stay faithful to the OCR text. Do not add outside knowledge, unsupported assumptions, or invented details.
- If the OCR text is noisy, incomplete, or lacks context, infer only the minimum needed from the visible text and clearly avoid fabricating missing information.

OCR text for page {page_num}:
{text_content}

Plain-text summary:"""

    payload = {
        "model": model_name,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.2,
        "max_tokens": 1024,
        "chat_template_kwargs": {"enable_thinking": False},
    }

    request_started = time.perf_counter()
    logger.info(
        "[LLM request] page=%s endpoint=%s model=%s input_chars=%s prompt_chars=%s "
        "temperature=%s max_tokens=%s",
        page_num,
        llm_endpoint,
        model_name,
        len(text_content),
        len(prompt),
        payload["temperature"],
        payload["max_tokens"],
    )
    logger.info(
        "[LLM request preview] page=%s text_preview=%s",
        page_num,
        _preview_text(text_content),
    )

    try:
        response = await client.post(
            llm_endpoint,
            json=payload,
            headers=headers,
            timeout=SUMMARY_LLM_TIMEOUT_SECONDS,
        )
        elapsed_ms = (time.perf_counter() - request_started) * 1000
        logger.info(
            "[LLM response] page=%s status=%s elapsed_ms=%.2f response_chars=%s",
            page_num,
            response.status_code,
            elapsed_ms,
            len(response.text),
        )

        if response.status_code == 200:
            result_json = response.json()
            summary = result_json["choices"][0]["message"]["content"].strip()
            usage = result_json.get("usage")
            logger.info(
                "[LLM success] page=%s summary_chars=%s usage=%s summary_preview=%s",
                page_num,
                len(summary),
                usage,
                _preview_text(summary),
            )
            return page_num, summary

        err_msg = f"[API error: {response.status_code}]"
        logger.error(
            "[LLM API error] page=%s status=%s body_preview=%s",
            page_num,
            response.status_code,
            _preview_text(response.text, limit=1000),
        )
        return page_num, err_msg
    except Exception as exc:
        err_msg = f"[Connection error: {exc}]"
        elapsed_ms = (time.perf_counter() - request_started) * 1000
        logger.exception(
            "[LLM connection error] page=%s elapsed_ms=%.2f error=%s",
            page_num,
            elapsed_ms,
            exc,
        )
        return page_num, err_msg


def group_ocr_results_by_page(ocr_results: List[Dict[str, Any]]) -> Dict[int, str]:
    pages_data: Dict[int, str] = {}
    sorted_results = sorted(
        ocr_results,
        key=lambda item: (
            int(item.get("page", 0)),
            int(item.get("layout_order", 10**9)),
            int(item.get("group_idx", 0)),
            int(item.get("box_idx", 0)),
        ),
    )

    for block in sorted_results:
        page_num = int(block.get("page", 0))
        ocr_text = str(block.get("ocr_text", "")).strip()
        if not page_num or not ocr_text:
            continue
        pages_data.setdefault(page_num, "")
        pages_data[page_num] += ocr_text + "\n\n"

    return pages_data


def parse_legacy_text_by_page(text_content: str) -> Dict[int, str]:
    pages_data: Dict[int, str] = {}

    legacy_blocks = re.split(r"--- TRANG (\d+) \| CỘT \d+ ---", text_content)
    if len(legacy_blocks) > 1:
        for index in range(1, len(legacy_blocks), 2):
            page_num = int(legacy_blocks[index])
            content = legacy_blocks[index + 1].strip()
            pages_data.setdefault(page_num, "")
            pages_data[page_num] += content + "\n\n"
        return pages_data

    new_blocks = re.split(
        r"--- PAGE (\d+) \| GROUP \d+ \| BOX \d+(?: \| LABEL [^-]+)? ---",
        text_content,
    )
    if len(new_blocks) > 1:
        for index in range(1, len(new_blocks), 2):
            page_num = int(new_blocks[index])
            content = new_blocks[index + 1].strip()
            pages_data.setdefault(page_num, "")
            pages_data[page_num] += content + "\n\n"
        return pages_data

    stripped = text_content.strip()
    if stripped:
        pages_data[1] = stripped
    return pages_data


async def summarize_pages(
    pages_data: Dict[int, str],
    llm_endpoint: str = LLM_API_URL,
    model_name: str = MODEL_NAME,
) -> Dict[str, Any]:
    total_chars = sum(len(content) for content in pages_data.values())
    logger.info(
        "[LLM batch] pages=%s total_input_chars=%s endpoint=%s model=%s",
        len(pages_data),
        total_chars,
        llm_endpoint,
        model_name,
    )

    async with httpx.AsyncClient() as client:
        tasks = [
            summarize_single_page(client, page_num, content, llm_endpoint, model_name)
            for page_num, content in pages_data.items()
            if content.strip()
        ]
        results = await asyncio.gather(*tasks) if tasks else []

    results.sort(key=lambda item: item[0])

    summary_dict = {}
    full_summary_parts = []
    for page_num, summary in results:
        summary_dict[f"page_{page_num}"] = summary
        full_summary_parts.append(summary)

    return {
        "pages": summary_dict,
        "full_summary": "\n\n".join(full_summary_parts),
    }


async def process_and_summarize(
    text_content: Optional[str] = None,
    ocr_results: Optional[List[Dict[str, Any]]] = None,
    llm_endpoint: str = LLM_API_URL,
    model_name: str = MODEL_NAME,
) -> Dict[str, Any]:
    if ocr_results is not None:
        pages_data = group_ocr_results_by_page(ocr_results)
    elif text_content:
        pages_data = parse_legacy_text_by_page(text_content)
    else:
        pages_data = {}

    summary_result = await summarize_pages(pages_data, llm_endpoint, model_name)

    structured_summary = None
    if ocr_results is not None:
        structured_summary = []
        for block in ocr_results:
            page_num = int(block.get("page", 0))
            enriched_block = dict(block)
            enriched_block["summary"] = summary_result["pages"].get(f"page_{page_num}", "")
            structured_summary.append(enriched_block)

    return {
        **summary_result,
        "structured_summary": structured_summary,
    }
