import { notFound } from "next/navigation";
import RecordRoute from "@/components/record-route";
import { recordTarget } from "@/lib/record-routes";

/* Every /settings address that points at one record is this one file. It was
   eight files, and eight files on a plan that counts serverless functions meant
   eight functions — see components/record-route.tsx for the whole of it.

   The server's whole job here is to say no. Anything under /settings that is
   neither a screen of its own nor one of the eight record shapes is a 404,
   which is the honest answer, and it is said before a byte of screen is built
   rather than by an empty page after it. */

export default async function SettingsRecordPage({
  params,
}: {
  params: Promise<{ path: string[] }>;
}) {
  const { path } = await params;
  const target = recordTarget(path);
  if (!target) notFound();
  return <RecordRoute target={target} />;
}