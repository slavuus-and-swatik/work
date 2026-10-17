import { isPlatformAdmin } from '@/lib/platform-auth';
import { json, platformOverview } from '@/lib/server';

export async function GET(request: Request) {
  if (!isPlatformAdmin(request)) return json({ error: 'Доступ запрещён' }, 401);
  return json(await platformOverview());
}
