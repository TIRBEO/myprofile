import { RootGone } from "@/components/gone";

/**
 * Outside /settings there are two addresses: /login and /oauth-complete.
 * Anything else is this page, and it is themed rather than the browser's own
 * white sheet. (The retired /blocked is not even this — the edge proxy sends
 * it straight to /settings, where the closure screen lives.)
 */
export default function NotFound() {
  return <RootGone />;
}
