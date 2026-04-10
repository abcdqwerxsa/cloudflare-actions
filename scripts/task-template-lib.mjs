import fs from "node:fs/promises";
import path from "node:path";

export const TEMPLATE_ROOT = path.resolve(process.cwd(), "task-templates");
const MANIFEST_FILE = "manifest.json";

async function readJson(filePath) {
  const contents = await fs.readFile(filePath, "utf8");
  return JSON.parse(contents);
}

async function walkFiles(rootDir, currentDir = rootDir) {
  const entries = await fs.readdir(currentDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".") || entry.name === "__pycache__") {
      continue;
    }

    const absolutePath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(rootDir, absolutePath)));
      continue;
    }

    const relativePath = path.relative(rootDir, absolutePath);
    if (relativePath === MANIFEST_FILE) {
      continue;
    }
    if (relativePath.endsWith(".pyc")) {
      continue;
    }

    files.push(relativePath);
  }

  return files.sort((left, right) => left.localeCompare(right));
}

export async function resolveTemplateDir(templateInput) {
  const directPath = path.resolve(process.cwd(), templateInput);
  try {
    const stat = await fs.stat(directPath);
    if (stat.isDirectory()) {
      return directPath;
    }
  } catch {}

  const namedPath = path.join(TEMPLATE_ROOT, templateInput);
  const stat = await fs.stat(namedPath);
  if (!stat.isDirectory()) {
    throw new Error(`Template is not a directory: ${templateInput}`);
  }
  return namedPath;
}

export async function listTemplateDirs(rootDir = TEMPLATE_ROOT) {
  const entries = await fs.readdir(rootDir, { withFileTypes: true });
  const dirs = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) {
      continue;
    }

    const templateDir = path.join(rootDir, entry.name);
    const manifestPath = path.join(templateDir, MANIFEST_FILE);
    try {
      await fs.access(manifestPath);
      dirs.push(templateDir);
    } catch {}
  }

  return dirs.sort((left, right) => left.localeCompare(right));
}

export async function buildTaskPayload(templateDir) {
  const absoluteTemplateDir = path.resolve(templateDir);
  const manifestPath = path.join(absoluteTemplateDir, MANIFEST_FILE);
  const manifest = await readJson(manifestPath);

  const files = [];
  for (const relativePath of await walkFiles(absoluteTemplateDir)) {
    const absolutePath = path.join(absoluteTemplateDir, relativePath);
    const content = await fs.readFile(absolutePath, "utf8");
    files.push({ file_path: relativePath, content });
  }

  const payload = {
    name: manifest.name,
    description: manifest.description ?? "",
    schedule: manifest.schedule ?? null,
    entrypoint: manifest.entrypoint ?? "run.sh",
    env_vars: manifest.env_vars ?? {},
    files,
  };

  validateTaskPayload(payload, absoluteTemplateDir);
  return payload;
}

export function validateTaskPayload(payload, templateDir = "<unknown>") {
  if (!payload || typeof payload !== "object") {
    throw new Error(`Invalid payload in ${templateDir}: payload must be an object`);
  }
  if (!payload.name || typeof payload.name !== "string") {
    throw new Error(`Invalid payload in ${templateDir}: "name" is required`);
  }
  if (!Array.isArray(payload.files) || payload.files.length === 0) {
    throw new Error(`Invalid payload in ${templateDir}: at least one file is required`);
  }
  if (!payload.entrypoint || typeof payload.entrypoint !== "string") {
    throw new Error(`Invalid payload in ${templateDir}: "entrypoint" is required`);
  }
  if (!payload.files.some((file) => file.file_path === payload.entrypoint)) {
    throw new Error(
      `Invalid payload in ${templateDir}: entrypoint "${payload.entrypoint}" is missing from files`,
    );
  }

  const filePaths = new Set();
  for (const file of payload.files) {
    if (!file.file_path || typeof file.file_path !== "string") {
      throw new Error(`Invalid payload in ${templateDir}: each file needs "file_path"`);
    }
    if (typeof file.content !== "string") {
      throw new Error(`Invalid payload in ${templateDir}: file "${file.file_path}" must be text`);
    }
    if (filePaths.has(file.file_path)) {
      throw new Error(`Invalid payload in ${templateDir}: duplicate file "${file.file_path}"`);
    }
    filePaths.add(file.file_path);
  }

  if (payload.env_vars && typeof payload.env_vars !== "object") {
    throw new Error(`Invalid payload in ${templateDir}: "env_vars" must be an object`);
  }
}
