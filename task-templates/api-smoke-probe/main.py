#!/usr/bin/env python3
import json
import os
import re
import sys
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


def expand_env(value):
    if isinstance(value, str):
        return re.sub(r"\$\{([A-Z0-9_]+)\}", lambda match: os.environ.get(match.group(1), ""), value)
    if isinstance(value, dict):
        return {key: expand_env(inner_value) for key, inner_value in value.items()}
    if isinstance(value, list):
        return [expand_env(item) for item in value]
    return value


def has_json_path(payload, path: str) -> bool:
    current = payload
    for part in path.split("."):
        if isinstance(current, list):
            try:
                current = current[int(part)]
            except (ValueError, IndexError):
                return False
            continue
        if not isinstance(current, dict) or part not in current:
            return False
        current = current[part]
    return True


def main() -> int:
    timeout_seconds = env_int("TIMEOUT_SECONDS", 10)
    notify_on_success = os.environ.get("NOTIFY_ON_SUCCESS", "0").strip() == "1"
    checks = json.loads(Path("checks.json").read_text(encoding="utf-8")).get("checks", [])
    checks = [check for check in checks if check.get("enabled", True)]
    if not checks:
        raise SystemExit("checks.json does not contain any enabled checks")

    session = requests.Session()
    session.headers.update({"User-Agent": "cloudflare-actions/api-smoke-probe"})

    successes: list[str] = []
    failures: list[str] = []

    for check in checks:
        name = check.get("name") or check.get("url") or "Unnamed API check"
        method = str(check.get("method", "GET")).upper()
        url = str(check.get("url", "")).strip()
        headers = expand_env(check.get("headers", {}))
        body = expand_env(check.get("body"))
        expected_status = int(check.get("expected_status", 200))
        expected_json_keys = check.get("expected_json_keys", [])

        try:
            response = session.request(
                method,
                url,
                headers=headers,
                json=body if isinstance(body, (dict, list)) else None,
                data=body if isinstance(body, str) else None,
                timeout=timeout_seconds,
            )
        except requests.RequestException as exc:
            failures.append(f"{name}: request failed ({exc})")
            continue

        if response.status_code != expected_status:
            snippet = response.text[:500].replace("\n", " ")
            failures.append(
                f"{name}: expected status {expected_status}, got {response.status_code}, response={snippet}"
            )
            continue

        try:
            response_payload = response.json()
        except ValueError:
            failures.append(f"{name}: response is not valid JSON")
            continue

        missing = [path for path in expected_json_keys if not has_json_path(response_payload, path)]
        if missing:
            failures.append(f"{name}: missing JSON keys {missing}")
            continue

        successes.append(f"- {name}: {response.status_code} ok")

    lines = [
        "# API Smoke Probe",
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
