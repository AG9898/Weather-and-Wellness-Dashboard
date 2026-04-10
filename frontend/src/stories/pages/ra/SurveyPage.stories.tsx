import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  buildSurveyStoryParameters,
  SurveyStoryShell,
  surveyMobileDecorator,
} from "./SurveyPageStorySupport";

const meta = {
  title: "Pages/RA/Survey",
  component: SurveyStoryShell,
  tags: ["autodocs"],
  parameters: buildSurveyStoryParameters(),
} satisfies Meta<typeof SurveyStoryShell>;

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
  decorators: [surveyMobileDecorator],
};
