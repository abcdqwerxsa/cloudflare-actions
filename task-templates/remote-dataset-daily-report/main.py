#!/usr/bin/env python3
import io
import json
import os
import sys
from pathlib import Path

import pandas as pd
import requests


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


def load_frame(raw_text: str, config: dict) -> pd.DataFrame:
    fmt = str(config.get("format", "csv")).lower()
    if fmt == "csv":
        return pd.read_csv(io.StringIO(raw_text))
    if fmt == "json":
        payload = json.loads(raw_text)
        if isinstance(payload, list):
            return pd.DataFrame(payload)
        records_path = config.get("json_records_path")
        current = payload
        if records_path:
            for part in str(records_path).split("."):
                current = current[part]
        return pd.DataFrame(current)
    raise SystemExit(f"Unsupported format: {fmt}")


def main() -> int:
    data_url = os.environ.get("DATA_URL", "").strip()
    if not data_url:
        raise SystemExit("DATA_URL is required")

    config = json.loads(Path("config.json").read_text(encoding="utf-8"))
    response = requests.get(data_url, timeout=30, headers={"User-Agent": "cloudflare-actions/dataset-report"})
    response.raise_for_status()

    frame = load_frame(response.text, config)
    lines = [
        "# Remote Dataset Daily Report",
        "",
        f"- Source: {data_url}",
        f"- Rows: {len(frame)}",
        f"- Columns: {len(frame.columns)}",
    ]

    time_column = config.get("time_column")
    if time_column:
        if time_column not in frame.columns:
            raise SystemExit(f"time_column {time_column!r} is missing from the dataset")
        frame[time_column] = pd.to_datetime(frame[time_column], errors="coerce", utc=True)
        recent_cutoff = pd.Timestamp.utcnow() - pd.Timedelta(hours=24)
        recent_rows = int((frame[time_column] >= recent_cutoff).fillna(False).sum())
        lines.append(f"- Recent rows (24h): {recent_rows}")

    group_by = config.get("group_by", [])
    if group_by:
        if isinstance(group_by, str):
            group_by = [group_by]
        missing_columns = [column for column in group_by if column not in frame.columns]
        if missing_columns:
            raise SystemExit(f"group_by columns missing from dataset: {missing_columns}")
        top_n = int(config.get("top_n", 5))
        grouped = frame.groupby(group_by, dropna=False).size().sort_values(ascending=False).head(top_n)
        lines.extend(["", "Top groups:"])
        for key, count in grouped.items():
            key_display = key if isinstance(key, tuple) else (key,)
            lines.append(f"- {key_display}: {int(count)}")

    numeric_summaries = config.get("numeric_summaries", [])
    if numeric_summaries:
        lines.extend(["", "Numeric summaries:"])
        for column in numeric_summaries:
            if column not in frame.columns:
                raise SystemExit(f"numeric summary column {column!r} is missing from the dataset")
            series = pd.to_numeric(frame[column], errors="coerce")
            lines.append(
                f"- {column}: sum={series.sum(skipna=True):.2f}, mean={series.mean(skipna=True):.2f}, max={series.max(skipna=True):.2f}"
            )

    anomaly_rules = config.get("anomaly_rules", [])
    if anomaly_rules:
        lines.extend(["", "Anomalies:"])
        for rule in anomaly_rules:
            column = rule["column"]
            if column not in frame.columns:
                raise SystemExit(f"anomaly column {column!r} is missing from the dataset")
            series = pd.to_numeric(frame[column], errors="coerce")
            if "gt" in rule:
                filtered = frame[series > float(rule["gt"])]
                operator_text = f">{rule['gt']}"
            elif "lt" in rule:
                filtered = frame[series < float(rule["lt"])]
                operator_text = f"<{rule['lt']}"
            else:
                raise SystemExit(f"anomaly rule for column {column!r} needs gt or lt")

            lines.append(
                f"- {rule.get('label', column)}: {len(filtered)} rows where {column} {operator_text}"
            )

    output_path = "/tmp/output.csv"
    frame.to_csv(output_path, index=False)
    lines.append("")
    lines.append(f"Cleaned dataset saved to {output_path}")

    send_report("\n".join(lines))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
