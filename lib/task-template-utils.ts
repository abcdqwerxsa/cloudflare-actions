import type { TaskTemplateFile, TaskTemplatePayload } from '@/lib/task-templates.generated';

export const LOCAL_TEMPLATE_STORAGE_KEY = 'cloudflare-actions.local-templates';

export interface CreateTaskRequestBody {
  name: string;
  description: string;
  schedule: string | null;
  entrypoint: string;
  env_vars: Record<string, string>;
  files: Array<{
    file_path: string;
    content: string;
    is_entrypoint: boolean;
  }>;
}

export interface TaskTemplateSummary {
  slug: string;
  name: string;
  description: string;
  category: string;
  runtime: string;
  icon: string;
  highlights: string[];
  schedule: string | null;
  fileCount: number;
  envVarNames: string[];
}

export interface TaskTemplateDraftInput {
  slug?: string;
  name: string;
  description?: string;
  category?: string;
  runtime?: string;
  icon?: string;
  highlights?: string[];
  schedule?: string | null;
  entrypoint?: string;
  env_vars?: Record<string, string>;
  files: TaskTemplateFile[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function ensureStringRecord(value: unknown): Record<string, string> {
  if (!isRecord(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entryValue]) => [key, typeof entryValue === 'string' ? entryValue : String(entryValue ?? '')]),
  );
}

function ensureFiles(value: unknown): TaskTemplateFile[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is Record<string, unknown> => isRecord(entry))
    .map((file) => ({
      file_path: typeof file.file_path === 'string' ? file.file_path : '',
      content: typeof file.content === 'string' ? file.content : '',
    }))
    .filter((file) => file.file_path);
}

export function slugifyTemplateName(input: string): string {
  const slug = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return slug || 'custom-template';
}

export function ensureUniqueTemplateSlug(baseSlug: string, takenSlugs: Iterable<string>): string {
  const taken = new Set(Array.from(takenSlugs));
  if (!taken.has(baseSlug)) {
    return baseSlug;
  }

  let index = 2;
  while (taken.has(`${baseSlug}-${index}`)) {
    index += 1;
  }
  return `${baseSlug}-${index}`;
}

export function buildTemplateSummary(template: TaskTemplatePayload): TaskTemplateSummary {
  return {
    slug: template.slug,
    name: template.name,
    description: template.description,
    category: template.category,
    runtime: template.runtime,
    icon: template.icon,
    highlights: template.highlights,
    schedule: template.schedule,
    fileCount: template.files.length,
    envVarNames: Object.keys(template.env_vars),
  };
}

export function buildCreateTaskRequest(template: TaskTemplatePayload): CreateTaskRequestBody {
  return {
    name: template.name,
    description: template.description,
    schedule: template.schedule || null,
    entrypoint: template.entrypoint,
    env_vars: template.env_vars,
    files: template.files.map((file) => ({
      file_path: file.file_path,
      content: file.content,
      is_entrypoint: file.file_path === template.entrypoint,
    })),
  };
}

export function buildTemplatePayloadFromTask(input: TaskTemplateDraftInput): TaskTemplatePayload {
  const files = ensureFiles(input.files);
  if (files.length === 0) {
    throw new Error('A template requires at least one file');
  }

  const entrypoint = input.entrypoint && files.some((file) => file.file_path === input.entrypoint)
    ? input.entrypoint
    : files[0].file_path;

  return {
    slug: slugifyTemplateName(input.slug || input.name),
    name: input.name.trim() || 'Untitled Template',
    description: input.description?.trim() || '',
    category: input.category?.trim() || 'Custom',
    runtime: input.runtime?.trim() || 'Container Task',
    icon: input.icon?.trim() || 'terminal',
    highlights: Array.isArray(input.highlights)
      ? input.highlights.map((item) => item.trim()).filter(Boolean)
      : [],
    schedule: input.schedule || null,
    entrypoint,
    env_vars: input.env_vars ?? {},
    files,
  };
}

export function normalizeTaskTemplate(input: unknown): TaskTemplatePayload {
  if (!isRecord(input)) {
    throw new Error('Template bundle must be a JSON object');
  }

  const files = ensureFiles(input.files);
  if (files.length === 0) {
    throw new Error('Template bundle must contain at least one file');
  }

  const name = typeof input.name === 'string' && input.name.trim() ? input.name.trim() : 'Imported Template';
  const fallbackEntrypoint = files[0].file_path;
  const requestedEntrypoint = typeof input.entrypoint === 'string' ? input.entrypoint : fallbackEntrypoint;
  const entrypoint = files.some((file) => file.file_path === requestedEntrypoint) ? requestedEntrypoint : fallbackEntrypoint;

  return {
    slug: slugifyTemplateName(typeof input.slug === 'string' ? input.slug : name),
    name,
    description: typeof input.description === 'string' ? input.description : '',
    category: typeof input.category === 'string' && input.category.trim() ? input.category : 'Custom',
    runtime: typeof input.runtime === 'string' && input.runtime.trim() ? input.runtime : 'Container Task',
    icon: typeof input.icon === 'string' && input.icon.trim() ? input.icon : 'terminal',
    highlights: Array.isArray(input.highlights)
      ? input.highlights.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean)
      : [],
    schedule: typeof input.schedule === 'string' ? input.schedule : null,
    entrypoint,
    env_vars: ensureStringRecord(input.env_vars),
    files,
  };
}

export function loadLocalTemplates(): TaskTemplatePayload[] {
  if (typeof window === 'undefined') {
    return [];
  }

  const rawValue = window.localStorage.getItem(LOCAL_TEMPLATE_STORAGE_KEY);
  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.map((template) => normalizeTaskTemplate(template));
  } catch {
    return [];
  }
}

export function saveLocalTemplates(templates: TaskTemplatePayload[]): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(LOCAL_TEMPLATE_STORAGE_KEY, JSON.stringify(templates));
}

export function upsertLocalTemplate(template: TaskTemplatePayload): TaskTemplatePayload[] {
  const current = loadLocalTemplates().filter((entry) => entry.slug !== template.slug);
  const next = [...current, template].sort((left, right) => left.name.localeCompare(right.name));
  saveLocalTemplates(next);
  return next;
}

export function removeLocalTemplate(slug: string): TaskTemplatePayload[] {
  const next = loadLocalTemplates().filter((template) => template.slug !== slug);
  saveLocalTemplates(next);
  return next;
}

export function downloadTemplateBundle(template: TaskTemplatePayload): void {
  if (typeof window === 'undefined') {
    return;
  }

  const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${template.slug}.template.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}
