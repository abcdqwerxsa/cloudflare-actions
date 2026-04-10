#!/usr/bin/env python3
import json
import os
import sys
import time
from pathlib import Path

import requests


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


def main() -> int:
    timeout_seconds = env_int("TIMEOUT_SECONDS", 10)
    notify_on_success = os.environ.get("NOTIFY_ON_SUCCESS", "0").strip() == "1"
    payload = json.loads(Path("checks.json").read_text(encoding="utf-8"))
    checks = [check for check in payload.get("checks", []) if check.get("enabled", True)]
    if not checks:
        raise SystemExit("checks.json does not contain any enabled checks")

    session = requests.Session()
    session.headers.update({"User-Agent": "cloudflare-actions/website-availability-check"})

    successes: list[str] = []
    failures: list[str] = []

    for check in checks:
        name = check.get("name") or check.get("url") or "Unnamed check"
        url = check.get("url", "").strip()
        expected_status = int(check.get("expected_status", 200))
        expected_snippets = check.get("must_contain", [])
        max_latency_ms = int(check.get("max_latency_ms", 5000))

        start = time.perf_counter()
        try:
            response = session.get(url, timeout=timeout_seconds)
            latency_ms = int((time.perf_counter() - start) * 1000)
        except requests.RequestException as exc:
            failures.append(f"{name}: request failed ({exc})")
            continue

        if response.status_code != expected_status:
            failures.append(
                f"{name}: expected status {expected_status}, got {response.status_code} ({url})"
            )
            continue

        if latency_ms > max_latency_ms:
            failures.append(
                f"{name}: latency {latency_ms}ms exceeded threshold {max_latency_ms}ms ({url})"
            )
            continue

        missing = [snippet for snippet in expected_snippets if snippet not in response.text]
        if missing:
            failures.append(f"{name}: missing text snippets {missing} ({url})")
            continue

        successes.append(f"- {name}: {response.status_code} in {latency_ms}ms")

    lines = [
        "# Website Availability Check",
        "",
        f"- Checks executed: {len(checks)}",
        f"- Passed: {len(successes)}",
        f"- Failed: {len(failures)}",
    ]

    if successes:
        lines.extend(["", "Passing checks:"])
        lines.extend(successes)

    if failures:
        lines.extend(["", "Failures:"])
        lines.extend([f"- {failure}" for failure in failures])
        send_report("\n".join(lines))
        return 1

    message = "\n".join(lines)
    print(message)
    if notify_on_success:
        send_report(message)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
