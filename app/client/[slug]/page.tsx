import ClientWorkspace from "./workspace";

export const metadata = { title: "Кабинет клиента — FORMA", robots: { index: false, follow: false } };
export default async function Page({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ invite?: string }> }) {
  const { slug } = await params;
  const { invite } = await searchParams;
  return <ClientWorkspace slug={slug} invite={invite || ""} />;
}
