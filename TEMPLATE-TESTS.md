# Template Smoke Tests

This document tracks production-like smoke tests for the built-in task templates.

## Latest Baseline

- Date: 2026-04-10
- Worker URL: `https://cloudflare-actions.jeanpaul20020519.workers.dev`
- Worker Version ID: `f81f8650-1930-4ca8-b581-1a9967efc4f0`
- Git branch: `feat/single-worker`
- Git commit: `17fbe0202d59454ccd6e4d24c2b146f3d5fcd644`

## Test Method

- Create one temporary task per built-in template through the public `/api/tasks` endpoint.
- Override only the minimum environment and config needed to make the run production-like:
  - Disable webhook delivery by setting `WEBHOOK_URL` to an empty string.
  - Keep RSS and release templates on public sources.
  - Use a public CSV for `remote-dataset-daily-report`.
  - Limit `url-digest-batch` to 3 URLs and 2 summary sentences.
- Trigger each task manually through `/api/tasks/:id/trigger`.
- Poll `/api/executions/:id` until the execution reaches `success`, `failed`, or `timeout`.
- Delete all temporary `E2E` tasks after collecting results.

## Current Results

| Template | Result | Notes |
| --- | --- | --- |
| `rss-keyword-radar` | Pass | Task succeeds and returns a real digest. The default `Python Insider` feed currently returns `404`, so the report includes a feed issue line. |
| `github-release-radar` | Pass | Task succeeds. Logs can still collapse to `Process exited with code 0` on short successful runs, so log completeness is not yet perfect. |
| `website-availability-check` | Pass | Default checks were updated to `http://example.com` and `https://developers.cloudflare.com/`. Both checks now pass in the production runner. |
| `api-smoke-probe` | Pass | Task succeeds and returns detailed pass output for both configured checks. |
| `url-digest-batch` | Pass | Task succeeds after hardening content extraction. It still prints an `lxml` warning, but the task completes and returns summaries for all configured URLs. |
| `remote-dataset-daily-report` | Pass | Task succeeds with the public Apple finance CSV and returns grouped and numeric summary output. |

## Known Issues

- `github-release-radar` can still finish with only the fallback success log, even though the task itself succeeds. This is a platform log-delivery quality issue, not a template correctness issue.
- `rss-keyword-radar` depends on one public sample feed that is currently stale or unavailable. The template remains valid, but the sample source should eventually be replaced with a healthier default.
- `url-digest-batch` still emits the warning `lxml 6.0.3 does not provide the extra 'html_clean'`. This is noisy but not currently breaking execution.

## Regression Checklist

Run this checklist after any change to:

- `worker/index.ts`
- `worker/runner-container.ts`
- any file under `task-templates/`
- `scripts/generate-task-template-registry.mjs`

Expected regression outcome:

1. `rss-keyword-radar` returns `success` and includes non-empty logs.
2. `github-release-radar` returns `success`.
3. `website-availability-check` returns `success` with the current default `checks.json`.
4. `api-smoke-probe` returns `success` and includes non-empty logs.
5. `url-digest-batch` returns `success` with the current default `inputs.json`.
6. `remote-dataset-daily-report` returns `success` with the public CSV override used in smoke tests.

Cleanup requirement:

- There should be no leftover tasks whose name begins with `E2E ` after the regression run completes.
