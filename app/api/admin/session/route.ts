import { NextResponse } from 'next/server';
import { authenticateAdmin, clearAdminCookies, clientIp, issueAdminCookies, issueDeviceCookie, isTrustedAdmin } from '@/lib/admin-auth';
import { json } from '@/lib/server';
import { sendAdminTelegramAlert } from '@/lib/notifications';

export async function GET(request: Request) {
  const trusted = isTrustedAdmin(request);
  return json({ authenticated: trusted });
}

export async function POST(request: Request) {
  let body: { password?: unknown };
  try { body = await request.json(); } catch { return json({ error: 'Некорректный запрос' }, 400); }
  const result = await authenticateAdmin(request, body.password);
  if (!result.ok) {
    if ('configurationMissing' in result) return json({ error: 'Админ-вход не настроен: задайте AUTH_SECRET и ADMIN_PASSWORD_HASH' }, 503);
    if ('lockTriggered' in result) {
      const blockedAt = new Date().toISOString();
      try {
        await sendAdminTelegramAlert(`⚠️ Блокировка входа в админку\nВремя: ${blockedAt}\nIP: ${clientIp(request)}\nНеверных попыток: ${result.failedAttempts}\nБлокировка: 1 час`);
      } catch {
        console.warn('[admin-security] Failed to send Telegram lock alert');
      }
    }
    const response = NextResponse.json('blockedForSeconds' in result ? { error: 'Вход временно заблокирован', blockedForSeconds: result.blockedForSeconds } : { error: 'Неверный пароль', attemptsLeft: result.attemptsLeft }, { status: 'blockedForSeconds' in result ? 429 : 401, headers: { 'Cache-Control': 'no-store' } });
    if (!request.headers.get('cookie')?.includes('store_admin_device=')) response.headers.append('Set-Cookie', issueDeviceCookie(request));
    return response;
  }
  const issued = issueAdminCookies(request);
  const response = NextResponse.json({ authenticated: true });
  issued.headers.forEach((value) => response.headers.append('Set-Cookie', value));
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export async function DELETE(request: Request) {
  const response = NextResponse.json({ authenticated: false });
  clearAdminCookies(request).forEach((value) => response.headers.append('Set-Cookie', value));
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
