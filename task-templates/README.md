# Task Templates

This directory contains ready-to-import task templates for Cloudflare Actions.

Each template is a folder with:

- `manifest.json`: task metadata and default environment variables
- `run.sh`: task entrypoint
- task source files such as `main.py`, `requirements.txt`, and config files

## Validate templates

```bash
npm run validate:task-templates
```

## Regenerate the frontend template registry

```bash
npm run generate:task-template-registry
```

## Preview the task payload

```bash
npm run import:task-template -- rss-keyword-radar --dry-run
```

## Import a template into a local worker

```bash
CF_ACTIONS_API_KEY=your-api-key \
npm run import:task-template -- rss-keyword-radar --api-base http://127.0.0.1:8787
```

## Import a template into a remote worker

```bash
CF_ACTIONS_API_BASE=https://your-worker.example.workers.dev \
CF_ACTIONS_API_KEY=your-api-key \
npm run import:task-template -- website-availability-check
```

## Template catalog

- `rss-keyword-radar`: watches RSS/Atom feeds for keyword matches and posts a digest
- `github-release-radar`: watches GitHub releases across multiple repositories
- `website-availability-check`: checks page status, latency, and required text
- `api-smoke-probe`: validates API endpoints and expected JSON fields
- `url-digest-batch`: fetches configured URLs and produces a summary digest
- `remote-dataset-daily-report`: downloads CSV or JSON data and generates a daily report
