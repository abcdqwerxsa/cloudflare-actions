#!/usr/bin/env python3
import json
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

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
        response = requests.post(webhook_url, json={"text": message}, timeout=10)
        print(f"Webhook delivered with status {response.status_code}")
    except requests.RequestException as exc:
        print(f"Webhook delivery failed: {exc}", file=sys.stderr)


def summarize_notes(body: str, limit: int = 300) -> str:
    compact = " ".join(body.split())
    if len(compact) <= limit:
        return compact or "No release notes provided."
    return f"{compact[:limit - 3]}..."


def main() -> int:
    lookback_hours = env_int("LOOKBACK_HOURS", 24)
    max_releases = env_int("MAX_RELEASES", 10)
    cutoff = datetime.now(timezone.utc) - timedelta(hours=lookback_hours)
    repos = json.loads(Path("repos.json").read_text(encoding="utf-8")).get("repos", [])
    if not repos:
        raise SystemExit("repos.json does not contain any repositories")

    session = requests.Session()
    session.headers.update(
        {
            "Accept": "application/vnd.github+json",
            "User-Agent": "cloudflare-actions/github-release-radar",
        }
    )
    github_token = os.environ.get("GITHUB_TOKEN", "").strip()
    if github_token:
        session.headers["Authorization"] = f"Bearer {github_token}"

    releases: list[dict] = []
    failures: list[str] = []

    for repo in repos:
        repo_name = (repo.get("name") or "").strip()
        if not repo_name:
            failures.append("Encountered a repo entry with no name")
            continue

        url = f"https://api.github.com/repos/{repo_name}/releases"
        try:
            response = session.get(url, timeout=20)
            response.raise_for_status()
            payload = response.json()
        except (requests.RequestException, ValueError) as exc:
            failures.append(f"{repo_name}: {exc}")
            continue

        for release in payload:
            published_at_raw = release.get("published_at") or release.get("created_at")
            if not published_at_raw:
                continue
            published_at = date_parser.parse(published_at_raw)
            if published_at.tzinfo is None:
                published_at = published_at.replace(tzinfo=timezone.utc)
            published_at = published_at.astimezone(timezone.utc)
            if published_at < cutoff:
                continue

            releases.append(
                {
                    "repo": repo_name,
                    "tag_name": release.get("tag_name") or "unknown",
                    "name": release.get("name") or "Untitled release",
                    "published_at": published_at,
                    "url": release.get("html_url") or f"https://github.com/{repo_name}/releases",
                    "notes": summarize_notes(release.get("body") or ""),
                }
            )

    releases.sort(key=lambda item: item["published_at"], reverse=True)
    top_releases = releases[:max_releases]

    lines = [
        "# GitHub Release Radar",
        "",
        f"- Window: last {lookback_hours} hours",
        f"- Repositories configured: {len(repos)}",
        f"- Releases found: {len(releases)}",
    ]

    if not github_token:
        lines.append("- Authentication: anonymous GitHub API access, low rate limits apply")

    if top_releases:
        lines.append("")
        for index, release in enumerate(top_releases, start=1):
            published = release["published_at"].strftime("%Y-%m-%d %H:%M UTC")
            lines.extend(
                [
                    f"{index}. {release['repo']} {release['tag_name']} ({release['name']})",
                    f"   Published: {published}",
                    f"   Link: {release['url']}",
                    f"   Notes: {release['notes']}",
                ]
            )
    else:
        lines.extend(["", "No releases were published in the configured window."])

    if failures:
        lines.extend(["", "Repository fetch issues:"])
        lines.extend([f"- {failure}" for failure in failures])

    message = "\n".join(lines)
    send_report(message)

    if failures and len(failures) == len(repos):
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
