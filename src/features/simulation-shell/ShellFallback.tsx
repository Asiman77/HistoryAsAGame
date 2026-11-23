/**
 * What the static HTML holds until the shell has read the URL (?step=, ?mode=)
 * in the browser: the frame of the simulation with its title, no step yet,
 * so a deep link never flashes the first step (ADR-0022).
 */
export function ShellFallback({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex h-dvh flex-col" aria-busy="true" data-testid="shell-fallback">
      <div className="flex h-[72px] shrink-0 items-center border-b border-line bg-surface-panel px-7">
        <div>
          <h1 className="m-0 font-heading text-22 font-medium text-fg">{title}</h1>
          <p className="m-0 text-12 uppercase tracking-[0.18em] text-fg-secondary">{subtitle}</p>
        </div>
      </div>
      <div className="flex-1 animate-pulse bg-map-water/30" />
    </div>
  );
}
