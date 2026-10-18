import { RootGone } from "@/components/gone";

/**
 * Outside /settings there are three addresses: /login, /oauth-complete and
 * /blocked. Anything else is this page, and it is themed rather than the
 * browser's own white sheet.
 */
export default function NotFound() {
  return <RootGone />;
}
