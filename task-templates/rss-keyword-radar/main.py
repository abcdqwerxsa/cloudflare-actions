#!/usr/bin/env python3
import json
import os
import sys
import calendar
from datetime import datetime, timedelta, timezone
from pathlib import Path

import feedparser
import requests
from dateutil import parser as date_parser


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
        response = requests.post(
            webhook_url,
            json={"text": message},
            timeout=10,
        )
        print(f"Webhook delivered with status {response.status_code}")
    except requests.RequestException as exc:
        print(f"Webhook delivery failed: {exc}", file=sys.stderr)


def load_config() -> tuple[list[dict], list[str]]:
    feeds = json.loads(Path("feeds.json").read_text(encoding="utf-8")).get("feeds", [])
    keywords = [
        line.strip().lower()
        for line in Path("keywords.txt").read_text(encoding="utf-8").splitlines()
        if line.strip() and not line.strip().startswith("#")
    ]
    if not feeds:
        raise SystemExit("feeds.json does not contain any feeds")
    if not keywords:
        raise SystemExit("keywords.txt does not contain any keywords")
    return feeds, keywords


def parse_timestamp(entry: dict) -> datetime | None:
    for field_name in ("published", "updated", "created"):
        raw_value = entry.get(field_name)
        if not raw_value:
            continue
        try:
            parsed = date_parser.parse(raw_value)
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            return parsed.astimezone(timezone.utc)
        except (ValueError, TypeError, OverflowError):
            continue

    for field_name in ("published_parsed", "updated_parsed", "created_parsed"):
        parsed_tuple = entry.get(field_name)
        if not parsed_tuple:
            continue
        return datetime.fromtimestamp(calendar.timegm(parsed_tuple), tz=timezone.utc)

    return None


def main() -> int:
    lookback_hours = env_int("LOOKBACK_HOURS", 24)
    max_items = env_int("MAX_ITEMS", 10)
    cutoff = datetime.now(timezone.utc) - timedelta(hours=lookback_hours)

    feeds, keywords = load_config()
    session = requests.Session()
    session.headers.update({"User-Agent": "cloudflare-actions/rss-keyword-radar"})

    matches: list[dict] = []
    failures: list[str] = []
    seen_links: set[str] = set()

    for feed in feeds:
        name = feed.get("name") or feed.get("url") or "Unnamed feed"
        url = feed.get("url", "").strip()
        if not url:
            failures.append(f"{name}: missing url")
            continue

        try:
            response = session.get(url, timeout=20)
            response.raise_for_status()
            parsed = feedparser.parse(response.content)
        except requests.RequestException as exc:
            failures.append(f"{name}: {exc}")
            continue

        for entry in parsed.entries:
            link = (entry.get("link") or "").strip()
            title = (entry.get("title") or "Untitled").strip()
            summary = (entry.get("summary") or entry.get("description") or "").strip()
            haystack = f"{title}\n{summary}".lower()
            matched_keywords = [keyword for keyword in keywords if keyword in haystack]
            if not matched_keywords:
                continue

            published_at = parse_timestamp(entry)
            if published_at and published_at < cutoff:
                continue

            dedupe_key = link or f"{name}:{title}"
            if dedupe_key in seen_links:
                continue
            seen_links.add(dedupe_key)

            matches.append(
                {
                    "title": title,
                    "link": link or "No link provided",
                    "source": name,
                    "published_at": published_at or datetime.now(timezone.utc),
                    "matched_keywords": matched_keywords,
                }
            )

    matches.sort(key=lambda item: item["published_at"], reverse=True)
    top_matches = matches[:max_items]

    lines = [
        "# RSS Keyword Radar",
        "",
        f"- Window: last {lookback_hours} hours",
        f"- Feeds configured: {len(feeds)}",
        f"- Matches found: {len(matches)}",
    ]

    if top_matches:
        lines.append("")
        for index, match in enumerate(top_matches, start=1):
            published = match["published_at"].strftime("%Y-%m-%d %H:%M UTC")
            keyword_text = ", ".join(match["matched_keywords"])
            lines.extend(
                [
                    f"{index}. {match['title']}",
                    f"   Source: {match['source']}",
                    f"   Time: {published}",
                    f"   Keywords: {keyword_text}",
                    f"   Link: {match['link']}",
                ]
            )
    else:
        lines.extend(["", "No keyword matches were found in the configured window."])

    if failures:
        lines.extend(["", "Feed fetch issues:"])
        lines.extend([f"- {failure}" for failure in failures])

    message = "\n".join(lines)
    send_report(message)

    if failures and len(failures) == len(feeds):
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
