import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const meta = {
  title: "UI/Select",
  component: Select,
  tags: ["autodocs"],
  render: () => {
    const [value, setValue] = useState("dashboard");

    return (
      <div className="w-full max-w-sm">
        <Select value={value} onValueChange={setValue}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Choose a destination" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>RA navigation</SelectLabel>
              <SelectItem value="dashboard">Dashboard</SelectItem>
              <SelectItem value="new-session">New Session</SelectItem>
              <SelectItem value="import-export">Import / Export</SelectItem>
              <SelectSeparator />
              <SelectItem value="misokinesia">Misokinesia</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
    );
  },
} satisfies Meta<typeof Select>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
