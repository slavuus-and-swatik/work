import { notFound } from "next/navigation";
import { review, DetailError } from "@/lib/detailing/store";
import ReviewScreen from "@/components/detailing/review";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Согласование сайта",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  try {
    const { projectId: _, ...data } = review((await params).token);
    return <ReviewScreen initial={data} />;
  } catch (e) {
    if (e instanceof DetailError) notFound();
    throw e;
  }
}
