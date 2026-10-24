import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isPlatformAdmin } from "@/lib/platform-auth";
import { project } from "@/lib/detailing/store";
import DetailingSite from "@/components/detailing/site";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Предпросмотр черновика",
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (
    !isPlatformAdmin(
      new Request("http://internal", { headers: await headers() }),
    )
  )
    redirect("/studio");
  return <DetailingSite config={project((await params).id).draft} preview />;
}
