import { SettingsGone } from "@/components/gone";

/**
 * The answer to /settings/<anything the router does not recognise> — the
 * catch-all says notFound() and this is what is rendered, inside the settings
 * layout, so the palette, the rail and the account gate are all still in front
 * of it.
 */
export default function SettingsNotFound() {
  return <SettingsGone />;
}
