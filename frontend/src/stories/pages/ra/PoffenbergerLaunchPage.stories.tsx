import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  buildPoffenbergerLaunchStoryParameters,
  PoffenbergerLaunchStoryShell,
  poffenbergerLaunchMobileDecorator,
} from "./PoffenbergerLaunchPageStorySupport";

const meta = {
  title: "Pages/RA/PoffenbergerLaunch",
  component: PoffenbergerLaunchStoryShell,
  tags: ["autodocs"],
  parameters: buildPoffenbergerLaunchStoryParameters(),
} satisfies Meta<typeof PoffenbergerLaunchStoryShell>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Empty form — Start and trial actions are disabled until demographics are selected. */
export const Empty: Story = {
  args: {
    state: "empty",
  },
};

/** Demographics complete — all launch actions are enabled. */
export const Ready: Story = {
  args: {
    state: "ready",
  },
};

/** Recorded start in flight — actions disabled, Start shows a loading label. */
export const Starting: Story = {
  args: {
    state: "starting",
  },
};

/** Short no-write trial launching. */
export const ShortTrialStarting: Story = {
  args: {
    state: "short_trial",
  },
};

/** Full no-write trial launching. */
export const FullTrialStarting: Story = {
  args: {
    state: "full_trial",
  },
};

/** Recorded start failed — inline error banner is shown on the launch page. */
export const Error: Story = {
  args: {
    state: "error",
  },
};

export const Dark: Story = {
  args: {
    state: "ready",
  },
  globals: {
    theme: "dark",
  },
};

export const Mobile: Story = {
  args: {
    state: "ready",
  },
  decorators: [poffenbergerLaunchMobileDecorator],
};
