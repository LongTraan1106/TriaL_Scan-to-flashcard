import asyncio
import logging
import re
import time
from typing import Any, Dict, List, Tuple

import httpx

from config import (
    FLASHCARD_LLM_TIMEOUT_SECONDS,
    FLASHCARD_MODEL_NAME as MODEL_NAME,
    LLM_API_URL,
)

logger = logging.getLogger("study_helper.flashcards")
if not logger.handlers:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    )


def _preview_text(value: str, limit: int = 400) -> str:
    value = value.replace("\n", "\\n")
    if len(value) <= limit:
        return value
    return value[:limit] + "...[truncated]"


async def create_flashcards_for_box(
    client: httpx.AsyncClient,
    page_num: int,
    text_content: str,
    source_block_count: int = 0,
    llm_endpoint: str = LLM_API_URL,
    model_name: str = MODEL_NAME,
) -> Tuple[int, str]:
    headers = {"Content-Type": "application/json"}

    prompt = f"""You are creating a study flashcard set from the full OCR text of one page.

Based on the entire page content, create a compact flashcard set that covers all important ideas on this page.

Language rules:
- First, identify the dominant language of the provided text.
- Write the QUESTION, ANSWER, and EXPLAIN content entirely in that same dominant language.
- Do not mix languages. If the source text is Vietnamese, write Vietnamese flashcards. If it is English, write English flashcards. If it is another language, use that language.
- Keep technical terms, model names, formulas, metrics, dataset names, proper nouns, and important domain-specific concepts exactly as they appear in the source text.

Flashcard quality rules:
- Use 2 to 20 flashcards, depending on how much information is on the page.
- Make sure the flashcards together cover the whole page, not only one small fragment.
- Each flashcard must test one meaningful concept that a learner should remember from this page.
- Questions must sound natural in the context of a flashcard set, not like generic exam prompts.
- Prefer questions that ask about relationships, purpose, meaning, comparison, cause/effect, interpretation of numbers, or core definitions from the page.
- Avoid vague questions such as "What is mentioned in the text?" or questions that can be answered without understanding the content.
- Answers must be concise, accurate, and directly supported by the text.
- The EXPLAIN section must be different from the answer. It should teach the concept in 2-4 student-friendly sentences using context from the text.
- Never leave the EXPLAIN section empty. Never repeat the answer as the explanation.
- Do not add outside knowledge, unsupported assumptions, or invented details.
- Do not output reasoning, analysis notes, markdown, bullets, numbering, or any extra text outside the required format.

You MUST use the following format exactly for every card:

FLASHCARD_1
Q: <your question here>
A: <your answer here>
E: <2-4 sentence explanation, not the same as the answer>

Continue sequentially with FLASHCARD_2, FLASHCARD_3, and so on as needed.

Text content (page {page_num}, aggregated from {source_block_count} OCR block(s)):
{text_content}

Generate the flashcards now:"""

    payload = {
        "model": model_name,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.1,
        "max_tokens": 640,
        "chat_template_kwargs": {"enable_thinking": False},
    }

    started = time.perf_counter()
    logger.info(
        "[Flashcard LLM request] page=%s source_blocks=%s endpoint=%s model=%s input_chars=%s",
        page_num,
        source_block_count,
        llm_endpoint,
        model_name,
        len(text_content),
    )
    logger.info(
        "[Flashcard LLM input preview] page=%s source_blocks=%s text=%s",
        page_num,
        source_block_count,
        _preview_text(text_content),
    )

    try:
        response = await client.post(
            llm_endpoint,
            json=payload,
            headers=headers,
            timeout=FLASHCARD_LLM_TIMEOUT_SECONDS,
        )
        elapsed_ms = (time.perf_counter() - started) * 1000
        logger.info(
            "[Flashcard LLM response] page=%s source_blocks=%s status=%s elapsed_ms=%.2f",
            page_num,
            source_block_count,
            response.status_code,
            elapsed_ms,
        )

        if response.status_code == 200:
            raw_output = response.json()["choices"][0]["message"]["content"].strip()
            logger.info(
                "[Flashcard LLM success] page=%s source_blocks=%s raw_chars=%s raw_preview=%s",
                page_num,
                source_block_count,
                len(raw_output),
                _preview_text(raw_output),
            )
            logger.info(
                "[Flashcard LLM raw output - debug] page=%s source_blocks=%s\n%s",
                page_num,
                source_block_count,
                raw_output,
            )
            return page_num, raw_output

        err_msg = f"[API error: {response.status_code}]"
        logger.error(
            "[Flashcard LLM API error] page=%s source_blocks=%s body=%s",
            page_num,
            source_block_count,
            _preview_text(response.text, limit=1000),
        )
        return page_num, err_msg
    except Exception as exc:
        elapsed_ms = (time.perf_counter() - started) * 1000
        err_msg = f"[Connection error: {exc}]"
        logger.exception(
            "[Flashcard LLM connection error] page=%s source_blocks=%s elapsed_ms=%.2f",
            page_num,
            source_block_count,
            elapsed_ms,
        )
        return page_num, err_msg


def group_ocr_results_by_page(ocr_results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    pages: Dict[int, Dict[str, Any]] = {}
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

        page_entry = pages.setdefault(
            page_num,
            {
                "representative_block": dict(block),
                "text_parts": [],
            },
        )
        page_entry["text_parts"].append(ocr_text)

    page_sources: List[Dict[str, Any]] = []
    for page_num in sorted(pages):
        page_entry = pages[page_num]
        representative_block = dict(page_entry["representative_block"])
        page_text = "\n\n".join(page_entry["text_parts"]).strip()
        representative_block["ocr_text"] = page_text
        representative_block["source_block_count"] = len(page_entry["text_parts"])
        page_sources.append(representative_block)

    return page_sources


def _extract_flashcard_field(block: str, labels: List[str], stop_labels: List[str]) -> str:
    label_pattern = "|".join(re.escape(label) for label in labels)
    stop_pattern = "|".join(re.escape(label) for label in stop_labels)
    pattern = (
        rf"^\s*(?:{label_pattern})\s*:\s*(.+?)"
        rf"(?=\n\s*(?:{stop_pattern})\s*:|\n\s*FLASHCARD_\d+|\Z)"
    )
    match = re.search(pattern, block, re.DOTALL | re.IGNORECASE | re.MULTILINE)
    return match.group(1).strip() if match else ""


def parse_flashcards(raw_output: str) -> List[Dict[str, str]]:
    flashcards = []
    blocks = [
        block
        for block in re.split(r"(?=^\s*FLASHCARD_\d+)", raw_output, flags=re.MULTILINE)
        if block.strip()
    ]

    for block in blocks:
        question = _extract_flashcard_field(
            block,
            ["Q", "QUESTION"],
            ["A", "ANSWER", "E", "EXPLAIN", "EXPLANATION"],
        )
        answer = _extract_flashcard_field(
            block,
            ["A", "ANSWER"],
            ["E", "EXPLAIN", "EXPLANATION"],
        )
        explain = _extract_flashcard_field(
            block,
            ["E", "EXPLAIN", "EXPLANATION"],
            ["Q", "QUESTION", "A", "ANSWER"],
        )
        if not question or not answer:
            continue
        flashcards.append(
            {
                "question": question,
                "answer": answer,
                "explain": explain,
            }
        )

    return flashcards


async def process_and_create_flashcards(
    ocr_results: List[Dict[str, Any]],
    llm_endpoint: str = LLM_API_URL,
    model_name: str = MODEL_NAME,
) -> Dict[str, Any]:
    page_sources = group_ocr_results_by_page(ocr_results)
    logger.info(
        "[Flashcard batch] source_blocks=%s pages=%s endpoint=%s model=%s",
        len(ocr_results),
        len(page_sources),
        llm_endpoint,
        model_name,
    )

    async with httpx.AsyncClient() as client:
        tasks = []
        for page_source in page_sources:
            ocr_text = str(page_source.get("ocr_text", "")).strip()
            if not ocr_text:
                continue

            tasks.append(
                create_flashcards_for_box(
                    client,
                    int(page_source.get("page", 0)),
                    ocr_text,
                    int(page_source.get("source_block_count", 0)),
                    llm_endpoint,
                    model_name,
                )
            )

        results = await asyncio.gather(*tasks) if tasks else []

    flashcard_map: Dict[int, List[Dict[str, str]]] = {}
    raw_output_map: Dict[int, str] = {}
    for page_num, raw_output in results:
        parsed = parse_flashcards(raw_output)
        flashcard_map[page_num] = parsed
        raw_output_map[page_num] = raw_output
        logger.info(
            "[Flashcard parsed] page=%s cards=%s",
            page_num,
            len(parsed),
        )

    flashcard_data = []
    page_source_map = {
        int(page_source.get("page", 0)): page_source for page_source in page_sources
    }
    for page_source in page_sources:
        enriched_block = dict(page_source)
        page_num = int(enriched_block.get("page", 0))
        enriched_block["flashcards"] = flashcard_map.get(page_num, [])
        raw_output = raw_output_map.get(page_num)
        if raw_output and not enriched_block["flashcards"]:
            enriched_block["flashcard_raw_output"] = raw_output
        flashcard_data.append(enriched_block)

    total_cards = sum(len(block.get("flashcards", [])) for block in flashcard_data)
    empty_outputs = [
        {
            "page": page_num,
            "group_idx": int(page_source_map[page_num].get("group_idx", 0)),
            "box_idx": int(page_source_map[page_num].get("box_idx", 0)),
            "raw_output": raw_output,
        }
        for page_num, raw_output in raw_output_map.items()
        if not flashcard_map.get(page_num)
    ]

    return {
        "flashcard_data": flashcard_data,
        "total_cards": total_cards,
        "num_blocks": len(flashcard_data),
        "raw_outputs": [
            {
                "page": page_num,
                "group_idx": int(page_source_map[page_num].get("group_idx", 0)),
                "box_idx": int(page_source_map[page_num].get("box_idx", 0)),
                "raw_output": raw_output,
            }
            for page_num, raw_output in raw_output_map.items()
        ],
        "empty_outputs": empty_outputs,
    }
