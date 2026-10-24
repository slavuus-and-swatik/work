import { notFound } from "next/navigation";
import DetailingSite from "@/components/detailing/site";
import { liveSite, DetailError } from "@/lib/detailing/store";
export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  try {
    const { config } = liveSite((await params).slug);
    return {
      title: `${config.name} — детейлинг`,
      description: config.description,
      robots: config.demo ? { index: false, follow: false } : undefined,
    };
  } catch {
    return { title: "Сайт не опубликован" };
  }
}
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  try {
    return <DetailingSite config={liveSite(slug).config} slug={slug} />;
  } catch (e) {
    if (e instanceof DetailError) notFound();
    throw e;
  }
}
