import { NextResponse } from 'next/server';
import { clearPlatformAdminCookies, isPlatformAdmin, loginPlatformAdmin } from '@/lib/platform-auth';
import { json } from '@/lib/server';

export async function GET(request: Request) {
  return json({ authenticated: isPlatformAdmin(request) });
}

function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  return !origin || origin === (process.env.APP_ORIGIN || new URL(request.url).origin);
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error: 'Недопустимый источник запроса' }, 403);
  if (Number(request.headers.get('content-length') || 0) > 4096) return json({ error: 'Слишком большой запрос' }, 413);
  let body: { password?: unknown };
  try { body = await request.json(); } catch { return json({ error: 'Некорректный запрос' }, 400); }
  const result = await loginPlatformAdmin(request, body.password);
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
  if (!sameOrigin(request)) return json({ error: 'Недопустимый источник запроса' }, 403);
  const response = NextResponse.json({ authenticated: false }, { headers: { 'Cache-Control': 'no-store' } });
  clearPlatformAdminCookies(request).forEach((value) => response.headers.append('Set-Cookie', value));
  return response;
}
