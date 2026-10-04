import { POLICIES } from "@/lib/help-policies";
import PolicyScreen from "@/components/policy-screen";

/* The policies are build-time content, not account data, so every one of them
   is written out at deploy instead of asking the edge for a function per
   policy. `dynamicParams = false` is what actually makes it static — leave it
   on and Next keeps a server function behind the route for slugs it wasn't
   told about. An unknown slug is a 404, which is the honest answer. */
export const dynamicParams = false;

export function generateStaticParams() {
  return POLICIES.map((policy) => ({ slug: policy.slug }));
}

export default function PolicyPage() {
  return <PolicyScreen />;
}