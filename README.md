# Cloudflare Actions

A GitHub Actions-like scheduled task distribution system built on **Cloudflare Workers + Cloudflare Containers**.

## Architecture

```
User Browser (Pages) → Worker API → D1 Database
                          ↓
Cron Trigger (every min) → Evaluate schedules → Runner Durable Objects
                                                   ↓
                                          Cloudflare Containers
                                          (isolated task execution)
```

## Features

- **Three task types**: Inline code (Python/Node.js/Bash), custom Docker images, git repository clones
- **Flexible scheduling**: Standard 5-field cron expressions (e.g. `0 */6 * * *` for every 6 hours)
- **Manual triggers**: Run any task on-demand via UI or API
- **Real-time logs**: View execution logs in the dashboard
- **API key auth**: Secure API access with key management
- **Dark theme UI**: Production-grade monitoring dashboard

## Components

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Frontend | Next.js + Tailwind CSS | Dashboard UI on Cloudflare Pages |
| API Server | Cloudflare Workers | REST API for tasks, executions, keys |
| Database | Cloudflare D1 | SQLite storage for tasks & executions |
| Scheduler | Cron Triggers | Evaluates task schedules every minute |
| Runner | Durable Objects + Containers | Isolated task execution |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/tasks` | List all tasks |
| POST | `/tasks` | Create a task |
| GET | `/tasks/:id` | Get task detail |
| PUT | `/tasks/:id` | Update task |
| DELETE | `/tasks/:id` | Delete task |
| POST | `/tasks/:id/trigger` | Trigger manual execution |
| GET | `/executions` | List executions |
| GET | `/executions/:id` | Get execution detail + logs |
| GET | `/keys` | List API keys |
| POST | `/keys` | Create API key |
| DELETE | `/keys/:id` | Delete API key |

## Task Templates

The repository includes ready-to-import task templates under `task-templates/` for common use cases:

- RSS and Atom keyword monitoring
- GitHub release monitoring
- Website and API smoke checks
- Batch URL digests
- Remote CSV and JSON daily reports

Validate all templates:

```bash
npm run validate:task-templates
```

Regenerate the frontend template registry after editing template files:

```bash
npm run generate:task-template-registry
```

Preview a task payload before import:

```bash
npm run import:task-template -- rss-keyword-radar --dry-run
```

Import a template into a running worker:

```bash
CF_ACTIONS_API_BASE=http://127.0.0.1:8787 \
CF_ACTIONS_API_KEY=your-api-key \
npm run import:task-template -- website-availability-check
```

## Deployment

### Prerequisites

- Node.js 20+
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) (`npm install -g wrangler`)
- Cloudflare account with D1, Workers, and Containers enabled

### 1. Clone and install

```bash
git clone https://github.com/abcdqwerxsa/cloudflare-actions.git
cd cloudflare-actions
npm install
```

### 2. Create D1 database

```bash
wrangler d1 create cloudflare-actions-db
# Update the database_id in wrangler.toml
wrangler d1 execute cloudflare-actions-db --file=migrations/0001_initial.sql --remote
```

### 3. Deploy backend Worker

```bash
# Temporarily hide open-next config (avoids OpenNext intercepting wrangler)
mv open-next.config.ts open-next.config.ts.bak
wrangler deploy
mv open-next.config.ts.bak open-next.config.ts
```

### 4. Deploy frontend to Pages

```bash
# Build
npx opennextjs-cloudflare build

# Copy worker.js and support files to assets
cp .open-next/worker.js .open-next/assets/_worker.js
cp -r .open-next/cloudflare .open-next/assets/
cp -r .open-next/middleware .open-next/assets/
cp -r .open-next/.build .open-next/assets/
cp -r .open-next/server-functions .open-next/assets/
cp -r .open-next/cache .open-next/assets/

# Deploy (use Pages-specific wrangler config)
cp wrangler-pages.toml wrangler.toml
wrangler pages deploy .open-next/assets --project-name cloudflare-actions-ui --commit-dirty=true

# Restore worker config
cp /tmp/wrangler-worker-backup.toml wrangler.toml
```

### 5. Configure environment

Update `API_KEY` in `wrangler.toml` for production use.

## Project Structure

```
├── app/                    # Next.js frontend (Pages)
│   ├── page.tsx            # Dashboard
│   ├── tasks/              # Task list, create, detail
│   ├── executions/         # Execution list, detail
│   └── settings/           # API key management
├── worker/                 # Cloudflare Worker backend
│   ├── index.ts            # Entry point + route handler
│   ├── api-handler.ts      # REST API implementation
│   ├── cron-handler.ts     # Cron evaluation + dispatch
│   ├── runner-container.ts # Container execution (DO)
│   └── types.ts            # Shared TypeScript types
├── migrations/             # D1 database schema
├── task-templates/         # Ready-to-import task templates
├── scripts/                # Template import and validation scripts
├── Dockerfile              # Default container image
├── wrangler.toml           # Worker config (API + DO + Cron)
└── wrangler-pages.toml     # Pages config (frontend deploy)
```

## Local Development

```bash
# Frontend
npm run dev

# Worker (requires wrangler)
wrangler dev
```
