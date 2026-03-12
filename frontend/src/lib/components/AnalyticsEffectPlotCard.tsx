"use client";

import { useEffect, useMemo, useState } from "react";
import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";
import type { AnalyticsEffectPlotResponse } from "@/lib/api";

interface ChartColors {
  primary: string;
  secondary: string;
  border: string;
  mutedFg: string;
}

function readChartColors(): ChartColors {
  const styles = getComputedStyle(document.documentElement);
  return {
    primary: styles.getPropertyValue("--chart-1").trim() || "#0052f5",
    secondary: styles.getPropertyValue("--chart-2").trim() || "#00a2fa",
    border: styles.getPropertyValue("--border").trim() || "rgba(0,19,40,0.12)",
    mutedFg: styles.getPropertyValue("--muted-foreground").trim() || "#6e7c95",
  };
}

interface Props {
  effectPlot: AnalyticsEffectPlotResponse | null;
}

export default function AnalyticsEffectPlotCard({ effectPlot }: Props) {
  const [mounted, setMounted] = useState(false);
  const [chartColors, setChartColors] = useState<ChartColors>({
    primary: "#0052f5",
    secondary: "#00a2fa",
    border: "rgba(0,19,40,0.12)",
    mutedFg: "#6e7c95",
  });

  useEffect(() => {
    setMounted(true);
    setChartColors(readChartColors());
    const observer = new MutationObserver(() => {
      setChartColors(readChartColors());
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  const chartOptions = useMemo<Highcharts.Options>(() => {
    if (!effectPlot) return {};

    const { primary, secondary, border, mutedFg } = chartColors;

    // Store date_local in the `name` field for tooltip access
    const scatterData: Highcharts.PointOptionsObject[] = effectPlot.points.map((pt) => ({
      x: pt.x,
      y: pt.y,
      name: pt.date_local,
    }));

    const lineData: [number, number][] = effectPlot.fitted_line.map((pt) => [pt.x, pt.y]);

    return {
      chart: {
        backgroundColor: "transparent",
        height: 260,
        animation: false,
        style: { fontFamily: "inherit" },
        marginTop: 12,
        marginRight: 20,
      },
      title: { text: undefined },
      credits: { enabled: false },
      legend: { enabled: false },
      tooltip: {
        useHTML: true,
        backgroundColor: "var(--card)",
        borderColor: border,
        borderRadius: 10,
        padding: 10,
        shadow: false,
        style: { color: mutedFg, fontSize: "12px", lineHeight: "1.6" },
        formatter: function (): string {
          const ctx = this as unknown as {
            point?: { name?: string };
            series?: { name?: string };
            x?: number;
            y?: number;
          };
          if (ctx.series?.name === "Fitted") {
            return `<span style="font-weight:600;font-size:11px">Fitted line</span><br/>y = ${(ctx.y as number).toFixed(3)}`;
          }
          const dateLabel = ctx.point?.name
            ? `<span style="font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.05em">${ctx.point.name}</span><br/>`
            : "";
          return (
            dateLabel +
            `${effectPlot.x_label}: <b>${(ctx.x as number).toFixed(3)}</b><br/>` +
            `${effectPlot.y_label}: <b>${(ctx.y as number).toFixed(3)}</b>`
          );
        },
      },
      xAxis: {
        title: {
          text: effectPlot.x_label,
          style: { color: mutedFg, fontSize: "11px" },
          margin: 8,
        },
        lineColor: border,
        tickColor: "transparent",
        gridLineWidth: 1,
        gridLineColor: border,
        gridLineDashStyle: "Dash" as const,
        labels: { style: { color: mutedFg, fontSize: "11px" } },
        crosshair: { color: border, dashStyle: "Dash" as const },
      },
      yAxis: {
        title: {
          text: effectPlot.y_label,
          style: { color: mutedFg, fontSize: "11px" },
          margin: 8,
        },
        gridLineColor: border,
        gridLineDashStyle: "Dash" as const,
        labels: { style: { color: mutedFg, fontSize: "11px" } },
      },
      plotOptions: {
        series: { animation: false },
        scatter: {
          marker: {
            symbol: "circle",
            radius: 3.5,
            lineWidth: 0,
            states: { hover: { enabled: true, radius: 5 } },
          },
        },
        spline: {
          lineWidth: 2.5,
          marker: { enabled: false },
          states: { hover: { lineWidthPlus: 0 } },
        },
      },
      series: [
        {
          type: "scatter" as const,
          name: "Partial residuals",
          color: primary + "99",
          data: scatterData,
          zIndex: 2,
        },
        {
          type: "spline" as const,
          name: "Fitted",
          color: secondary,
          lineWidth: 2.5,
          data: lineData,
          zIndex: 3,
        },
      ],
    };
  }, [effectPlot, chartColors]);

  if (!effectPlot) {
    return (
      <div className="rounded-2xl border border-border/70 bg-background/65 px-4 py-8 text-center text-sm text-muted-foreground">
        No effect plot available for this term. Interaction terms are not plotted in v1.
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl border border-border/80 p-4 shadow-[0_20px_45px_-40px_rgb(0_19_40/0.9)]"
      style={{ background: "color-mix(in srgb, var(--card) 86%, transparent)" }}
    >
      <div className="mb-3">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Effect Plot
        </p>
        <h3 className="mt-1 text-base font-semibold text-foreground">
          {effectPlot.y_label} vs {effectPlot.x_label}
        </h3>
      </div>

      <div className="h-[260px] w-full">
        {mounted && (
          <HighchartsReact
            highcharts={Highcharts}
            options={chartOptions}
            containerProps={{ style: { width: "100%", height: "100%" } }}
          />
        )}
      </div>

      <p className="mt-2 text-[11px] text-muted-foreground">
        Partial residuals for the selected predictor. Fitted line shows modeled effect direction.
        Hover a point for its session date.
      </p>
    </div>
  );
}
