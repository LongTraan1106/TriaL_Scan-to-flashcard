import asyncio
import logging
import re
import time
from typing import Any, Dict, List, Tuple

import httpx

LLM_API_URL = "http://192.168.20.150:8000/v1/chat/completions"
MODEL_NAME = "Qwen2.5/Qwen2.5-7B-Instruct"

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
    group_idx: int,
    box_idx: int,
    text_content: str,
    llm_endpoint: str = LLM_API_URL,
    model_name: str = MODEL_NAME,
) -> Tuple[int, int, int, str]:
    headers = {"Content-Type": "application/json"}

    prompt = f"""You are creating a study flashcard set from OCR text. Based on the following text content, create exactly 2 high-quality flashcards.

Language rules:
- First, identify the dominant language of the provided text.
- Write the QUESTION, ANSWER, and EXPLAIN content entirely in that same dominant language.
- Do not mix languages. If the source text is Vietnamese, write Vietnamese flashcards. If it is English, write English flashcards. If it is another language, use that language.
- Keep technical terms, model names, formulas, metrics, dataset names, proper nouns, and important domain-specific concepts exactly as they appear in the source text.

Flashcard quality rules:
- Each flashcard must test one meaningful concept that a learner should remember from this specific text.
- Questions must sound natural in the context of a flashcard set, not like generic exam prompts.
- Prefer questions that ask about relationships, purpose, meaning, comparison, cause/effect, interpretation of numbers, or core definitions from the text.
- Avoid vague questions such as "What is mentioned in the text?" or questions that can be answered without understanding the content.
- Answers must be concise, accurate, and directly supported by the text.
- The EXPLAIN section must be different from the answer. It should teach the concept in 2-4 student-friendly sentences using context from the text.
- Never leave the EXPLAIN section empty. Never repeat the answer as the explanation.
- Do not add outside knowledge, unsupported assumptions, or invented details.
- Do not output reasoning, analysis notes, markdown, bullets, numbering, or any extra text outside the required format.

You MUST use the following format exactly:

FLASHCARD_1
Q: <your question here>
A: <your answer here>
E: <2-4 sentence explanation, not the same as the answer>

FLASHCARD_2
Q: <your question here>
A: <your answer here>
E: <2-4 sentence explanation, not the same as the answer>

Text content (page {page_num}, group {group_idx}, box {box_idx}):
{text_content}

Generate the 2 flashcards now:"""

    payload = {
        "model": model_name,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.1,
        "max_tokens": 640,
        "chat_template_kwargs": {"enable_thinking": False},
    }

    started = time.perf_counter()
    logger.info(
        "[Flashcard LLM request] page=%s group=%s box=%s endpoint=%s model=%s input_chars=%s",
        page_num,
        group_idx,
        box_idx,
        llm_endpoint,
        model_name,
        len(text_content),
    )
    logger.info(
        "[Flashcard LLM input preview] page=%s group=%s box=%s text=%s",
        page_num,
        group_idx,
        box_idx,
        _preview_text(text_content),
    )

    try:
        response = await client.post(
            llm_endpoint,
            json=payload,
            headers=headers,
            timeout=120.0,
        )
        elapsed_ms = (time.perf_counter() - started) * 1000
        logger.info(
            "[Flashcard LLM response] page=%s group=%s box=%s status=%s elapsed_ms=%.2f",
            page_num,
            group_idx,
            box_idx,
            response.status_code,
            elapsed_ms,
        )

        if response.status_code == 200:
            raw_output = response.json()["choices"][0]["message"]["content"].strip()
            logger.info(
                "[Flashcard LLM success] page=%s group=%s box=%s raw_chars=%s raw_preview=%s",
                page_num,
                group_idx,
                box_idx,
                len(raw_output),
                _preview_text(raw_output),
            )
            logger.info(
                "[Flashcard LLM raw output - debug] page=%s group=%s box=%s\n%s",
                page_num,
                group_idx,
                box_idx,
                raw_output,
            )
            return page_num, group_idx, box_idx, raw_output

        err_msg = f"[API error: {response.status_code}]"
        logger.error(
            "[Flashcard LLM API error] page=%s group=%s box=%s body=%s",
            page_num,
            group_idx,
            box_idx,
            _preview_text(response.text, limit=1000),
        )
        return page_num, group_idx, box_idx, err_msg
    except Exception as exc:
        elapsed_ms = (time.perf_counter() - started) * 1000
        err_msg = f"[Connection error: {exc}]"
        logger.exception(
            "[Flashcard LLM connection error] page=%s group=%s box=%s elapsed_ms=%.2f",
            page_num,
            group_idx,
            box_idx,
            elapsed_ms,
        )
        return page_num, group_idx, box_idx, err_msg


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
    logger.info(
        "[Flashcard batch] ocr_blocks=%s endpoint=%s model=%s",
        len(ocr_results),
        llm_endpoint,
        model_name,
    )

    async with httpx.AsyncClient() as client:
        tasks = []
        for block in ocr_results:
            ocr_text = str(block.get("ocr_text", "")).strip()
            if not ocr_text:
                continue

            tasks.append(
                create_flashcards_for_box(
                    client,
                    int(block.get("page", 0)),
                    int(block.get("group_idx", 0)),
                    int(block.get("box_idx", 0)),
                    ocr_text,
                    llm_endpoint,
                    model_name,
                )
            )

        results = await asyncio.gather(*tasks) if tasks else []

    flashcard_map = {}
    raw_output_map = {}
    for page_num, group_idx, box_idx, raw_output in results:
        key = (page_num, group_idx, box_idx)
        parsed = parse_flashcards(raw_output)
        flashcard_map[key] = parsed
        raw_output_map[key] = raw_output
        logger.info(
            "[Flashcard parsed] page=%s group=%s box=%s cards=%s",
            page_num,
            group_idx,
            box_idx,
            len(parsed),
        )

    flashcard_data = []
    for block in ocr_results:
        enriched_block = dict(block)
        key = (
            int(enriched_block.get("page", 0)),
            int(enriched_block.get("group_idx", 0)),
            int(enriched_block.get("box_idx", 0)),
        )
        enriched_block["flashcards"] = flashcard_map.get(key, [])
        raw_output = raw_output_map.get(key)
        if raw_output and not enriched_block["flashcards"]:
            enriched_block["flashcard_raw_output"] = raw_output
        flashcard_data.append(enriched_block)

    total_cards = sum(len(block.get("flashcards", [])) for block in flashcard_data)
    empty_outputs = [
        {
            "page": key[0],
            "group_idx": key[1],
            "box_idx": key[2],
            "raw_output": raw_output,
        }
        for key, raw_output in raw_output_map.items()
        if not flashcard_map.get(key)
    ]

    return {
        "flashcard_data": flashcard_data,
        "total_cards": total_cards,
        "num_blocks": len(flashcard_data),
        "raw_outputs": [
            {
                "page": key[0],
                "group_idx": key[1],
                "box_idx": key[2],
                "raw_output": raw_output,
            }
            for key, raw_output in raw_output_map.items()
        ],
        "empty_outputs": empty_outputs,
    }
