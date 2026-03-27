import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Input } from "@/components/ui/input";

const meta = {
  title: "UI/Input",
  component: Input,
  tags: ["autodocs"],
  args: {
    placeholder: "Participant email",
  },
  render: (args) => (
    <div className="w-full max-w-sm">
      <Input {...args} />
    </div>
  ),
} satisfies Meta<typeof Input>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Filled: Story = {
  args: {
    defaultValue: "ra@psych.ubc.ca",
  },
};

export const Invalid: Story = {
  args: {
    "aria-invalid": true,
    defaultValue: "invalid-email",
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    defaultValue: "Locked field",
  },
};
