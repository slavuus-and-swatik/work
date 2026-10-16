import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { compare } from 'bcryptjs';

export const ADMIN_COOKIE = 'store_admin_session';
export const DEVICE_COOKIE = 'store_admin_device';
const SESSION_SECONDS = 60 * 60 * 12;
const LOCK_SECONDS = 60 * 60;
const attempts = new Map<string, { count: number; blockedUntil?: number }>();

function secret() { return process.env.AUTH_SECRET || ''; }
function signature(value: string) { return createHmac('sha256', secret()).update(value).digest('base64url'); }
function cookie(request: Request, name: string) {
  return request.headers.get('cookie')?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1) || '';
}
function secureEqual(a: string, b: string) {
  const left = Buffer.from(a); const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
function clientIp(request: Request) {
  return request.headers.get('x-real-ip')?.trim() || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}
function attemptKeys(request: Request, device: string) {
  return [`ip:${clientIp(request)}`, ...(device && device !== 'unregistered' ? [`device:${device}`] : [])];
}

export function issueAdminCookies(request: Request) {
  const device = cookie(request, DEVICE_COOKIE) || randomBytes(24).toString('base64url');
  const expires = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const payload = `${expires}.${device}`;
  const session = `${payload}.${signature(payload)}`;
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return {
    device,
    session,
    headers: [
      `${DEVICE_COOKIE}=${device}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_SECONDS}${secure}`,
      `${ADMIN_COOKIE}=${session}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_SECONDS}${secure}`,
    ],
  };
}

export function clearAdminCookies(request: Request) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return [`${ADMIN_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`, `${DEVICE_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`];
}

export function issueDeviceCookie(request: Request) {
  const device = randomBytes(24).toString('base64url');
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${DEVICE_COOKIE}=${device}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_SECONDS}${secure}`;
}

export function verifyAdminSession(request: Request) {
  if (!secret()) return false;
  const value = cookie(request, ADMIN_COOKIE);
  const parts = value.split('.');
  if (parts.length !== 3) return false;
  const [expiresText, device, supplied] = parts;
  const expires = Number(expiresText);
  if (!Number.isSafeInteger(expires) || expires <= Date.now() / 1000 || expires > Date.now() / 1000 + SESSION_SECONDS + 60) return false;
  const payload = `${expiresText}.${device}`;
  return secureEqual(supplied, signature(payload)) && Boolean(device) && device === cookie(request, DEVICE_COOKIE);
}

export async function authenticateAdmin(request: Request, password: unknown) {
  const encodedHash = process.env.ADMIN_PASSWORD_HASH_B64 || '';
  const configuredHash = encodedHash ? Buffer.from(encodedHash, 'base64').toString('utf8') : '';
  const deviceCookie = cookie(request, DEVICE_COOKIE);
  const keys = attemptKeys(request, deviceCookie);
  const now = Date.now();
  const validConfig = /^\$2[aby]\$\d\d\$/.test(configuredHash) && Boolean(secret());
  if (!validConfig) return { ok: false as const, configurationMissing: true as const };
  const active = keys.map((key) => [key, attempts.get(key)] as const).find(([, state]) => state?.blockedUntil && state.blockedUntil > now);
  if (active) return { ok: false as const, blockedForSeconds: Math.ceil(((active[1]?.blockedUntil || now) - now) / 1000) };
  for (const key of keys) {
    const state = attempts.get(key);
    if (state?.blockedUntil && state.blockedUntil <= now) attempts.delete(key);
  }
  const ok = typeof password === 'string' && password.length === 32 && await compare(password, configuredHash).catch(() => false);
  if (ok) {
    keys.forEach((key) => attempts.delete(key));
    return { ok: true as const };
  }
  const count = Math.max(...keys.map((key) => attempts.get(key)?.count || 0)) + 1;
  for (const key of keys) attempts.set(key, count >= 3 ? { count, blockedUntil: now + LOCK_SECONDS } : { count });
  return count >= 3 ? { ok: false as const, blockedForSeconds: LOCK_SECONDS } : { ok: false as const, attemptsLeft: 3 - count };
}

export function isTrustedAdmin(request: Request) {
  const platformId = request.headers.get('oai-authenticated-user-id');
  return (process.env.TRUST_PLATFORM_AUTH_HEADER === 'true' && Boolean(platformId)) || verifyAdminSession(request);
}
