'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

import { API_BASE } from '@/lib/api';
import {
  buildCreateTaskRequest,
  buildTemplateSummary,
  downloadTemplateBundle,
  ensureUniqueTemplateSlug,
  loadLocalTemplates,
  normalizeTaskTemplate,
  removeLocalTemplate,
  saveLocalTemplates,
  type TaskTemplateSummary,
} from '@/lib/task-template-utils';
import type { TaskTemplatePayload } from '@/lib/task-templates.generated';

interface TemplateSummaryWithSource extends TaskTemplateSummary {
  source: 'built-in' | 'local';
}

interface TemplatesClientProps {
  templates: TaskTemplateSummary[];
}

interface TemplateEditorDraft {
  originalSlug: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  runtime: string;
  icon: string;
  highlightsText: string;
}

function formatSchedule(schedule: string | null) {
  return schedule || 'Manual only';
}

function getFileIcon(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  const icons: Record<string, string> = {
    sh: 'terminal',
    bash: 'terminal',
    py: 'code',
    js: 'javascript',
    ts: 'code',
    json: 'data_object',
    txt: 'description',
    md: 'description',
    yml: 'settings',
    yaml: 'settings',
    toml: 'settings',
    env: 'lock',
  };
  return icons[ext] || 'draft';
}

async function fetchTemplatePayload(slug: string): Promise<TaskTemplatePayload> {
  const response = await fetch(`/task-templates/${slug}.json`, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Failed to load template ${slug}`);
  }
  return response.json();
}

export default function TemplatesClient({ templates }: TemplatesClientProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [localTemplates, setLocalTemplates] = useState<TaskTemplatePayload[]>([]);
  const [creatingSlug, setCreatingSlug] = useState<string | null>(null);
  const [previewingSlug, setPreviewingSlug] = useState<string | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<TaskTemplatePayload | null>(null);
  const [previewFilePath, setPreviewFilePath] = useState<string>('');
  const [showAllFiles, setShowAllFiles] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string>('');
  const [showEditorModal, setShowEditorModal] = useState(false);
  const [editorSaving, setEditorSaving] = useState(false);
  const [editorDraft, setEditorDraft] = useState<TemplateEditorDraft>({
    originalSlug: '',
    name: '',
    slug: '',
    description: '',
    category: 'Custom',
    runtime: 'Container Task',
    icon: 'terminal',
    highlightsText: '',
  });
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');

  useEffect(() => {
    setLocalTemplates(loadLocalTemplates());
  }, []);

  const builtInSlugs = useMemo(() => new Set(templates.map((template) => template.slug)), [templates]);
  const mergedTemplates = useMemo<TemplateSummaryWithSource[]>(
    () => [
      ...templates.map((template) => ({ ...template, source: 'built-in' as const })),
      ...localTemplates.map((template) => ({ ...buildTemplateSummary(template), source: 'local' as const })),
    ],
    [localTemplates, templates],
  );

  const localTemplateMap = useMemo(
    () => Object.fromEntries(localTemplates.map((template) => [template.slug, template])),
    [localTemplates],
  );

  const categories = ['All', ...Array.from(new Set(mergedTemplates.map((template) => template.category)))];
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const visibleTemplates = mergedTemplates.filter((template) => {
    const matchesCategory = activeCategory === 'All' || template.category === activeCategory;
    if (!matchesCategory) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    const searchSpace = [
      template.name,
      template.description,
      template.category,
      template.runtime,
      template.slug,
      template.source,
      ...template.highlights,
      ...template.envVarNames,
    ].join('\n').toLowerCase();

    return searchSpace.includes(normalizedQuery);
  });

  const previewFile =
    previewTemplate?.files.find((file) => file.file_path === previewFilePath) ||
    previewTemplate?.files[0] ||
    null;

  const markCopied = (token: string) => {
    setCopiedToken(token);
    window.setTimeout(() => {
      setCopiedToken((current) => (current === token ? '' : current));
    }, 1500);
  };

  const copyText = async (text: string, token: string) => {
    try {
      await navigator.clipboard.writeText(text);
      markCopied(token);
      setErrorMessage('');
    } catch (error) {
      console.error('Clipboard write failed:', error);
      setErrorMessage('Clipboard access failed in this browser context');
    }
  };

  const setAndPersistLocalTemplates = (nextTemplates: TaskTemplatePayload[]) => {
    saveLocalTemplates(nextTemplates);
    setLocalTemplates(nextTemplates);
  };

  const resolveTemplatePayload = async (slug: string): Promise<TaskTemplatePayload> => {
    if (localTemplateMap[slug]) {
      return localTemplateMap[slug];
    }
    return fetchTemplatePayload(slug);
  };

  const handleQuickCreate = async (slug: string) => {
    setCreatingSlug(slug);
    setErrorMessage('');
    setStatusMessage('');

    try {
      const template = await resolveTemplatePayload(slug);
      const body = buildCreateTaskRequest(template);
      const response = await fetch(`${API_BASE}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Failed to create task from template ${slug}`);
      }

      if (!data.task?.id) {
        throw new Error(`Task created from ${slug}, but no task id was returned`);
      }

      router.push(`/task?id=${data.task.id}`);
    } catch (error) {
      console.error('Quick create failed:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Quick create failed');
    } finally {
      setCreatingSlug(null);
    }
  };

  const handleSaveCopy = async (slug: string) => {
    setErrorMessage('');
    setStatusMessage('');

    try {
      const template = await resolveTemplatePayload(slug);
      const nextSlug = ensureUniqueTemplateSlug(`${template.slug}-copy`, [
        ...builtInSlugs,
        ...localTemplates.map((entry) => entry.slug),
      ]);
      const copy: TaskTemplatePayload = {
        ...template,
        slug: nextSlug,
        name: `${template.name} Copy`,
      };
      const nextTemplates = [...localTemplates, copy].sort((left, right) => left.name.localeCompare(right.name));
      setAndPersistLocalTemplates(nextTemplates);
      setStatusMessage(`Saved a local copy of "${template.name}"`);
    } catch (error) {
      console.error('Save copy failed:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Save copy failed');
    }
  };

  const handlePreview = async (slug: string) => {
    setPreviewingSlug(slug);
    setErrorMessage('');
    setStatusMessage('');

    try {
      const template = await resolveTemplatePayload(slug);
      setPreviewTemplate(template);
      setPreviewFilePath(template.files[0]?.file_path || '');
      setShowAllFiles(false);
    } catch (error) {
      console.error('Preview load failed:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Preview load failed');
    } finally {
      setPreviewingSlug(null);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }

    setErrorMessage('');
    setStatusMessage('');

    try {
      const contents = await file.text();
      const imported = normalizeTaskTemplate(JSON.parse(contents));
      const nextSlug = ensureUniqueTemplateSlug(imported.slug, [
        ...builtInSlugs,
        ...localTemplates.map((template) => template.slug),
      ]);
      const nextTemplate = {
        ...imported,
        slug: nextSlug,
      };
      const nextLocalTemplates = [...localTemplates.filter((template) => template.slug !== nextTemplate.slug), nextTemplate]
        .sort((left, right) => left.name.localeCompare(right.name));
      saveLocalTemplates(nextLocalTemplates);
      setLocalTemplates(nextLocalTemplates);
      setStatusMessage(`Imported template "${nextTemplate.name}" into your local library`);
    } catch (error) {
      console.error('Import failed:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Template import failed');
    }
  };

  const handleRemoveLocalTemplate = (slug: string) => {
    const nextTemplates = removeLocalTemplate(slug);
    setLocalTemplates(nextTemplates);
    if (previewTemplate?.slug === slug) {
      closePreview();
    }
    setStatusMessage(`Removed local template "${slug}"`);
    setErrorMessage('');
  };

  const openEditorForLocalTemplate = (slug: string) => {
    const template = localTemplateMap[slug];
    if (!template) {
      setErrorMessage(`Local template "${slug}" was not found`);
      return;
    }

    setEditorDraft({
      originalSlug: template.slug,
      name: template.name,
      slug: template.slug,
      description: template.description,
      category: template.category,
      runtime: template.runtime,
      icon: template.icon,
      highlightsText: template.highlights.join('\n'),
    });
    setShowEditorModal(true);
    setErrorMessage('');
    setStatusMessage('');
  };

  const handleSaveEditedTemplate = () => {
    setEditorSaving(true);
    setErrorMessage('');
    setStatusMessage('');

    try {
      const originalTemplate = localTemplateMap[editorDraft.originalSlug];
      if (!originalTemplate) {
        throw new Error(`Local template "${editorDraft.originalSlug}" was not found`);
      }

      const nextSlug = ensureUniqueTemplateSlug(
        editorDraft.slug || editorDraft.name || originalTemplate.slug,
        [
          ...builtInSlugs,
          ...localTemplates
            .filter((template) => template.slug !== editorDraft.originalSlug)
            .map((template) => template.slug),
        ],
      );

      const updatedTemplate: TaskTemplatePayload = {
        ...originalTemplate,
        slug: nextSlug,
        name: editorDraft.name.trim() || originalTemplate.name,
        description: editorDraft.description.trim(),
        category: editorDraft.category.trim() || 'Custom',
        runtime: editorDraft.runtime.trim() || originalTemplate.runtime,
        icon: editorDraft.icon.trim() || 'terminal',
        highlights: editorDraft.highlightsText
          .split('\n')
          .map((item) => item.trim())
          .filter(Boolean),
      };

      const nextTemplates = [
        ...localTemplates.filter((template) => template.slug !== editorDraft.originalSlug),
        updatedTemplate,
      ].sort((left, right) => left.name.localeCompare(right.name));
      setAndPersistLocalTemplates(nextTemplates);

      if (previewTemplate?.slug === editorDraft.originalSlug) {
        setPreviewTemplate(updatedTemplate);
      }

      setShowEditorModal(false);
      setStatusMessage(`Updated local template "${updatedTemplate.name}"`);
    } catch (error) {
      console.error('Template update failed:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Template update failed');
    } finally {
      setEditorSaving(false);
    }
  };

  const closePreview = () => {
    setPreviewTemplate(null);
    setPreviewFilePath('');
    setShowAllFiles(false);
    setCopiedToken('');
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={handleImportFile}
      />

      {statusMessage && (
        <div className="mb-6 rounded-xl border border-primary/20 bg-primary/5 px-5 py-4 text-sm text-primary">
          {statusMessage}
        </div>
      )}

      {errorMessage && (
        <div className="mb-6 rounded-xl border border-error/20 bg-error/5 px-5 py-4 text-sm text-error">
          {errorMessage}
        </div>
      )}

      <div className="mb-6 rounded-2xl border border-outline-variant/10 bg-surface-container-low p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex-1">
            <label className="mb-2 block text-[10px] font-mono uppercase tracking-[0.2em] text-slate-500">
              Search Templates
            </label>
            <div className="relative">
              <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base text-slate-500">
                search
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search by task name, env var, use case, or keyword"
                className="w-full rounded-xl border border-outline-variant/20 bg-surface-container-lowest py-3 pl-11 pr-4 text-sm text-on-surface outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
          <div className="min-w-56 rounded-xl border border-outline-variant/10 bg-surface-container-lowest px-4 py-3">
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-500">Visible Results</div>
            <div className="mt-2 text-2xl font-headline font-bold text-on-surface">{visibleTemplates.length}</div>
            <div className="text-xs text-slate-500">
              of {mergedTemplates.length} templates
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setActiveCategory(category)}
              className={`rounded-full border px-3 py-1.5 text-[10px] font-mono uppercase tracking-widest transition-colors ${
                activeCategory === category
                  ? 'border-primary/20 bg-primary/10 text-primary'
                  : 'border-outline-variant/10 bg-surface-container-lowest text-slate-400 hover:bg-surface-container-high hover:text-on-surface'
              }`}
            >
              {category}
            </button>
          ))}

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={handleImportClick}
              className="inline-flex items-center gap-2 rounded-lg border border-outline-variant/20 bg-surface-container-lowest px-4 py-2 text-[10px] font-bold tracking-widest text-on-surface hover:bg-surface-container-high transition-colors"
            >
              <span className="material-symbols-outlined text-sm">upload_file</span>
              IMPORT TEMPLATE JSON
            </button>
          </div>
        </div>
      </div>

      {visibleTemplates.length === 0 ? (
        <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-10 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-container-lowest text-slate-500">
            <span className="material-symbols-outlined text-3xl">filter_alt_off</span>
          </div>
          <h2 className="mt-4 text-2xl font-headline font-bold text-on-surface">No matching templates</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-slate-400">
            Try a different keyword, switch back to another category, import a saved template bundle, or start from a blank task.
          </p>
          <div className="mt-5 flex items-center justify-center gap-3">
            <button
              onClick={() => {
                setSearchQuery('');
                setActiveCategory('All');
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-outline-variant/20 bg-surface-container-lowest px-4 py-2 text-xs font-bold tracking-widest text-on-surface hover:bg-surface-container-high transition-colors"
            >
              <span className="material-symbols-outlined text-base">restart_alt</span>
              CLEAR FILTERS
            </button>
            <button
              onClick={handleImportClick}
              className="inline-flex items-center gap-2 rounded-lg border border-outline-variant/20 bg-surface-container-lowest px-4 py-2 text-xs font-bold tracking-widest text-on-surface hover:bg-surface-container-high transition-colors"
            >
              <span className="material-symbols-outlined text-base">upload_file</span>
              IMPORT TEMPLATE
            </button>
            <Link
              href="/tasks/new"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-bold tracking-widest text-on-primary shadow-lg shadow-primary/20 hover:opacity-90 transition-opacity"
            >
              <span className="material-symbols-outlined text-base">edit_square</span>
              BLANK TASK
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {visibleTemplates.map((template) => (
            <section
              key={`${template.source}:${template.slug}`}
              className="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-6 shadow-sm transition-colors hover:bg-surface-container-high/70"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <span className="material-symbols-outlined text-2xl">{template.icon}</span>
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[10px] font-mono uppercase tracking-widest text-primary">
                        {template.category}
                      </span>
                      <span className="rounded-full border border-outline-variant/20 bg-surface-container-lowest px-2.5 py-1 text-[10px] font-mono uppercase tracking-widest text-slate-400">
                        {template.runtime}
                      </span>
                      <span className={`rounded-full border px-2.5 py-1 text-[10px] font-mono uppercase tracking-widest ${template.source === 'local' ? 'border-tertiary/20 bg-tertiary/10 text-tertiary' : 'border-outline-variant/20 bg-surface-container-lowest text-slate-500'}`}>
                        {template.source === 'local' ? 'Local Library' : 'Built-in'}
                      </span>
                    </div>
                    <h2 className="mt-3 text-2xl font-headline font-bold text-on-surface">{template.name}</h2>
                    <p className="mt-2 text-sm text-slate-400">{template.description}</p>
                  </div>
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-3">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500">Schedule</div>
                  <code className="mt-2 block text-xs font-mono text-tertiary">{formatSchedule(template.schedule)}</code>
                </div>
                <div className="rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-3">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500">Files</div>
                  <div className="mt-2 text-sm font-bold text-on-surface">{template.fileCount}</div>
                </div>
                <div className="rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-3">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500">Env Vars</div>
                  <div className="mt-2 text-sm font-bold text-on-surface">{template.envVarNames.length}</div>
                </div>
              </div>

              <div className="mt-5 space-y-2">
                {template.highlights.map((highlight) => (
                  <div key={highlight} className="flex items-start gap-2 text-sm text-slate-300">
                    <span className="material-symbols-outlined mt-0.5 text-base text-primary">subdirectory_arrow_right</span>
                    <span>{highlight}</span>
                  </div>
                ))}
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {template.envVarNames.map((envVar) => (
                  <code
                    key={envVar}
                    className="rounded-md border border-outline-variant/10 bg-surface-container-lowest px-2 py-1 text-[10px] font-mono text-slate-400"
                  >
                    {envVar}
                  </code>
                ))}
              </div>

              <div className="mt-6 flex flex-col gap-4 border-t border-outline-variant/10 pt-5 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0 text-xs text-slate-500">
                  Slug: <code className="font-mono text-slate-400">{template.slug}</code>
                </div>
                <div className="flex flex-wrap items-center gap-3 md:justify-end">
                  {template.source === 'built-in' && (
                    <button
                      onClick={() => handleSaveCopy(template.slug)}
                      className="inline-flex items-center gap-2 rounded-lg border border-outline-variant/20 bg-surface-container-lowest px-4 py-2 text-xs font-bold tracking-widest text-on-surface hover:bg-surface-container-high transition-colors"
                    >
                      <span className="material-symbols-outlined text-base">library_add</span>
                      SAVE COPY
                    </button>
                  )}
                  {template.source === 'local' && (
                    <>
                      <button
                        onClick={() => openEditorForLocalTemplate(template.slug)}
                        className="inline-flex items-center gap-2 rounded-lg border border-outline-variant/20 bg-surface-container-lowest px-4 py-2 text-xs font-bold tracking-widest text-on-surface hover:bg-surface-container-high transition-colors"
                      >
                        <span className="material-symbols-outlined text-base">edit</span>
                        EDIT
                      </button>
                      <button
                        onClick={() => handleRemoveLocalTemplate(template.slug)}
                        className="inline-flex items-center gap-2 rounded-lg border border-error/20 bg-error/5 px-4 py-2 text-xs font-bold tracking-widest text-error hover:bg-error/10 transition-colors"
                      >
                        <span className="material-symbols-outlined text-base">delete</span>
                        REMOVE
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => handlePreview(template.slug)}
                    disabled={previewingSlug !== null}
                    className="inline-flex items-center gap-2 rounded-lg border border-outline-variant/20 bg-surface-container-lowest px-4 py-2 text-xs font-bold tracking-widest text-on-surface hover:bg-surface-container-high disabled:opacity-50 transition-colors"
                  >
                    <span className="material-symbols-outlined text-base">visibility</span>
                    {previewingSlug === template.slug ? 'LOADING...' : 'PREVIEW'}
                  </button>
                  <button
                    onClick={() => handleQuickCreate(template.slug)}
                    disabled={creatingSlug !== null || previewingSlug !== null}
                    className="inline-flex items-center gap-2 rounded-lg border border-outline-variant/20 bg-surface-container-lowest px-4 py-2 text-xs font-bold tracking-widest text-on-surface hover:bg-surface-container-high disabled:opacity-50 transition-colors"
                  >
                    <span className="material-symbols-outlined text-base">flash_on</span>
                    {creatingSlug === template.slug ? 'CREATING...' : 'QUICK CREATE'}
                  </button>
                  <Link
                    href={`/tasks/new?template=${template.slug}`}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-bold tracking-widest text-on-primary shadow-lg shadow-primary/20 hover:opacity-90 transition-opacity"
                  >
                    <span className="material-symbols-outlined text-base">rocket_launch</span>
                    CUSTOMIZE
                  </Link>
                </div>
              </div>
            </section>
          ))}
        </div>
      )}

      {previewTemplate && (
        <div className="fixed inset-0 z-50 flex items-stretch justify-end bg-slate-950/70 backdrop-blur-sm">
          <div className="flex h-full w-full max-w-5xl flex-col border-l border-outline-variant/10 bg-[#0b1326] shadow-2xl shadow-black/40">
            <div className="flex items-start justify-between gap-4 border-b border-outline-variant/10 px-6 py-5">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[10px] font-mono uppercase tracking-widest text-primary">
                    {previewTemplate.category}
                  </span>
                  <span className="rounded-full border border-outline-variant/20 bg-surface-container-lowest px-2.5 py-1 text-[10px] font-mono uppercase tracking-widest text-slate-400">
                    {previewTemplate.runtime}
                  </span>
                  <span className="rounded-full border border-outline-variant/20 bg-surface-container-lowest px-2.5 py-1 text-[10px] font-mono uppercase tracking-widest text-slate-400">
                    {previewTemplate.files.length} files
                  </span>
                  {localTemplateMap[previewTemplate.slug] && (
                    <span className="rounded-full border border-tertiary/20 bg-tertiary/10 px-2.5 py-1 text-[10px] font-mono uppercase tracking-widest text-tertiary">
                      Local Library
                    </span>
                  )}
                </div>
                <h2 className="mt-3 text-3xl font-headline font-bold text-on-surface">{previewTemplate.name}</h2>
                <p className="mt-2 max-w-2xl text-sm text-slate-400">{previewTemplate.description}</p>
              </div>
              <button
                onClick={closePreview}
                className="inline-flex items-center gap-2 rounded-lg border border-outline-variant/20 bg-surface-container-low px-3 py-2 text-xs font-bold tracking-widest text-on-surface hover:bg-surface-container-high transition-colors"
              >
                <span className="material-symbols-outlined text-base">close</span>
                CLOSE
              </button>
            </div>

            <div className="grid flex-1 grid-cols-1 gap-0 lg:grid-cols-[280px_minmax(0,1fr)]">
              <div className="border-b border-outline-variant/10 bg-surface-container-low/40 lg:border-b-0 lg:border-r">
                <div className="space-y-5 p-5">
                  <div className="rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-4">
                    <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-500">Default Schedule</div>
                    <code className="mt-2 block text-xs font-mono text-tertiary">{formatSchedule(previewTemplate.schedule)}</code>
                  </div>

                  <div className="rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-4">
                    <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-500">Entrypoint</div>
                    <code className="mt-2 block text-xs font-mono text-tertiary">{previewTemplate.entrypoint}</code>
                  </div>

                  <div>
                    <div className="mb-2 text-[10px] font-mono uppercase tracking-[0.2em] text-slate-500">Files</div>
                    <div className="space-y-1">
                      {previewTemplate.files.map((file) => (
                        <button
                          key={file.file_path}
                          onClick={() => setPreviewFilePath(file.file_path)}
                          className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs transition-colors ${
                            previewFile?.file_path === file.file_path
                              ? 'bg-primary/10 text-primary'
                              : 'bg-surface-container-lowest text-slate-300 hover:bg-surface-container-high'
                          }`}
                        >
                          <span className="material-symbols-outlined text-sm">{getFileIcon(file.file_path)}</span>
                          <span className="truncate font-mono">{file.file_path}</span>
                          {file.file_path === previewTemplate.entrypoint && (
                            <span className="material-symbols-outlined ml-auto text-[12px]">play_arrow</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 text-[10px] font-mono uppercase tracking-[0.2em] text-slate-500">Environment Variables</div>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(previewTemplate.env_vars).map(([key, value]) => (
                        <div
                          key={key}
                          className="min-w-0 rounded-lg border border-outline-variant/10 bg-surface-container-lowest px-3 py-2"
                        >
                          <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500">{key}</div>
                          <div className="mt-1 max-w-52 truncate font-mono text-xs text-slate-300">{value || '(empty)'}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex min-h-0 flex-col">
                <div className="border-b border-outline-variant/10 bg-surface-container-low/60 px-5 py-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-primary">{previewFile ? getFileIcon(previewFile.file_path) : 'draft'}</span>
                      <div>
                        <div className="text-sm font-bold text-on-surface">{previewFile?.file_path || 'No file selected'}</div>
                        <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
                          {previewFile?.file_path === previewTemplate.entrypoint ? 'Entrypoint file' : 'Template file'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {!localTemplateMap[previewTemplate.slug] && (
                        <button
                          onClick={() => handleSaveCopy(previewTemplate.slug)}
                          className="inline-flex items-center gap-2 rounded-lg border border-outline-variant/20 bg-surface-container-lowest px-4 py-2 text-xs font-bold tracking-widest text-on-surface hover:bg-surface-container-high transition-colors"
                        >
                          <span className="material-symbols-outlined text-base">library_add</span>
                          SAVE COPY
                        </button>
                      )}
                      {localTemplateMap[previewTemplate.slug] && (
                        <button
                          onClick={() => openEditorForLocalTemplate(previewTemplate.slug)}
                          className="inline-flex items-center gap-2 rounded-lg border border-outline-variant/20 bg-surface-container-lowest px-4 py-2 text-xs font-bold tracking-widest text-on-surface hover:bg-surface-container-high transition-colors"
                        >
                          <span className="material-symbols-outlined text-base">edit</span>
                          EDIT META
                        </button>
                      )}
                      <button
                        onClick={() => setShowAllFiles((current) => !current)}
                        className="inline-flex items-center gap-2 rounded-lg border border-outline-variant/20 bg-surface-container-lowest px-4 py-2 text-xs font-bold tracking-widest text-on-surface hover:bg-surface-container-high transition-colors"
                      >
                        <span className="material-symbols-outlined text-base">{showAllFiles ? 'article_shortcut' : 'docs'}</span>
                        {showAllFiles ? 'SINGLE FILE' : 'SHOW ALL FILES'}
                      </button>
                      <button
                        onClick={() => downloadTemplateBundle(previewTemplate)}
                        className="inline-flex items-center gap-2 rounded-lg border border-outline-variant/20 bg-surface-container-lowest px-4 py-2 text-xs font-bold tracking-widest text-on-surface hover:bg-surface-container-high transition-colors"
                      >
                        <span className="material-symbols-outlined text-base">download</span>
                        EXPORT JSON
                      </button>
                      <button
                        onClick={() => handleQuickCreate(previewTemplate.slug)}
                        disabled={creatingSlug !== null}
                        className="inline-flex items-center gap-2 rounded-lg border border-outline-variant/20 bg-surface-container-lowest px-4 py-2 text-xs font-bold tracking-widest text-on-surface hover:bg-surface-container-high disabled:opacity-50 transition-colors"
                      >
                        <span className="material-symbols-outlined text-base">flash_on</span>
                        {creatingSlug === previewTemplate.slug ? 'CREATING...' : 'QUICK CREATE'}
                      </button>
                      <Link
                        href={`/tasks/new?template=${previewTemplate.slug}`}
                        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-bold tracking-widest text-on-primary shadow-lg shadow-primary/20 hover:opacity-90 transition-opacity"
                      >
                        <span className="material-symbols-outlined text-base">rocket_launch</span>
                        CUSTOMIZE
                      </Link>
                    </div>
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-auto bg-surface-container-lowest">
                  <div className="border-b border-outline-variant/10 bg-surface-container-low/40 px-5 py-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        onClick={() => copyText(JSON.stringify(previewTemplate.env_vars, null, 2), 'env-json')}
                        className="inline-flex items-center gap-2 rounded-lg border border-outline-variant/20 bg-surface-container-lowest px-3 py-2 text-[10px] font-bold tracking-widest text-on-surface hover:bg-surface-container-high transition-colors"
                      >
                        <span className="material-symbols-outlined text-sm">content_copy</span>
                        {copiedToken === 'env-json' ? 'COPIED ENV JSON' : 'COPY ENV JSON'}
                      </button>
                      <button
                        onClick={() => copyText(Object.keys(previewTemplate.env_vars).join('\n'), 'env-keys')}
                        className="inline-flex items-center gap-2 rounded-lg border border-outline-variant/20 bg-surface-container-lowest px-3 py-2 text-[10px] font-bold tracking-widest text-on-surface hover:bg-surface-container-high transition-colors"
                      >
                        <span className="material-symbols-outlined text-sm">key</span>
                        {copiedToken === 'env-keys' ? 'COPIED ENV KEYS' : 'COPY ENV KEYS'}
                      </button>
                      {!showAllFiles && previewFile && (
                        <button
                          onClick={() => copyText(previewFile.content, `file:${previewFile.file_path}`)}
                          className="inline-flex items-center gap-2 rounded-lg border border-outline-variant/20 bg-surface-container-lowest px-3 py-2 text-[10px] font-bold tracking-widest text-on-surface hover:bg-surface-container-high transition-colors"
                        >
                          <span className="material-symbols-outlined text-sm">description</span>
                          {copiedToken === `file:${previewFile.file_path}` ? 'COPIED FILE' : 'COPY FILE'}
                        </button>
                      )}
                    </div>
                  </div>

                  {showAllFiles ? (
                    <div className="space-y-6 p-5">
                      {previewTemplate.files.map((file) => (
                        <section
                          key={file.file_path}
                          className="overflow-hidden rounded-2xl border border-outline-variant/10 bg-surface-container-low/30"
                        >
                          <div className="flex items-center justify-between gap-3 border-b border-outline-variant/10 bg-surface-container-low/50 px-4 py-3">
                            <div className="flex items-center gap-3">
                              <span className="material-symbols-outlined text-primary">{getFileIcon(file.file_path)}</span>
                              <div>
                                <div className="text-sm font-bold text-on-surface">{file.file_path}</div>
                                <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
                                  {file.file_path === previewTemplate.entrypoint ? 'Entrypoint file' : 'Template file'}
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={() => copyText(file.content, `file:${file.file_path}`)}
                              className="inline-flex items-center gap-2 rounded-lg border border-outline-variant/20 bg-surface-container-lowest px-3 py-2 text-[10px] font-bold tracking-widest text-on-surface hover:bg-surface-container-high transition-colors"
                            >
                              <span className="material-symbols-outlined text-sm">content_copy</span>
                              {copiedToken === `file:${file.file_path}` ? 'COPIED' : 'COPY'}
                            </button>
                          </div>
                          <pre className="overflow-auto whitespace-pre-wrap p-4 font-mono text-[13px] leading-relaxed text-slate-200">
                            {file.content}
                          </pre>
                        </section>
                      ))}
                    </div>
                  ) : (
                    <pre className="min-h-full whitespace-pre-wrap p-5 font-mono text-[13px] leading-relaxed text-slate-200">
                      {previewFile?.content || ''}
                    </pre>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showEditorModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-6">
          <div className="w-full max-w-3xl rounded-2xl border border-outline-variant/10 bg-[#0b1326] shadow-2xl shadow-black/40">
            <div className="flex items-start justify-between gap-4 border-b border-outline-variant/10 px-6 py-5">
              <div>
                <h2 className="text-2xl font-headline font-bold text-on-surface">Edit Local Template</h2>
                <p className="mt-2 text-sm text-slate-400">
                  Update local template metadata without touching the stored files, schedule, or environment variables.
                </p>
              </div>
              <button
                onClick={() => setShowEditorModal(false)}
                className="inline-flex items-center gap-2 rounded-lg border border-outline-variant/20 bg-surface-container-low px-3 py-2 text-xs font-bold tracking-widest text-on-surface hover:bg-surface-container-high transition-colors"
              >
                <span className="material-symbols-outlined text-base">close</span>
                CLOSE
              </button>
            </div>

            <div className="grid gap-4 px-6 py-5 md:grid-cols-2">
              <div>
                <label className="mb-1.5 ml-1 block text-xs font-medium text-slate-400">Template Name</label>
                <input
                  className="w-full rounded-lg border border-outline-variant/20 bg-surface-container-lowest px-4 py-2.5 text-sm text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  type="text"
                  value={editorDraft.name}
                  onChange={(event) => setEditorDraft((current) => ({ ...current, name: event.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1.5 ml-1 block text-xs font-medium text-slate-400">Slug</label>
                <input
                  className="w-full rounded-lg border border-outline-variant/20 bg-surface-container-lowest px-4 py-2.5 font-mono text-sm text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  type="text"
                  value={editorDraft.slug}
                  onChange={(event) => setEditorDraft((current) => ({ ...current, slug: event.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1.5 ml-1 block text-xs font-medium text-slate-400">Category</label>
                <input
                  className="w-full rounded-lg border border-outline-variant/20 bg-surface-container-lowest px-4 py-2.5 text-sm text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  type="text"
                  value={editorDraft.category}
                  onChange={(event) => setEditorDraft((current) => ({ ...current, category: event.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1.5 ml-1 block text-xs font-medium text-slate-400">Runtime Label</label>
                <input
                  className="w-full rounded-lg border border-outline-variant/20 bg-surface-container-lowest px-4 py-2.5 text-sm text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  type="text"
                  value={editorDraft.runtime}
                  onChange={(event) => setEditorDraft((current) => ({ ...current, runtime: event.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1.5 ml-1 block text-xs font-medium text-slate-400">Icon</label>
                <input
                  className="w-full rounded-lg border border-outline-variant/20 bg-surface-container-lowest px-4 py-2.5 text-sm text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  type="text"
                  value={editorDraft.icon}
                  onChange={(event) => setEditorDraft((current) => ({ ...current, icon: event.target.value }))}
                />
              </div>
              <div className="rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-4">
                <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-500">Current Template</div>
                <div className="mt-2 text-sm font-mono text-tertiary">{editorDraft.originalSlug}</div>
              </div>
              <div className="md:col-span-2">
                <label className="mb-1.5 ml-1 block text-xs font-medium text-slate-400">Description</label>
                <textarea
                  className="w-full rounded-lg border border-outline-variant/20 bg-surface-container-lowest px-4 py-2.5 text-sm text-on-surface outline-none resize-none focus:border-primary focus:ring-1 focus:ring-primary"
                  rows={3}
                  value={editorDraft.description}
                  onChange={(event) => setEditorDraft((current) => ({ ...current, description: event.target.value }))}
                />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1.5 ml-1 block text-xs font-medium text-slate-400">Highlights</label>
                <textarea
                  className="w-full rounded-lg border border-outline-variant/20 bg-surface-container-lowest px-4 py-2.5 text-sm text-on-surface outline-none resize-none focus:border-primary focus:ring-1 focus:ring-primary"
                  rows={5}
                  value={editorDraft.highlightsText}
                  onChange={(event) => setEditorDraft((current) => ({ ...current, highlightsText: event.target.value }))}
                  placeholder="One highlight per line"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-outline-variant/10 px-6 py-5">
              <button
                onClick={() => setShowEditorModal(false)}
                className="inline-flex items-center gap-2 rounded-lg border border-outline-variant/20 bg-surface-container-lowest px-4 py-2 text-xs font-bold tracking-widest text-on-surface hover:bg-surface-container-high transition-colors"
              >
                CANCEL
              </button>
              <button
                onClick={handleSaveEditedTemplate}
                disabled={editorSaving}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-bold tracking-widest text-on-primary shadow-lg shadow-primary/20 hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-base">save</span>
                {editorSaving ? 'SAVING...' : 'SAVE CHANGES'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
