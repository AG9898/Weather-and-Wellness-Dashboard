import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import CloudLoading from "@/lib/components/CloudLoading";

const meta = {
  title: "Components/CloudLoading",
  component: CloudLoading,
  tags: ["autodocs"],
  args: {
    size: "md",
  },
} satisfies Meta<typeof CloudLoading>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-4 text-primary">
      <CloudLoading size="sm" />
      <CloudLoading size="md" />
      <CloudLoading size="lg" />
    </div>
  ),
};
