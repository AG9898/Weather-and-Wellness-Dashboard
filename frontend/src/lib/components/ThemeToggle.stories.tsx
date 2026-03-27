import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import ThemeToggle from "@/lib/components/ThemeToggle";

const meta = {
  title: "Components/ThemeToggle",
  component: ThemeToggle,
  tags: ["autodocs"],
  args: {
    variant: "button",
  },
} satisfies Meta<typeof ThemeToggle>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ButtonVariant: Story = {};

export const MenuVariant: Story = {
  args: {
    variant: "menu",
  },
  render: (args) => (
    <div className="w-full max-w-xs rounded-3xl border border-border/70 bg-card p-3">
      <ThemeToggle {...args} />
    </div>
  ),
};
