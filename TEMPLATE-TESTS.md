# Template Smoke Test Baseline

Last updated: 2026-04-10

## Environment

- Worker URL: `https://cloudflare-actions.jeanpaul20020519.workers.dev`
- Worker version verified during this round:
  - `f81f8650-1930-4ca8-b581-1a9967efc4f0`
- Git branch: `feat/single-worker`
- Git commit containing latest template hardening:
  - `17fbe0202d59454ccd6e4d24c2b146f3d5fcd644`

## Test Method

Smoke tests are executed against the live worker API, not just local code:

1. Create a temporary task from each built-in template through `/api/tasks`
2. Disable webhook delivery by setting `WEBHOOK_URL=""`
3. Trigger the task through `/api/tasks/:id/trigger`
4. Poll `/api/executions/:id` until the task reaches a terminal state
5. Record status, exit code, and a short log snippet
6. Delete all temporary `E2E ...` tasks after the run

Overrides used in production-like tests:

- `rss-keyword-radar`
  - `LOOKBACK_HOURS=48`
  - `MAX_ITEMS=5`
- `github-release-radar`
  - `GITHUB_TOKEN=""`
  - `MAX_RELEASES=5`
- `website-availability-check`
  - `NOTIFY_ON_SUCCESS=0`
- `api-smoke-probe`
  - `NOTIFY_ON_SUCCESS=0`
  - `API_TOKEN=""`
- `url-digest-batch`
  - `MAX_URLS=3`
  - `MAX_SENTENCES_PER_ITEM=2`
- `remote-dataset-daily-report`
  - `DATA_URL=https://raw.githubusercontent.com/plotly/datasets/master/finance-charts-apple.csv`
  - `config.json` overridden for the Apple finance CSV columns

## Current Baseline

### 1. rss-keyword-radar

- Result: Pass
- Expected status: `success`
- Observed behavior:
  - returns a real digest body
  - currently reports that the default `Python Insider` feed returns `404`
- Interpretation:
  - template logic is healthy
  - one sample feed is stale and should be considered a non-fatal content issue

### 2. github-release-radar

- Result: Pass
- Expected status: `success`
- Observed behavior:
  - execution succeeds consistently
  - logs may still collapse to `Process exited with code 0` on short successful runs
- Interpretation:
  - template logic is healthy
  - platform log completeness for short successful tasks is still imperfect

### 3. website-availability-check

- Result: Pass after template hardening
- Expected status: `success`
- Current default checks:
  - `http://example.com`
  - `https://developers.cloudflare.com/`
- Observed behavior:
  - both checks pass in the production runner
- Interpretation:
  - the earlier failure was caused by the original sample target `https://example.com` hitting certificate-chain issues in the runner context

### 4. api-smoke-probe

- Result: Pass
- Expected status: `success`
- Observed behavior:
  - both sample checks pass
  - logs contain detailed pass output
- Interpretation:
  - template logic is healthy

### 5. url-digest-batch

- Result: Pass after template hardening
- Expected status: `success`
- Observed behavior:
  - all 3 default URLs complete successfully
  - logs now include full digest output
  - the warning `lxml 6.0.3 does not provide the extra 'html_clean'` can still appear
- Interpretation:
  - the earlier failure was caused by brittle extraction behavior
  - extraction fallback logic now makes the task resilient enough for production use
  - the remaining `lxml` warning is noisy but not currently breaking execution

### 6. remote-dataset-daily-report

- Result: Pass
- Expected status: `success`
- Observed behavior:
  - succeeds against the public Apple finance CSV
  - returns grouped stats and numeric summaries
- Interpretation:
  - template logic is healthy

## Platform Findings From This Round

These are not template-specific:

- Exit-code detection bug:
  - fixed in the runner
  - failure states now correctly surface as `failed` instead of sometimes being misreported as `success`
- Log delivery:
  - much better than before
  - failed tasks and longer-running tasks now return meaningful logs
  - very short successful tasks can still occasionally end with the fallback success log

## Regression Checklist

Run the live smoke workflow again after any change to:

- `worker/index.ts`
- `worker/runner-container.ts`
- any file under `task-templates/`
- `scripts/generate-task-template-registry.mjs`

Expected baseline today:

- `rss-keyword-radar`: pass
- `github-release-radar`: pass
- `website-availability-check`: pass
- `api-smoke-probe`: pass
- `url-digest-batch`: pass
- `remote-dataset-daily-report`: pass

Post-run cleanup requirement:

- no remaining tasks whose name starts with `E2E `

## Remaining Follow-ups

- Replace the stale `Python Insider` RSS sample source with a healthier default
- Improve log completeness for very short successful runs such as `github-release-radar`
- Optionally suppress or eliminate the `lxml` warning in `url-digest-batch`
