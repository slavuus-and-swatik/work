import { redirect } from 'next/navigation';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const returnTo = url.searchParams.get('return_to') || '/admin';
  redirect(returnTo);
}
