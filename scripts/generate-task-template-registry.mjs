import fs from "node:fs/promises";
import path from "node:path";
import { buildTaskPayload, listTemplateDirs } from "./task-template-lib.mjs";

const OUTPUT_FILE = path.resolve(process.cwd(), "lib/task-templates.generated.ts");
const PUBLIC_TEMPLATE_DIR = path.resolve(process.cwd(), "public/task-templates");

async function main() {
  const templateDirs = await listTemplateDirs();
  const templates = [];
  await fs.mkdir(PUBLIC_TEMPLATE_DIR, { recursive: true });

  for (const templateDir of templateDirs) {
    const manifestPath = path.join(templateDir, "manifest.json");
    const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
    const payload = await buildTaskPayload(templateDir);
    const template = {
      slug: path.basename(templateDir),
      category: manifest.category ?? "General",
      runtime: manifest.runtime ?? "Python",
      icon: manifest.icon ?? "terminal",
      highlights: manifest.highlights ?? [],
      ...payload,
    };
    templates.push(template);
    await fs.writeFile(
      path.join(PUBLIC_TEMPLATE_DIR, `${template.slug}.json`),
      JSON.stringify(template, null, 2),
      "utf8",
    );
  }

  const lines = [
    "export interface TaskTemplateFile {",
    "  file_path: string;",
    "  content: string;",
    "}",
    "",
    "export interface TaskTemplatePayload {",
    "  slug: string;",
    "  name: string;",
    "  description: string;",
    "  category: string;",
    "  runtime: string;",
    "  icon: string;",
    "  highlights: string[];",
    "  schedule: string | null;",
    "  entrypoint: string;",
    "  env_vars: Record<string, string>;",
    "  files: TaskTemplateFile[];",
    "}",
    "",
    `export const TASK_TEMPLATES: TaskTemplatePayload[] = ${JSON.stringify(templates, null, 2)};`,
    "",
    "export const TASK_TEMPLATE_MAP: Record<string, TaskTemplatePayload> = Object.fromEntries(",
    "  TASK_TEMPLATES.map((template) => [template.slug, template]),",
    ") as Record<string, TaskTemplatePayload>;",
    "",
    "export const TASK_TEMPLATE_SUMMARIES = TASK_TEMPLATES.map((template) => ({",
    "  slug: template.slug,",
    "  name: template.name,",
    "  description: template.description,",
    "  category: template.category,",
    "  runtime: template.runtime,",
    "  icon: template.icon,",
    "  highlights: template.highlights,",
    "  schedule: template.schedule,",
    "  fileCount: template.files.length,",
    "  envVarNames: Object.keys(template.env_vars),",
    "}));",
    "",
  ];

  await fs.writeFile(OUTPUT_FILE, `${lines.join("\n")}`, "utf8");
  await fs.writeFile(
    path.join(PUBLIC_TEMPLATE_DIR, "index.json"),
    JSON.stringify(
      templates.map((template) => ({
        slug: template.slug,
        name: template.name,
        description: template.description,
        category: template.category,
        runtime: template.runtime,
        icon: template.icon,
        highlights: template.highlights,
        schedule: template.schedule,
        envVarNames: Object.keys(template.env_vars),
        fileCount: template.files.length,
      })),
      null,
      2,
    ),
    "utf8",
  );

  console.log(
    `Generated ${path.relative(process.cwd(), OUTPUT_FILE)} and ${path.relative(process.cwd(), PUBLIC_TEMPLATE_DIR)} from ${templates.length} templates`,
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
