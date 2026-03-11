"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { animate, spring, utils } from "animejs";
import {
  ArrowUpDown,
  Home,
  LogOut,
  PanelTopClose,
  PanelTopOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import ThemeToggle from "@/lib/components/ThemeToggle";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

const DOCK_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/import-export", label: "Export", icon: ArrowUpDown },
] as const;

const DOCK_DISTANCE_LIMIT = 180;
const DOCK_BASE_ACTIVE_SCALE = 1;
const DOCK_HOVER_BOOST = 0.22;
const DOCK_ACTIVE_LIFT = 0;
const DOCK_HOVER_LIFT = 10;
const springEase = spring({
  stiffness: 220,
  damping: 18,
  mass: 0.9,
  bounce: 0.32,
});

function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setPrefersReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return prefersReducedMotion;
}

function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function dockScaleForDistance(distance: number, active: boolean): number {
  const influence = utils.clamp(utils.mapRange(distance, 0, DOCK_DISTANCE_LIMIT, 1, 0), 0, 1);
  return 1 + influence * DOCK_HOVER_BOOST + (active ? DOCK_BASE_ACTIVE_SCALE - 1 : 0);
}

function dockLiftForDistance(distance: number, active: boolean): number {
  const influence = utils.clamp(utils.mapRange(distance, 0, DOCK_DISTANCE_LIMIT, 1, 0), 0, 1);
  return influence * DOCK_HOVER_LIFT + (active ? DOCK_ACTIVE_LIFT : 0);
}

export function shouldShowRAFloatingChrome(pathname: string | null): boolean {
  return pathname === "/dashboard" || pathname === "/import-export";
}

export default function RAFloatingChrome() {
  const pathname = usePathname();
  const router = useRouter();
  const prefersReducedMotion = usePrefersReducedMotion();
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeHint, setActiveHint] = useState<string | null>(null);
  const dockRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const dockAnimations = useRef<Record<string, ReturnType<typeof animate> | null>>({});
  const hintAnimations = useRef<Record<string, ReturnType<typeof animate> | null>>({});
  const menuContentRef = useRef<HTMLDivElement | null>(null);
  const menuAnimationRef = useRef<ReturnType<typeof animate> | null>(null);
  const hasAnimatedMenuRef = useRef(false);

  const resolvedItems = useMemo(
    () =>
      DOCK_ITEMS.map((item) => ({
        ...item,
        active: isActivePath(pathname, item.href),
      })),
    [pathname]
  );

  useEffect(() => {
    const currentAnimations = dockAnimations.current;

    resolvedItems.forEach(({ href, active }) => {
      const el = dockRefs.current[href];
      if (!el) return;

      currentAnimations[href]?.pause();

      if (prefersReducedMotion) {
        el.style.transform = `translateY(-${active ? DOCK_ACTIVE_LIFT : 0}px) scale(${active ? DOCK_BASE_ACTIVE_SCALE : 1})`;
        return;
      }

      currentAnimations[href] = animate(el, {
        scale: active ? DOCK_BASE_ACTIVE_SCALE : 1,
        translateY: active ? -DOCK_ACTIVE_LIFT : 0,
        duration: 420,
        ease: springEase,
      });
    });

    return () => {
      Object.values(currentAnimations).forEach((animation) => animation?.pause());
    };
  }, [prefersReducedMotion, resolvedItems]);

  useEffect(() => {
    const content = menuContentRef.current;
    if (!content) return;

    menuAnimationRef.current?.pause();

    if (prefersReducedMotion) {
      content.style.opacity = menuOpen ? "1" : "0";
      content.style.transform = menuOpen
        ? "translateY(0px) scale(1)"
        : "translateY(-14px) scale(0.94)";
      hasAnimatedMenuRef.current = menuOpen;
      return;
    }

    if (!hasAnimatedMenuRef.current && !menuOpen) {
      content.style.opacity = "0";
      content.style.transform = "translateY(-14px) scale(0.94)";
      return;
    }

    menuAnimationRef.current = animate(content, {
      opacity: menuOpen ? [0, 1] : [1, 0],
      translateY: menuOpen ? [-18, 0] : [0, -14],
      scale: menuOpen ? [0.88, 1] : [1, 0.94],
      duration: menuOpen ? 460 : 280,
      ease: menuOpen ? springEase : "out(3)",
    });
    hasAnimatedMenuRef.current = true;

    return () => {
      menuAnimationRef.current?.pause();
    };
  }, [menuOpen, prefersReducedMotion]);

  function animateHint(href: string, visible: boolean) {
    const target = document.querySelector<HTMLElement>(`[data-dock-hint="${href}"]`);
    if (!target) return;

    hintAnimations.current[href]?.pause();

    if (prefersReducedMotion) {
      target.style.opacity = visible ? "1" : "0";
      target.style.transform = visible
        ? "translateY(0px) scale(1)"
        : "translateY(6px) scale(0.96)";
      return;
    }

    hintAnimations.current[href] = animate(target, {
      opacity: visible ? [0, 1] : [1, 0],
      translateY: visible ? [6, 0] : [0, 6],
      scale: visible ? [0.96, 1] : [1, 0.96],
      duration: 220,
      ease: "out(3)",
    });
  }

  function showHint(href: string) {
    if (activeHint && activeHint !== href) {
      animateHint(activeHint, false);
    }
    setActiveHint(href);
    animateHint(href, true);
  }

  function resetHints() {
    if (activeHint) {
      animateHint(activeHint, false);
    }
    setActiveHint(null);
  }

  function updateDock(pointerX: number | null) {
    resolvedItems.forEach(({ href, active }) => {
      const el = dockRefs.current[href];
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const distance = pointerX === null ? DOCK_DISTANCE_LIMIT : Math.abs(pointerX - centerX);
      const scale = pointerX === null
        ? active ? DOCK_BASE_ACTIVE_SCALE : 1
        : dockScaleForDistance(distance, active);
      const lift = pointerX === null
        ? active ? DOCK_ACTIVE_LIFT : 0
        : dockLiftForDistance(distance, active);

      dockAnimations.current[href]?.pause();

      if (prefersReducedMotion) {
        el.style.transform = `translateY(-${lift}px) scale(${scale})`;
      } else {
        dockAnimations.current[href] = animate(el, {
          scale,
          translateY: -lift,
          duration: 460,
          ease: springEase,
        });
      }
    });
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  function focusDockItem(href: string) {
    const el = dockRefs.current[href];
    if (!el) return;
    const rect = el.getBoundingClientRect();
    updateDock(rect.left + rect.width / 2);
  }

  return (
    <>
      <div
        className="pointer-events-none fixed left-4 top-4 z-50 sm:left-5 sm:top-5"
        style={{ top: "max(env(safe-area-inset-top), 1rem)" }}
      >
        <div className="pointer-events-auto">
          <Popover open={menuOpen} onOpenChange={setMenuOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="icon-lg"
                className={cn(
                  "group relative size-12 rounded-[1.15rem] border-border/80 bg-card/82 text-foreground shadow-[0_18px_45px_-28px_rgb(0_19_40/0.78)] backdrop-blur-2xl hover:border-ring/45 hover:bg-card/92 dark:bg-card/72",
                  menuOpen && "border-ring/55 bg-card/94"
                )}
                aria-label={menuOpen ? "Close menu" : "Open utility menu"}
              >
                <span className="absolute inset-1 rounded-[0.95rem] bg-gradient-to-b from-white/40 via-transparent to-transparent opacity-80 dark:from-white/12" />
                <span className="relative flex items-center justify-center">
                  <span className="relative size-7 overflow-hidden rounded-full border border-border/70 bg-background/70">
                    <Image
                      src="/ww-mark.png"
                      alt=""
                      fill
                      sizes="28px"
                      className="object-cover"
                    />
                  </span>
                  <span className="absolute -right-3 -top-3 rounded-full border border-border/70 bg-background/88 p-1 text-muted-foreground shadow-sm backdrop-blur-sm">
                    {menuOpen ? <PanelTopClose className="size-3" /> : <PanelTopOpen className="size-3" />}
                  </span>
                </span>
              </Button>
            </PopoverTrigger>

            <PopoverContent
              ref={menuContentRef}
              forceMount
              side="bottom"
              align="start"
              sideOffset={14}
              className={cn(
                "w-60 origin-top-left rounded-[1.8rem] border-border/75 bg-popover/86 p-2 shadow-[0_26px_70px_-34px_rgb(0_19_40/0.72)] backdrop-blur-3xl data-[state=closed]:pointer-events-none",
                !menuOpen && "pointer-events-none"
              )}
            >
              <div className="rounded-[1.25rem] border border-white/10 bg-gradient-to-b from-white/10 via-transparent to-transparent p-1">
                <div className="mb-1 px-3 py-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
                    W&amp;W Research
                  </p>
                </div>
                <ThemeToggle variant="menu" className="mb-1" />
                <Button
                  type="button"
                  variant="ghost"
                  className="h-11 w-full justify-between rounded-2xl px-3 text-sm hover:bg-accent/70"
                  onClick={handleSignOut}
                >
                  <span className="inline-flex items-center gap-2">
                    <LogOut className="size-4" />
                    Sign out
                  </span>
                  <span className="text-xs text-muted-foreground">Exit</span>
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-4"
        style={{ bottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}
      >
        <nav
          aria-label="RA navigation"
          className="pointer-events-auto rounded-[1.7rem] border border-border/80 bg-card/80 px-1.5 py-1.5 shadow-[0_24px_60px_-34px_rgb(0_19_40/0.82)] backdrop-blur-3xl dark:bg-card/68"
          onPointerLeave={() => {
            resetHints();
            updateDock(null);
          }}
          onPointerMove={(event) => {
            if (prefersReducedMotion) return;
            updateDock(event.clientX);
          }}
        >
          <div className="flex items-end gap-1">
            {resolvedItems.map(({ href, label, icon: Icon, active }) => {
              const highlighted = activeHint === href;

              return (
                <div key={href} className="relative flex items-end justify-center px-0.5">
                  <span
                    data-dock-hint={href}
                    className={cn(
                      "pointer-events-none absolute -top-10 rounded-full border border-border/70 bg-popover/92 px-2.5 py-1 text-[11px] font-semibold tracking-[0.22em] text-popover-foreground shadow-sm backdrop-blur-xl",
                      highlighted ? "opacity-100" : "opacity-0"
                    )}
                  >
                    {label}
                  </span>

                  <Button
                    asChild
                    variant="ghost"
                    size="icon-lg"
                    className="relative size-12 rounded-[1.15rem] border border-transparent bg-transparent text-muted-foreground shadow-none transition-colors duration-200 hover:bg-transparent hover:text-foreground"
                  >
                    <Link
                      href={href}
                      aria-label={label}
                      aria-current={active ? "page" : undefined}
                      ref={(node) => {
                        dockRefs.current[href] = node;
                      }}
                      onPointerEnter={() => {
                        showHint(href);
                      }}
                      onFocus={() => {
                        showHint(href);
                        focusDockItem(href);
                      }}
                      onBlur={() => {
                        resetHints();
                        updateDock(null);
                      }}
                    >
                      <span className="absolute inset-1 rounded-[0.95rem] bg-gradient-to-b from-white/18 via-transparent to-transparent opacity-60 dark:from-white/10" />
                      <Icon className="relative size-[1.1rem] shrink-0" strokeWidth={1.85} />
                    </Link>
                  </Button>
                </div>
              );
            })}
          </div>
        </nav>
      </div>
    </>
  );
}
