import type {
  MisokinesiaSectionJumpSection,
  MisokinesiaSectionTarget,
} from "@/lib/misokinesia-section-jump";
import { DEFAULT_MISO_LOCALE, misoMessage, type MisoLocale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface MisokinesiaSectionJumperProps {
  sections: readonly MisokinesiaSectionJumpSection[];
  activeSection: MisokinesiaSectionTarget;
  onJump: (section: MisokinesiaSectionTarget) => void;
  /**
   * Session locale, used for the group's accessible name only. Visible segment
   * labels stay caller-supplied so the component remains presentational; build
   * them with `misokinesiaSectionJumpSections(locale)`.
   */
  locale?: MisoLocale;
  className?: string;
}

export default function MisokinesiaSectionJumper({
  sections,
  activeSection,
  onJump,
  locale = DEFAULT_MISO_LOCALE,
  className,
}: MisokinesiaSectionJumperProps) {
  return (
    <div
      className={cn(
        "inline-grid w-full max-w-[34rem] grid-flow-col auto-cols-fr gap-1 rounded-md border border-border bg-card/90 p-1 shadow-sm",
        className
      )}
      role="group"
      aria-label={misoMessage("chrome.jumper.aria", locale)}
    >
      {sections.map((section) => {
        const isActive = section.target === activeSection;

        return (
          <button
            key={section.target}
            type="button"
            className={cn(
              "min-w-0 rounded px-2 py-1.5 text-center text-[11px] font-semibold leading-none text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              isActive && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
            )}
            aria-pressed={isActive}
            onClick={() => onJump(section.target)}
          >
            <span className="block truncate">{section.label}</span>
          </button>
        );
      })}
    </div>
  );
}

