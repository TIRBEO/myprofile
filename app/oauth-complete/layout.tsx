/** This segment used to load Inter + JetBrains Mono; the whole product now
    speaks San Francisco, so it inherits the app's system stack instead.
    The palette is global — one black canvas and one indigo action colour
    across myprofile and accounts.tirbeo.com. */
export default function OAuthCompleteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, ui-sans-serif, system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
      {children}
    </div>
  );
}
