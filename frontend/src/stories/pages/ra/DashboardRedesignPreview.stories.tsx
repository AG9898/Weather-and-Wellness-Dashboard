import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  buildDashboardMockFetch,
  buildDashboardStoryParameters,
  DashboardStoryShell,
  dashboardMobileDecorator,
} from "./DashboardPageStorySupport";

const meta = {
  title: "Concepts/RA/Dashboard 2026",
  component: DashboardStoryShell,
  tags: ["autodocs"],
  parameters: {
    ...buildDashboardStoryParameters("replica"),
    docs: {
      description: {
        component:
          "Preview surface for the proposed 2026 dashboard redesign. This scaffold intentionally renders the current dashboard replica until redesign-specific layout changes are applied.",
      },
    },
  },
} satisfies Meta<typeof DashboardStoryShell>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Scaffold: Story = {};

export const Loading: Story = {
  parameters: {
    mockFetch: buildDashboardMockFetch("loading"),
  },
};

export const Empty: Story = {
  parameters: {
    mockFetch: buildDashboardMockFetch("empty"),
  },
};

export const Error: Story = {
  parameters: {
    mockFetch: buildDashboardMockFetch("error"),
  },
};

export const Dark: Story = {
  globals: {
    theme: "dark",
  },
};

export const Mobile: Story = {
  decorators: [dashboardMobileDecorator],
};
