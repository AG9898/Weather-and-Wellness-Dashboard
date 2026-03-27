import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Badge } from "@/components/ui/badge";

const meta = {
  title: "UI/Badge",
  component: Badge,
  tags: ["autodocs"],
  args: {
    children: "Ready",
    variant: "default",
  },
} satisfies Meta<typeof Badge>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Variants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge>Primary</Badge>
      <Badge variant="secondary">Secondary</Badge>
      <Badge variant="outline">Outline</Badge>
      <Badge variant="ghost">Ghost</Badge>
      <Badge variant="destructive">Error</Badge>
      <Badge variant="link">Linked</Badge>
    </div>
  ),
};

export const LongLabel: Story = {
  args: {
    variant: "outline",
    children: "Mixed-model recompute still in progress",
  },
};
