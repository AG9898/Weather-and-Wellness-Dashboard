import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  buildDigitSpanStoryParameters,
  DigitSpanStoryShell,
  digitSpanMobileDecorator,
} from "./DigitSpanPageStorySupport";

const meta = {
  title: "Pages/RA/Digit Span",
  component: DigitSpanStoryShell,
  tags: ["autodocs"],
  parameters: buildDigitSpanStoryParameters(),
} satisfies Meta<typeof DigitSpanStoryShell>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Startup: Story = {};

export const Question: Story = {
  args: {
    state: "question",
  },
};

export const StartupDark: Story = {
  globals: {
    theme: "dark",
  },
};

export const QuestionMobile: Story = {
  args: {
    state: "question",
  },
  decorators: [digitSpanMobileDecorator],
};
