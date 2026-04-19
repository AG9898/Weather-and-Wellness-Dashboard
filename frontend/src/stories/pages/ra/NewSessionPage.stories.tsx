import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  buildNewSessionStoryParameters,
  NewSessionStoryShell,
  newSessionMobileDecorator,
} from "./NewSessionPageStorySupport";

const meta = {
  title: "Pages/RA/New Session",
  component: NewSessionStoryShell,
  tags: ["autodocs"],
  parameters: buildNewSessionStoryParameters(),
} satisfies Meta<typeof NewSessionStoryShell>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Replica: Story = {};

export const Loading: Story = {
  args: {
    state: "loading",
  },
};

export const Empty: Story = {
  args: {
    state: "empty",
  },
};

export const Error: Story = {
  args: {
    state: "error",
  },
};

export const Dark: Story = {
  globals: {
    theme: "dark",
  },
};

export const Mobile: Story = {
  decorators: [newSessionMobileDecorator],
};
