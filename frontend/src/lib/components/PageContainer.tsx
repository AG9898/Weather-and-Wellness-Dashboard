import { cn } from "@/lib/utils";

interface PageContainerProps {
  children: React.ReactNode;
  /** Tighten to max-w-2xl for focused single-column flows (e.g. surveys) */
  narrow?: boolean;
  className?: string;
}

/**
 * Shared page content wrapper.
 * Provides consistent max-width, horizontal padding, and vertical spacing
 * for both RA and participant pages.
 */
export default function PageContainer({
  children,
  narrow = false,
  className,
}: PageContainerProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-4 py-8 sm:px-6 lg:px-8",
        narrow ? "max-w-2xl" : "max-w-5xl",
        className
      )}
    >
      {children}
    </div>
  );
}
