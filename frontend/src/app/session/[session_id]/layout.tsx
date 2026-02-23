/**
 * Layout for participant-facing session pages.
 * No auth required — participants access these pages via a shared URL.
 */
export default function SessionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
