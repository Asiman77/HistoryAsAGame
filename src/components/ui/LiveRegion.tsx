/** Polite announcement for screen readers (step changes, §11). Visually hidden. */
export function LiveRegion({ message }: { message: string }) {
  return (
    <p aria-live="polite" aria-atomic="true" className="sr-only" data-testid="live-region">
      {message}
    </p>
  );
}
