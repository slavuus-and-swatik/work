import ApprovalPage from './review-page';

export const metadata = { title: 'Согласование сайта' };
export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <ApprovalPage token={token} />;
}
