#!/usr/bin/env python3
"""Extract the first family book into reviewable, sentence-level JSON."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

from pypdf import PdfReader


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public" / "books" / "white-paper" / "book.json"

CHAPTERS = [
    ("intro", "引子", 18),
    ("case-01", "第一案 · 胶带缠尸", 34),
    ("case-02", "第二案 · 消失的奶茶", 77),
    ("case-03", "第三案 · 五步必死", 120),
    ("case-04", "第四案 · 网暴遗言", 158),
    ("case-05", "第五案 · 虚拟解剖", 200),
    ("case-06", "第六案 · 死后叹气", 238),
    ("case-07", "第七案 · 囚鸟", 277),
    ("case-08", "第八案 · 钉子", 314),
    ("case-09", "第九案 · 四腿水怪", 349),
    ("case-10", "第十案 · 断肠密室", 384),
    ("outro", "尾声 · 白卷", 420),
]

SENTENCE_END = re.compile(r"[。！？!?](?:[”’」』】〕）])?")


def clean_page(text: str) -> str:
    text = text.replace("\u3000", " ").replace("\xa0", " ")
    lines = [re.sub(r"[ \t]+", "", line) for line in text.splitlines()]
    joined: list[str] = []
    for line in lines:
        if not line:
            continue
        if re.fullmatch(r"\d{1,2}", line):
            joined.append(f"\n{line}\n")
        else:
            joined.append(line)
    return "".join(joined).strip()


def sentences_from_text(text: str) -> list[str]:
    pieces: list[str] = []
    for paragraph in re.split(r"\n+", text):
        paragraph = paragraph.strip()
        if not paragraph:
            continue
        start = 0
        for match in SENTENCE_END.finditer(paragraph):
            sentence = paragraph[start : match.end()].strip()
            if sentence:
                pieces.append(sentence)
            start = match.end()
        remainder = paragraph[start:].strip()
        if remainder:
            pieces.append(remainder)
    return pieces


def main() -> None:
    parser = argparse.ArgumentParser(description="Extract a legally owned text-layer PDF for A2.")
    parser.add_argument("--source", required=True, type=Path, help="Path to the source PDF")
    args = parser.parse_args()
    source = args.source.expanduser().resolve()
    if not source.is_file():
        parser.error(f"PDF not found: {source}")

    reader = PdfReader(str(source))
    chapters = []

    for index, (chapter_id, title, start_page) in enumerate(CHAPTERS):
        end_page = CHAPTERS[index + 1][2] - 1 if index + 1 < len(CHAPTERS) else 431
        pages = [clean_page(reader.pages[page - 1].extract_text() or "") for page in range(start_page, end_page + 1)]
        text = "\n".join(page for page in pages if page)

        # The PDF bookmark title is repeated at the start of each chapter.
        normalized_title = title.replace(" · ", "")
        if text.startswith(normalized_title):
            text = text[len(normalized_title) :].strip()

        sentences = sentences_from_text(text)
        character_count = len(re.sub(r"\s", "", text))
        estimated_seconds = round(character_count / 2.75)
        chapters.append(
            {
                "id": chapter_id,
                "title": title,
                "pageStart": start_page,
                "pageEnd": end_page,
                "characterCount": character_count,
                "estimatedSeconds": estimated_seconds,
                "sentences": [
                    {"id": f"{chapter_id}-s{sentence_index + 1:04d}", "text": sentence}
                    for sentence_index, sentence in enumerate(sentences)
                ],
            }
        )

    payload = {
        "id": "white-paper",
        "title": "法医秦明：白卷",
        "author": "法医秦明",
        "pageCount": 438,
        "sourceFile": source.name,
        "chapters": chapters,
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(
        json.dumps(
            {
                "output": str(OUTPUT),
                "chapters": len(chapters),
                "sentences": sum(len(chapter["sentences"]) for chapter in chapters),
                "characters": sum(chapter["characterCount"] for chapter in chapters),
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
