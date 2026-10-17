import { redirect } from 'next/navigation';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requested = url.searchParams.get('return_to') || '/admin';
  let returnTo = '/admin';
  if (requested.startsWith('/') && !requested.startsWith('//') && !requested.includes('\\')) {
    const candidate = new URL(requested, url.origin);
    if (candidate.origin === url.origin) returnTo = `${candidate.pathname}${candidate.search}${candidate.hash}`;
  }
  redirect(returnTo);
}
