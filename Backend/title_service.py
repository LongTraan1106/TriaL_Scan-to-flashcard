import logging
import re
import time
from typing import Any, Dict

import httpx

from config import (
    TITLE_LLM_API_URL as LLM_API_URL,
    TITLE_LLM_TIMEOUT_SECONDS,
    TITLE_MODEL_NAME as MODEL_NAME,
)

logger = logging.getLogger("study_helper.title")


def _summary_text(summary_data: Dict[str, Any], limit: int = 4000) -> str:
    full_summary = str(summary_data.get("full_summary") or "").strip()
    if full_summary:
        return full_summary[:limit]

    pages = summary_data.get("pages") or {}
    if isinstance(pages, dict):
        joined = "\n\n".join(str(value).strip() for value in pages.values() if str(value).strip())
        return joined[:limit]

    return ""


def _clean_title(raw_title: str) -> str:
    title = raw_title.strip().strip("\"'`")
    title = re.sub(r"^(title|document title)\s*:\s*", "", title, flags=re.IGNORECASE).strip()
    title = re.sub(r"\s+", " ", title)
    title = title[:80].strip(" -_:;,.")
    return title or "Scanned Document"


async def generate_document_title(
    summary_data: Dict[str, Any],
    llm_endpoint: str = LLM_API_URL,
    model_name: str = MODEL_NAME,
) -> str:
    summary_text = _summary_text(summary_data)
    if not summary_text:
        return "Scanned Document"

    prompt = f"""Create a short, clear title for the following study document.

Rules:
- Return only the title, no explanation.
- Use 3 to 8 words.
- Do not use quotation marks.
- Keep it specific to the document content.

Document summary:
{summary_text}

Title:"""

    payload = {
        "model": model_name,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.2,
        "max_tokens": 40,
        "chat_template_kwargs": {"enable_thinking": False},
    }

    started = time.perf_counter()
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                llm_endpoint,
                json=payload,
                headers={"Content-Type": "application/json"},
                timeout=TITLE_LLM_TIMEOUT_SECONDS,
            )

        elapsed_ms = (time.perf_counter() - started) * 1000
        logger.info(
            "[Title LLM response] status=%s elapsed_ms=%.2f chars=%s",
            response.status_code,
            elapsed_ms,
            len(response.text),
        )

        if response.status_code != 200:
            logger.error("[Title LLM API error] body=%s", response.text[:1000])
            return "Scanned Document"

        raw_title = response.json()["choices"][0]["message"]["content"]
        title = _clean_title(raw_title)
        logger.info("[Title generated] title=%s", title)
        return title
    except Exception as exc:
        logger.exception("[Title generation error] error=%s", exc)
        return "Scanned Document"
