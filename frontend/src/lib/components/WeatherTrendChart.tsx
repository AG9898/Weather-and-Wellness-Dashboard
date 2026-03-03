"use client";

import { useMemo } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DashboardParticipantsPerDayResponse, WeatherDailyResponse } from "@/lib/api";

const STUDY_TIMEZONE = "America/Vancouver";
const TEMP_COLOR = "#0052f5";
const PARTICIPANT_COLOR = "#00a2fa";

interface DateRange {
  dateFrom: string;
  dateTo: string;
}

interface WeatherTrendChartProps {
  range: DateRange | null;
  weather: WeatherDailyResponse | null;
  participantsPerDay: DashboardParticipantsPerDayResponse | null;
  loading: boolean;
}

interface TrendPoint {
  dateLocal: string;
  tempC: number | null;
  precipMm: number | null;
  participantCount: number;
}

function shiftIsoDate(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(year, month - 1, day));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function enumerateDates(range: DateRange): string[] {
  const dates: string[] = [];
  let cursor = range.dateFrom;
  while (cursor <= range.dateTo) {
    dates.push(cursor);
    cursor = shiftIsoDate(cursor, 1);
  }
  return dates;
}

function formatDateLabel(isoDate: string, options?: Intl.DateTimeFormatOptions): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(year, month - 1, day));
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    ...options,
  }).format(dt);
}

function formatTooltipDateLabel(isoDate: string): string {
  return formatDateLabel(isoDate, { year: "numeric", month: "short", day: "numeric" });
}

function formatAxisDateLabel(value: unknown): string {
  if (typeof value !== "string") return "";
  return formatDateLabel(value);
}

function formatTemp(value: number | null): string {
  if (value === null) return "—";
  return `${value.toFixed(1)}°C`;
}

function formatPrecip(value: number | null): string {
  if (value === null) return "—";
  return `${value.toFixed(1)} mm`;
}

interface TooltipContentProps {
  active?: boolean;
  payload?: Array<{ payload: TrendPoint }>;
}

function TooltipContent({ active, payload }: TooltipContentProps) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]?.payload as TrendPoint | undefined;
  if (!point) return null;

  return (
    <div
      className="rounded-xl border border-border px-3 py-2 text-xs shadow-lg"
      style={{ background: "var(--popover)" }}
    >
      <p className="font-semibold text-popover-foreground">
        {formatTooltipDateLabel(point.dateLocal)}
      </p>
      <p className="mt-1 text-popover-foreground">
        Temp: <span className="font-semibold">{formatTemp(point.tempC)}</span>
      </p>
      <p className="text-popover-foreground">
        Precip: <span className="font-semibold">{formatPrecip(point.precipMm)}</span>
      </p>
      <p className="text-popover-foreground">
        Participants: <span className="font-semibold tabular-nums">{point.participantCount}</span>
      </p>
    </div>
  );
}

export default function WeatherTrendChart({
  range,
  weather,
  participantsPerDay,
  loading,
}: WeatherTrendChartProps) {
  const data = useMemo<TrendPoint[]>(() => {
    if (!range) return [];

    const weatherByDate = new Map(
      (weather?.items ?? []).map((item) => [
        item.date_local,
        {
          tempC: item.current_temp_c,
          precipMm: item.current_precip_today_mm,
        },
      ])
    );
    const participantsByDate = new Map(
      (participantsPerDay?.items ?? []).map((item) => [item.date_local, item.participants_completed])
    );

    return enumerateDates(range).map((dateLocal) => {
      const weatherForDate = weatherByDate.get(dateLocal);
      return {
        dateLocal,
        tempC: weatherForDate?.tempC ?? null,
        precipMm: weatherForDate?.precipMm ?? null,
        participantCount: participantsByDate.get(dateLocal) ?? 0,
      };
    });
  }, [range, weather, participantsPerDay]);

  const hasRenderableData = data.some((point) => point.tempC !== null || point.participantCount > 0);

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-border p-5"
      style={{ background: "var(--card)" }}
    >
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-20 blur-2xl"
        style={{ background: "var(--ubc-blue-500)" }}
      />

      <div className="relative mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Weather Trend
          </p>
          <p className="text-sm text-foreground">
            Temperature (line) and participants/day (bars)
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          {range
            ? `${range.dateFrom} to ${range.dateTo} (${STUDY_TIMEZONE})`
            : `Apply a range filter to display trend data (${STUDY_TIMEZONE})`}
        </p>
      </div>

      {!range ? (
        <p className="text-sm text-muted-foreground">
          Select a dashboard range above to view weather and participant trends.
        </p>
      ) : loading && !hasRenderableData ? (
        <p className="text-sm text-muted-foreground">Loading range graph…</p>
      ) : !hasRenderableData ? (
        <p className="text-sm text-muted-foreground">
          No temperature or participant data is available for this range.
        </p>
      ) : (
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={data}
              margin={{ top: 8, right: 12, left: -8, bottom: 8 }}
            >
              <CartesianGrid stroke="var(--border)" vertical={false} strokeDasharray="4 4" />
              <XAxis
                dataKey="dateLocal"
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                tickFormatter={formatAxisDateLabel}
                axisLine={{ stroke: "var(--border)" }}
                tickLine={{ stroke: "var(--border)" }}
                minTickGap={20}
              />
              <YAxis
                yAxisId="temp"
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                tickFormatter={(value: number) => `${value}°`}
                axisLine={{ stroke: "var(--border)" }}
                tickLine={{ stroke: "var(--border)" }}
                width={44}
              />
              <YAxis
                yAxisId="participants"
                orientation="right"
                allowDecimals={false}
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                axisLine={{ stroke: "var(--border)" }}
                tickLine={{ stroke: "var(--border)" }}
                width={36}
              />
              <Tooltip content={<TooltipContent />} />
              <Bar
                yAxisId="participants"
                dataKey="participantCount"
                fill={PARTICIPANT_COLOR}
                fillOpacity={0.26}
                radius={[8, 8, 0, 0]}
                barSize={18}
              />
              <Line
                yAxisId="temp"
                type="monotone"
                dataKey="tempC"
                stroke={TEMP_COLOR}
                strokeWidth={2.5}
                dot={false}
                connectNulls={false}
                activeDot={{ r: 4, fill: TEMP_COLOR, stroke: "#ffffff", strokeWidth: 2 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
