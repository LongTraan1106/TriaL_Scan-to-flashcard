import logging
import re
import time
from typing import Any, Dict, List, Optional

import httpx

from config import (
    LLM_API_URL,
    TAKEAWAY_LLM_TIMEOUT_SECONDS,
    TAKEAWAY_MODEL_NAME as MODEL_NAME,
)

logger = logging.getLogger("study_helper.takeaways")


def _document_text(
    summary_data: Optional[Dict[str, Any]] = None,
    ocr_results: Optional[List[Dict[str, Any]]] = None,
    text_content: Optional[str] = None,
    limit: int = 8000,
) -> str:
    if summary_data:
        full_summary = str(summary_data.get("full_summary") or "").strip()
        if full_summary:
            return full_summary[:limit]

        pages = summary_data.get("pages") or {}
        if isinstance(pages, dict):
            joined = "\n\n".join(
                str(value).strip() for value in pages.values() if str(value).strip()
            )
            if joined:
                return joined[:limit]

    if ocr_results:
        joined = "\n\n".join(
            str(block.get("ocr_text", "")).strip()
            for block in ocr_results
            if str(block.get("ocr_text", "")).strip()
        )
        if joined:
            return joined[:limit]

    return (text_content or "").strip()[:limit]


def _parse_takeaways(raw_output: str) -> List[str]:
    lines = []
    for line in raw_output.splitlines():
        cleaned = re.sub(r"^\s*(?:[-*•]|\d+[\).:-])\s*", "", line).strip()
        cleaned = cleaned.strip("\"'`")
        if cleaned:
            lines.append(cleaned)

    if len(lines) == 1 and ";" in lines[0]:
        lines = [item.strip() for item in lines[0].split(";") if item.strip()]

    unique_lines = []
    seen = set()
    for line in lines:
        key = line.casefold()
        if key in seen:
            continue
        seen.add(key)
        unique_lines.append(line[:220].strip())
        if len(unique_lines) >= 5:
            break

    return unique_lines


async def generate_key_takeaways(
    summary_data: Optional[Dict[str, Any]] = None,
    ocr_results: Optional[List[Dict[str, Any]]] = None,
    text_content: Optional[str] = None,
    llm_endpoint: str = LLM_API_URL,
    model_name: str = MODEL_NAME,
) -> List[str]:
    document_text = _document_text(summary_data, ocr_results, text_content)
    if not document_text:
        return []

    prompt = f"""Create 3 to 5 key takeaways from this study document.

Rules:
- Return only the takeaways, one per line.
- Do not add headings, numbering, markdown, or explanations.
- Keep each takeaway concise but specific.
- Stay faithful to the document content.

Document content:
{document_text}

Key takeaways:"""

    payload = {
        "model": model_name,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.2,
        "max_tokens": 320,
        "chat_template_kwargs": {"enable_thinking": False},
    }

    started = time.perf_counter()
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                llm_endpoint,
                json=payload,
                headers={"Content-Type": "application/json"},
                timeout=TAKEAWAY_LLM_TIMEOUT_SECONDS,
            )

        elapsed_ms = (time.perf_counter() - started) * 1000
        logger.info(
            "[Takeaways LLM response] status=%s elapsed_ms=%.2f chars=%s",
            response.status_code,
            elapsed_ms,
            len(response.text),
        )

        if response.status_code != 200:
            logger.error("[Takeaways LLM API error] body=%s", response.text[:1000])
            return []

        raw_output = response.json()["choices"][0]["message"]["content"].strip()
        takeaways = _parse_takeaways(raw_output)
        logger.info("[Takeaways generated] count=%s", len(takeaways))
        return takeaways
    except Exception as exc:
        logger.exception("[Takeaways generation error] error=%s", exc)
        return []
