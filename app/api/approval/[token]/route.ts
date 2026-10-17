import { getStudioProjectByToken, sanitizeStudioConfig } from '@/lib/studio-projects';
import { json } from '@/lib/server';

function publicView(project: NonNullable<ReturnType<typeof getStudioProjectByToken>>) {
  return {
    clientName: project.clientName,
    references: project.references,
    status: project.status,
    reviewComment: project.reviewComment,
    config: sanitizeStudioConfig(project.config),
    templateName: project.config.nicheLabel,
  };
}

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const project = getStudioProjectByToken(token);
  if (!project) return json({ error: 'Ссылка для согласования недействительна' }, 404);
  return json({ project: publicView(project) });
}

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const project = getStudioProjectByToken(token);
  if (!project) return json({ error: 'Ссылка для согласования недействительна' }, 404);
  if (project.status !== 'review') return json({ error: 'Этот вариант уже рассмотрен или снят с согласования' }, 409);
  const body = await request.json().catch(() => null) as { decision?: unknown; comment?: unknown } | null;
  const comment = typeof body?.comment === 'string' ? body.comment.trim() : '';
  if (comment.length > 2000 || !['approved', 'revision_requested'].includes(String(body?.decision))) return json({ error: 'Проверьте ответ' }, 400);
  project.status = body?.decision as 'approved' | 'revision_requested';
  project.reviewComment = comment;
  project.updatedAt = new Date().toISOString();
  return json({ project: publicView(project) });
}
