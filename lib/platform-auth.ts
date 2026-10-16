import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { compare } from 'bcryptjs';

const SESSION_COOKIE = 'platform_ops_session';
const DEVICE_COOKIE = 'platform_ops_device';
const SESSION_SECONDS = 60 * 60 * 12;
const LOCK_SECONDS = 60 * 60;
const attempts = new Map<string, { count: number; blockedUntil?: number }>();

function secret() { return process.env.PLATFORM_AUTH_SECRET || ''; }
function signature(value: string) { return createHmac('sha256', secret()).update(value).digest('base64url'); }
function cookie(request: Request, name: string) {
  return request.headers.get('cookie')?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1) || '';
}
function equal(a: string, b: string) {
  const left = Buffer.from(a); const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
function keys(request: Request, device: string) {
  const ip = request.headers.get('x-real-ip')?.trim() || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  return [`ip:${ip}`, ...(device ? [`device:${device}`] : [])];
}
function secure(request: Request) { return new URL(request.url).protocol === 'https:' ? '; Secure' : ''; }

export function isPlatformAdmin(request: Request) {
  if (!secret()) return false;
  const parts = cookie(request, SESSION_COOKIE).split('.');
  const device = cookie(request, DEVICE_COOKIE);
  if (parts.length !== 3 || !device) return false;
  const [expiresText, sessionDevice, supplied] = parts;
  const expires = Number(expiresText);
  if (!Number.isSafeInteger(expires) || expires <= Date.now() / 1000 || expires > Date.now() / 1000 + SESSION_SECONDS + 60 || sessionDevice !== device) return false;
  return equal(supplied, signature(`${expiresText}.${sessionDevice}`));
}

export async function loginPlatformAdmin(request: Request, password: unknown) {
  const encodedHash = process.env.PLATFORM_ADMIN_PASSWORD_HASH_B64 || '';
  const hash = encodedHash ? Buffer.from(encodedHash, 'base64').toString('utf8') : '';
  if (!/^\$2[aby]\$\d\d\$/.test(hash) || !secret()) return { ok: false as const, configurationMissing: true as const };
  const device = cookie(request, DEVICE_COOKIE);
  const lockKeys = keys(request, device);
  const now = Date.now();
  const locked = lockKeys.map((key) => attempts.get(key)).find((state) => state?.blockedUntil && state.blockedUntil > now);
  if (locked) return { ok: false as const, blockedForSeconds: Math.ceil(((locked.blockedUntil || now) - now) / 1000) };
  const valid = typeof password === 'string' && password.length === 32 && await compare(password, hash).catch(() => false);
  if (valid) {
    lockKeys.forEach((key) => attempts.delete(key));
    const currentDevice = device || randomBytes(24).toString('base64url');
    const expires = Math.floor(now / 1000) + SESSION_SECONDS;
    const payload = `${expires}.${currentDevice}`;
    return {
      ok: true as const,
      headers: [
        `${DEVICE_COOKIE}=${currentDevice}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_SECONDS}${secure(request)}`,
        `${SESSION_COOKIE}=${payload}.${signature(payload)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_SECONDS}${secure(request)}`,
      ],
    };
  }
  const count = Math.max(...lockKeys.map((key) => attempts.get(key)?.count || 0)) + 1;
  lockKeys.forEach((key) => attempts.set(key, count >= 3 ? { count, blockedUntil: now + LOCK_SECONDS } : { count }));
  return count >= 3 ? { ok: false as const, blockedForSeconds: LOCK_SECONDS } : { ok: false as const, attemptsLeft: 3 - count };
}

export function clearPlatformAdminCookies(request: Request) {
  const suffix = `; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure(request)}`;
  return [`${SESSION_COOKIE}=${suffix}`, `${DEVICE_COOKIE}=${suffix}`];
}
