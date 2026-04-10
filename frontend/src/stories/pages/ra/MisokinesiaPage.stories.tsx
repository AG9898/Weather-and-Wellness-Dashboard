import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  buildMisokinesiaStoryParameters,
  MisokinesiaStoryShell,
  misokinesiaMobileDecorator,
} from "./MisokinesiaPageStorySupport";

const meta = {
  title: "Pages/RA/Misokinesia",
  component: MisokinesiaStoryShell,
  tags: ["autodocs"],
  parameters: buildMisokinesiaStoryParameters(),
} satisfies Meta<typeof MisokinesiaStoryShell>;

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
  decorators: [misokinesiaMobileDecorator],
};
