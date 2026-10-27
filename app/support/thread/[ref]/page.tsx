import SupportThreadScreen from "@/components/support-thread-screen";

/* The page a support answer links to. It is gated like every other screen on
   this app — a visitor with no session is sent to sign in and returned here —
   and the reference in the path is a handle, not a key: the account service
   answers 404 for a thread that belongs to somebody else. */
export default async function SupportThreadPage({
  params,
}: {
  params: Promise<{ ref: string }>;
}) {
  const { ref } = await params;
  return <SupportThreadScreen code={decodeURIComponent(ref ?? "")} />;
}
