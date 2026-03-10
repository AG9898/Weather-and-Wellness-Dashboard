"use client";

import { useEffect, useMemo, useRef } from "react";
import { animate, stagger, svg } from "animejs";

type PathConfig = {
  id: string;
  d: string;
  width: number;
  opacity: number;
};

function buildPaths(position: number): PathConfig[] {
  return Array.from({ length: 32 }, (_, index) => ({
    id: `${position}-${index}`,
    d: `M-${380 - index * 5 * position} -${189 + index * 6}C-${380 - index * 5 * position} -${189 + index * 6} -${312 - index * 5 * position} ${216 - index * 6} ${152 - index * 5 * position} ${343 - index * 6}C${616 - index * 5 * position} ${470 - index * 6} ${684 - index * 5 * position} ${875 - index * 6} ${684 - index * 5 * position} ${875 - index * 6}`,
    width: 0.5 + index * 0.03,
    opacity: 0.06 + index * 0.014,
  }));
}

const LAYER_CONFIGS = [
  {
    key: "front",
    position: 1,
    outerClassName:
      "left-1/2 top-1/2 h-[140%] w-[140%] min-w-[980px] -translate-x-[50%] -translate-y-[48%]",
    innerClassName: "h-full w-full opacity-95",
  },
  {
    key: "rear",
    position: -1,
    outerClassName:
      "left-1/2 top-1/2 h-[150%] w-[150%] min-w-[1040px] -translate-x-[50%] -translate-y-[52%]",
    innerClassName: "h-full w-full opacity-80",
  },
] as const;

export default function LoginBackgroundPaths() {
  const rootRef = useRef<HTMLDivElement>(null);
  const layerRefs = useRef<Array<HTMLDivElement | null>>([]);
  const pathLayers = useMemo(
    () => LAYER_CONFIGS.map((layer) => buildPaths(layer.position)),
    []
  );

  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;

    const rootEl = rootRef.current;
    if (!rootEl) return;

    const paths = Array.from(rootEl.querySelectorAll<SVGPathElement>(".login-path-line"));
    if (!paths.length) return;

    const drawables = paths.map((path) => svg.createDrawable(path));
    const animations: Array<{ pause: () => void }> = [];

    animations.push(
      animate(drawables, {
        draw: ["0.12 0.34", "0.58 0.84"],
        delay: stagger(160),
        duration: 14000,
        ease: "inOut(2)",
        loop: true,
        alternate: true,
      })
    );

    animations.push(
      animate(paths, {
        opacity: [0.08, 0.32],
        delay: stagger(160),
        duration: 14000,
        ease: "inOut(2)",
        loop: true,
        alternate: true,
      })
    );

    layerRefs.current.forEach((layer, index) => {
      if (!layer) return;

      animations.push(
        animate(layer, {
          translateX: index === 0 ? ["-1.5%", "1.5%"] : ["1.5%", "-1.5%"],
          translateY: index === 0 ? ["-2%", "2%"] : ["2%", "-2%"],
          rotate: index === 0 ? [-1.5, 1.5] : [1.5, -1.5],
          duration: index === 0 ? 18000 : 22000,
          ease: "inOut(2)",
          loop: true,
          alternate: true,
        })
      );
    });

    return () => {
      animations.forEach((animation) => animation.pause());
    };
  }, []);

  return (
    <div ref={rootRef} className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(92,229,252,0.14),transparent_34%),radial-gradient(circle_at_bottom,rgba(0,82,245,0.20),transparent_42%)]" />
      {LAYER_CONFIGS.map((layer, layerIndex) => (
        <div
          key={layer.key}
          className={`absolute ${layer.outerClassName}`}
        >
          <div
            ref={(node) => {
              layerRefs.current[layerIndex] = node;
            }}
            className={layer.innerClassName}
          >
            <svg className="h-full w-full text-white/80" viewBox="0 0 696 316" fill="none">
              <title>Animated background paths</title>
              {pathLayers[layerIndex].map((path) => (
                <path
                  key={path.id}
                  className="login-path-line"
                  d={path.d}
                  stroke="currentColor"
                  strokeWidth={path.width}
                  strokeOpacity={path.opacity}
                />
              ))}
            </svg>
          </div>
        </div>
      ))}
      <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-[#001328] via-[#001328]/50 to-transparent" />
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-[#001328]/60 to-transparent" />
    </div>
  );
}
