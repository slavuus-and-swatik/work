import { isPlatformAdmin } from '@/lib/platform-auth';
import { isPresetKey, listStudioProjects, createStudioProject, sanitizeStudioConfig } from '@/lib/studio-projects';
import { json } from '@/lib/server';

function cleanReferences(value: unknown) {
  if (!Array.isArray(value) || value.length > 10) return null;
  const urls: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string' || item.length > 500) return null;
    try {
      const url = new URL(item);
      if (!['http:', 'https:'].includes(url.protocol)) return null;
      urls.push(url.toString());
    } catch { return null; }
  }
  return [...new Set(urls)];
}

function serialize(project: ReturnType<typeof listStudioProjects>[number]) {
  return { ...project, config: sanitizeStudioConfig(project.config) };
}

export async function GET(request: Request) {
  if (!isPlatformAdmin(request)) return json({ error: 'Доступ запрещён' }, 401);
  return json({ projects: listStudioProjects().map(serialize) });
}

export async function POST(request: Request) {
  if (!isPlatformAdmin(request)) return json({ error: 'Доступ запрещён' }, 401);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const clientName = typeof body?.clientName === 'string' ? body.clientName.trim() : '';
  const clientEmail = typeof body?.clientEmail === 'string' ? body.clientEmail.trim() : '';
  const references = cleanReferences(body?.references);
  if (clientName.length < 2 || clientName.length > 140 || (clientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail)) || !references || !isPresetKey(body?.templateKey)) {
    return json({ error: 'Укажите имя клиента, корректную почту, ссылки-референсы и шаблон' }, 400);
  }
  const project = createStudioProject({ clientName, clientEmail, references, templateKey: body.templateKey });
  return json({ project: serialize(project) }, 201);
}
