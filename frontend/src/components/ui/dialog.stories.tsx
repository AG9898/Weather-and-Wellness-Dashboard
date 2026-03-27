import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const meta = {
  title: "UI/Dialog",
  component: Dialog,
  tags: ["autodocs"],
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">Open Dialog</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Undo Last Session</DialogTitle>
          <DialogDescription>
            Review the candidate session and confirm the destructive action.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-xl border border-border/70 bg-muted/30 p-4 text-sm text-muted-foreground">
          Participant #214 is the newest native session.
        </div>
        <DialogFooter showCloseButton>
          <Button variant="destructive">Confirm Delete</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
} satisfies Meta<typeof Dialog>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
