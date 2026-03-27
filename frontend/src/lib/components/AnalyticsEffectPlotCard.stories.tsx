import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { AnalyticsEffectPlotResponse } from "@/lib/api";
import AnalyticsEffectPlotCard from "@/lib/components/AnalyticsEffectPlotCard";

const effectPlot: AnalyticsEffectPlotResponse = {
  outcome: "digit_span",
  term: "sunshine_duration_hours",
  x_label: "Sunlight Hours",
  y_label: "Digit Span",
  points: [
    { x: 5.2, y: 7.1, date_local: "2026-03-20" },
    { x: 6.1, y: 7.3, date_local: "2026-03-21" },
    { x: 6.8, y: 7.7, date_local: "2026-03-22" },
    { x: 7.4, y: 8.2, date_local: "2026-03-23" },
    { x: 8.6, y: 8.6, date_local: "2026-03-24" },
    { x: 9.3, y: 8.8, date_local: "2026-03-25" },
    { x: 10.1, y: 9.1, date_local: "2026-03-26" },
  ],
  fitted_line: [
    { x: 5, y: 7 },
    { x: 6.5, y: 7.6 },
    { x: 8, y: 8.2 },
    { x: 9.5, y: 8.8 },
    { x: 11, y: 9.4 },
  ],
};

const meta = {
  title: "Dashboard/AnalyticsEffectPlotCard",
  component: AnalyticsEffectPlotCard,
  tags: ["autodocs"],
  args: {
    effectPlot,
  },
  render: (args) => (
    <div className="mx-auto max-w-4xl">
      <AnalyticsEffectPlotCard {...args} />
    </div>
  ),
} satisfies Meta<typeof AnalyticsEffectPlotCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const EmptyState: Story = {
  args: {
    effectPlot: null,
  },
};
