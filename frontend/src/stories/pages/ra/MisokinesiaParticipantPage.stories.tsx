import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  MisokinesiaParticipantStoryShell,
  misokinesiaMobileDecorator,
} from "./MisokinesiaParticipantPageStorySupport";

const meta = {
  title: "Pages/Participant/MisokinesiaTask",
  component: MisokinesiaParticipantStoryShell,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen" as const,
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: "/misokinesia/demo-participant-id",
      },
    },
  },
} satisfies Meta<typeof MisokinesiaParticipantStoryShell>;

export default meta;

type Story = StoryObj<typeof meta>;

// ── Loading / error screens ──────────────────────────────────────────────────

export const Loading: Story = {
  args: { phase: "loading" },
};

export const Error: Story = {
  args: { phase: "error" },
};

// ── Demographics ─────────────────────────────────────────────────────────────

export const Demographics: Story = {
  args: { phase: "demographics" },
};

export const DemographicsAnswered: Story = {
  args: { phase: "demographics", demoAnswered: true },
};

export const DemographicsError: Story = {
  args: { phase: "demographics", demoError: true },
};

export const DemographicsSubmitting: Story = {
  args: { phase: "demographics", demoSubmitting: true },
};

// ── Intro card ───────────────────────────────────────────────────────────────

export const Intro: Story = {
  args: { phase: "intro" },
};

// ── Per-clip questionnaire ───────────────────────────────────────────────────

export const PerClipQuestionnaireEmpty: Story = {
  args: { phase: "questionnaire" },
};

export const PerClipQuestionnairePartiallyAnswered: Story = {
  args: { phase: "questionnaire", clipAnswered: 2 },
};

export const PerClipQuestionnaireAllAnswered: Story = {
  args: { phase: "questionnaire", clipAnswered: 4 },
};

export const PerClipQuestionnaireMidProgress: Story = {
  args: { phase: "questionnaire", clipNumber: 13, totalClips: 25 },
};

// ── Transition cards (before each post-video survey) ─────────────────────────

export const TransitionMkaq: Story = {
  args: { phase: "transition_mkaq" },
};

export const TransitionGad7: Story = {
  args: { phase: "transition_gad7" },
};

export const TransitionMaq: Story = {
  args: { phase: "transition_maq" },
};

// ── Carousel surveys ─────────────────────────────────────────────────────────

export const MkaqCarouselPane1: Story = {
  args: { phase: "mkaq" },
};

export const MkaqCarouselPane1Answered: Story = {
  args: { phase: "mkaq", carouselAnswered: true },
};

export const Gad7Survey: Story = {
  args: { phase: "gad7" },
};

export const Gad7SurveyPartial: Story = {
  args: { phase: "gad7", gad7Answered: 4 },
};

export const MaqCarousel: Story = {
  args: { phase: "maq" },
};

// ── End-of-task form ─────────────────────────────────────────────────────────

export const EndOfTask: Story = {
  args: { phase: "end_of_task" },
};

export const EndOfTaskWithStrongerResponses: Story = {
  args: { phase: "end_of_task", showTimingRow: true },
};

// ── Completion ───────────────────────────────────────────────────────────────

export const Complete: Story = {
  args: { phase: "complete" },
};

export const Completing: Story = {
  args: { phase: "completing" },
};

export const CompleteError: Story = {
  args: { phase: "complete_error" },
};

// ── Theme + responsive variants ───────────────────────────────────────────────

export const DemographicsDark: Story = {
  args: { phase: "demographics" },
  globals: { theme: "dark" },
};

export const PerClipDark: Story = {
  args: { phase: "questionnaire", clipAnswered: 2 },
  globals: { theme: "dark" },
};

export const TransitionMkaqDark: Story = {
  args: { phase: "transition_mkaq" },
  globals: { theme: "dark" },
};

export const MkaqDark: Story = {
  args: { phase: "mkaq", carouselAnswered: true },
  globals: { theme: "dark" },
};

export const CompleteDark: Story = {
  args: { phase: "complete" },
  globals: { theme: "dark" },
};

export const DemographicsMobile: Story = {
  args: { phase: "demographics" },
  decorators: [misokinesiaMobileDecorator],
};

export const PerClipMobile: Story = {
  args: { phase: "questionnaire", clipAnswered: 2 },
  decorators: [misokinesiaMobileDecorator],
};

export const MkaqMobile: Story = {
  args: { phase: "mkaq" },
  decorators: [misokinesiaMobileDecorator],
};

export const CompleteMobile: Story = {
  args: { phase: "complete" },
  decorators: [misokinesiaMobileDecorator],
};
