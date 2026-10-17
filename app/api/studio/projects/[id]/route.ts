import { isPlatformAdmin } from '@/lib/platform-auth';
import { isPresetKey, getStudioProject, sanitizeStudioConfig, startStudioReview } from '@/lib/studio-projects';
import { presets } from '@/lib/shinslot';
import { json } from '@/lib/server';

const colorPattern = /^#[\da-f]{3}(?:[\da-f]{3})?$/i;
function validImageUrl(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 2000 && (value.startsWith('/') || /^https:\/\//i.test(value));
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isPlatformAdmin(request)) return json({ error: 'Доступ запрещён' }, 401);
  const { id } = await context.params;
  const originalProject = getStudioProject(id);
  if (!originalProject) return json({ error: 'Проект не найден' }, 404);
  const project = { ...originalProject, references: [...originalProject.references], config: structuredClone(originalProject.config) };
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return json({ error: 'Некорректный запрос' }, 400);

  if (body.templateKey !== undefined) {
    if (!isPresetKey(body.templateKey)) return json({ error: 'Выберите шаблон из списка' }, 400);
    if (body.templateKey !== project.templateKey) {
      project.templateKey = body.templateKey;
      project.config = structuredClone(presets[body.templateKey]);
    }
  }

  if (body.clientName !== undefined) {
    if (typeof body.clientName !== 'string' || body.clientName.trim().length < 2 || body.clientName.length > 140) return json({ error: 'Проверьте имя клиента' }, 400);
    project.clientName = body.clientName.trim();
  }
  if (body.clientEmail !== undefined) {
    if (typeof body.clientEmail !== 'string' || (body.clientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.clientEmail)) || body.clientEmail.length > 180) return json({ error: 'Проверьте почту клиента' }, 400);
    project.clientEmail = body.clientEmail.trim();
  }
  if (body.references !== undefined) {
    if (!Array.isArray(body.references) || body.references.length > 10 || body.references.some((item) => typeof item !== 'string' || item.length > 500 || !/^https?:\/\//i.test(item))) return json({ error: 'Добавьте до 10 ссылок с http или https' }, 400);
    project.references = [...new Set((body.references as string[]).map((item) => new URL(item).toString()))];
  }
  if (body.config !== undefined) {
    if (!body.config || typeof body.config !== 'object' || Array.isArray(body.config)) return json({ error: 'Проверьте настройки сайта' }, 400);
    const changes = body.config as Record<string, unknown>;
    const next = { ...project.config };
    for (const key of ['name', 'tagline', 'aboutText', 'phone', 'email'] as const) {
      const value = changes[key];
      if (value !== undefined) {
        const max = key === 'aboutText' ? 4000 : key === 'email' ? 180 : 240;
        if (typeof value !== 'string' || value.length > max) return json({ error: 'Проверьте тексты и контакты сайта' }, 400);
        (next as unknown as Record<string, unknown>)[key] = value.trim();
      }
    }
    if (changes.heroUrl !== undefined) {
      if (!validImageUrl(changes.heroUrl)) return json({ error: 'Для изображения используйте HTTPS или локальный путь' }, 400);
      next.heroUrl = changes.heroUrl;
    }
    if (changes.accentColor !== undefined) {
      if (typeof changes.accentColor !== 'string' || !colorPattern.test(changes.accentColor)) return json({ error: 'Цвет должен быть в HEX-формате' }, 400);
      next.accentColor = changes.accentColor;
    }
    project.config = next;
  }

  let reviewToken: string | null = null;
  if (body.action === 'send_for_approval') reviewToken = startStudioReview(project);
  else {
    if (body.action !== undefined) return json({ error: 'Неизвестное действие' }, 400);
    // Editing a submitted or approved version revokes its old client link until it is resubmitted.
    if (project.status !== 'draft') project.reviewToken = null;
    project.status = 'draft';
    project.updatedAt = new Date().toISOString();
  }
  Object.assign(originalProject, project);
  return json({ project: { ...project, config: sanitizeStudioConfig(project.config) }, reviewToken });
}
