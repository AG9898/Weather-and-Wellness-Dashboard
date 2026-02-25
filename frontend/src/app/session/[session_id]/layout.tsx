/**
 * Layout for participant-facing session pages.
 * No auth required — participants access these pages via a shared URL.
 * Provides a minimal centered shell for focused task completion.
 */
export default function SessionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        {children}
      </div>
    </div>
  );
}
