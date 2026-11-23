/** Full-screen simulations: they bring their own top bar (SimulationShell, phase 3). */
export default function ImmersiveLayout({ children }: { children: React.ReactNode }) {
  return (
    <main id="main" className="flex min-h-dvh flex-1 flex-col">
      {children}
    </main>
  );
}
