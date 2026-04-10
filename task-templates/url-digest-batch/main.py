#!/usr/bin/env python3
import json
import os
import re
import sys
from pathlib import Path

import requests
from bs4 import BeautifulSoup

try:
    import trafilatura
except ImportError:
    trafilatura = None


def env_int(name: str, default: int) -> int:
    value = os.environ.get(name, "").strip()
    if not value:
        return default
    try:
        return int(value)
    except ValueError as exc:
        raise SystemExit(f"{name} must be an integer, got {value!r}") from exc


def send_report(message: str) -> None:
    print(message)
    webhook_url = os.environ.get("WEBHOOK_URL", "").strip()
    if not webhook_url:
        return

    try:
        response = requests.post(webhook_url, json={"text": message}, timeout=10)
        print(f"Webhook delivered with status {response.status_code}")
    except requests.RequestException as exc:
        print(f"Webhook delivery failed: {exc}", file=sys.stderr)


def fallback_extract(html: str) -> tuple[str, str]:
    soup = BeautifulSoup(html, "html.parser")
    title = soup.title.string.strip() if soup.title and soup.title.string else "Untitled page"
    text = " ".join(soup.get_text(" ", strip=True).split())
    return title, text


def extract_text(label: str, html: str) -> tuple[str, str]:
    if trafilatura is not None:
        try:
            extracted = trafilatura.extract(html, include_comments=False, include_tables=False)
        except Exception as exc:
            print(f"{label}: trafilatura extraction failed, falling back to BeautifulSoup ({exc})", file=sys.stderr)
            extracted = None
        if extracted:
            return label, " ".join(extracted.split())

    return fallback_extract(html)


def summarize_text(text: str, max_sentences: int) -> str:
    sentences = [sentence.strip() for sentence in re.split(r"(?<=[.!?])\s+", text) if sentence.strip()]
    if not sentences:
        return "No readable text extracted."
    return " ".join(sentences[:max_sentences])[:800]


def main() -> int:
    max_urls = env_int("MAX_URLS", 20)
    max_sentences = env_int("MAX_SENTENCES_PER_ITEM", 3)
    configured_urls = json.loads(Path("inputs.json").read_text(encoding="utf-8")).get("urls", [])
    if not configured_urls:
        raise SystemExit("inputs.json does not contain any URLs")

    targets = configured_urls[:max_urls]
    session = requests.Session()
    session.headers.update({"User-Agent": "cloudflare-actions/url-digest-batch"})

    summaries: list[dict] = []
    failures: list[str] = []

    for target in targets:
        label = target.get("label") or target.get("url") or "Unnamed URL"
        url = str(target.get("url", "")).strip()
        if not url:
            failures.append(f"{label}: missing url")
            continue

        try:
            response = session.get(url, timeout=20)
            response.raise_for_status()
        except requests.RequestException as exc:
            failures.append(f"{label}: request failed ({exc})")
            continue

        html = response.text
        try:
            title, text = extract_text(label, html)
        except Exception as exc:
            failures.append(f"{label}: content extraction failed ({exc})")
            continue

        if not text:
            failures.append(f"{label}: no readable text extracted")
            continue

        summaries.append(
            {
                "label": label,
                "url": url,
                "title": title,
                "text_length": len(text),
                "summary": summarize_text(text, max_sentences),
            }
        )

    if not summaries:
        send_report(
            "# URL Digest Batch\n\nNo pages produced readable content.\n\nFailures:\n"
            + "\n".join(f"- {failure}" for failure in failures)
        )
        return 1

    summaries.sort(key=lambda item: item["text_length"], reverse=True)
    overall_highlights = [item["label"] for item in summaries[:3]]

    lines = [
        "# URL Digest Batch",
        "",
        f"- URLs attempted: {len(targets)}",
        f"- Successful extracts: {len(summaries)}",
        f"- Failed extracts: {len(failures)}",
        f"- Longest reads: {', '.join(overall_highlights)}",
        "",
        "Per-page summaries:",
    ]

    for index, item in enumerate(summaries, start=1):
        lines.extend(
            [
                f"{index}. {item['label']}",
                f"   Link: {item['url']}",
                f"   Extracted length: {item['text_length']} characters",
                f"   Summary: {item['summary']}",
            ]
        )

    if failures:
        lines.extend(["", "Fetch issues:"])
        lines.extend([f"- {failure}" for failure in failures])

    send_report("\n".join(lines))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
