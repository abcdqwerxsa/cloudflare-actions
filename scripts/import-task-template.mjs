import path from "node:path";
import { buildTaskPayload, resolveTemplateDir } from "./task-template-lib.mjs";

function parseArgs(argv) {
  const [template, ...flags] = argv;
  if (!template) {
    throw new Error(
      "Usage: npm run import:task-template -- <template-name-or-path> [--dry-run] [--api-base URL] [--api-key KEY]",
    );
  }

  const options = {
    template,
    dryRun: false,
    apiBase: process.env.CF_ACTIONS_API_BASE ?? "http://127.0.0.1:8787",
    apiKey: process.env.CF_ACTIONS_API_KEY ?? "",
  };

  for (let index = 0; index < flags.length; index += 1) {
    const flag = flags[index];
    if (flag === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (flag === "--api-base") {
      options.apiBase = flags[index + 1];
      index += 1;
      continue;
    }
    if (flag === "--api-key") {
      options.apiKey = flags[index + 1];
      index += 1;
      continue;
    }
    throw new Error(`Unknown flag: ${flag}`);
  }

  return options;
}

function buildTasksEndpoint(apiBase) {
  const normalized = apiBase.replace(/\/$/, "");
  return normalized.endsWith("/api") ? `${normalized}/tasks` : `${normalized}/api/tasks`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const templateDir = await resolveTemplateDir(options.template);
  const payload = await buildTaskPayload(templateDir);

  if (options.dryRun) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  const endpoint = buildTasksEndpoint(options.apiBase);
  const headers = { "Content-Type": "application/json" };
  if (options.apiKey) {
    headers["x-api-key"] = options.apiKey;
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(`Import failed (${response.status}): ${responseText}`);
  }

  const result = JSON.parse(responseText);
  console.log(
    JSON.stringify(
      {
        template: path.basename(templateDir),
        endpoint,
        taskId: result.task?.id ?? null,
        name: result.task?.name ?? payload.name,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
