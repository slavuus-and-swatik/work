import { NextResponse } from 'next/server';
import { clearPlatformAdminCookies, isPlatformAdmin, loginPlatformAdmin } from '@/lib/platform-auth';
import { json } from '@/lib/server';
import { readJson, JsonRequestError } from '@/lib/read-json';


export async function GET(request: Request) {
  return json({ authenticated: isPlatformAdmin(request) });
}

export async function POST(request: Request) {
  let body: unknown;
  try { body = await readJson<unknown>(request, 4 * 1024); }
  catch (error) {
    if (error instanceof JsonRequestError) return json({ error: error.message }, error.status);
    return json({ error: 'Некорректный запрос' }, 400);
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: 'Некорректный запрос' }, 400);
  const result = await loginPlatformAdmin(request, (body as { password?: unknown }).password);
  if (!result.ok) {
    if ('configurationMissing' in result) return json({ error: 'Вход оператора не настроен: задайте PLATFORM_AUTH_SECRET и PLATFORM_ADMIN_PASSWORD_HASH_B64' }, 503);
    return NextResponse.json(
      'blockedForSeconds' in result
        ? { error: 'Вход временно заблокирован', blockedForSeconds: result.blockedForSeconds }
        : { error: 'Неверный пароль', attemptsLeft: result.attemptsLeft },
      { status: 'blockedForSeconds' in result ? 429 : 401, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  const response = NextResponse.json({ authenticated: true }, { headers: { 'Cache-Control': 'no-store' } });
  result.headers.forEach((value) => response.headers.append('Set-Cookie', value));
  return response;
}

export async function DELETE(request: Request) {
  const response = NextResponse.json({ authenticated: false }, { headers: { 'Cache-Control': 'no-store' } });
  clearPlatformAdminCookies(request).forEach((value) => response.headers.append('Set-Cookie', value));
  return response;
}
