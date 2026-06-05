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

export const DemographicsConsentGate: Story = {
  args: { phase: "demographics" },
};

export const DemographicsBlock1Basics: Story = {
  args: { phase: "demographics", demoAnswered: true, demoPaneIndex: 0 },
};

export const DemographicsBlock2ResidenceSliders: Story = {
  args: { phase: "demographics", demoAnswered: true, demoPaneIndex: 1 },
};

export const DemographicsBlock3LanguageOther: Story = {
  args: { phase: "demographics", demoAnswered: true, demoPaneIndex: 3 },
};

export const DemographicsBlock4ClinicalOther: Story = {
  args: { phase: "demographics", demoAnswered: true, demoPaneIndex: 5 },
};

export const DemographicsBlock5LifestyleConditional: Story = {
  args: { phase: "demographics", demoAnswered: true, demoPaneIndex: 6 },
};

export const DemographicsValidationBlocked: Story = {
  args: {
    phase: "demographics",
    demoPaneIndex: 0,
    demoValidationAttempted: true,
  },
};

export const DemographicsError: Story = {
  args: {
    phase: "demographics",
    demoPaneIndex: 7,
    demoError: true,
  },
};

export const DemographicsSubmitting: Story = {
  args: {
    phase: "demographics",
    demoPaneIndex: 7,
    demoSubmitting: true,
  },
};

// ── Intro card ───────────────────────────────────────────────────────────────

export const Intro: Story = {
  args: {
    phase: "intro",
    trialMode: true,
    trialVariant: "short",
    totalClips: 5,
  },
};

export const IntroFullTrial: Story = {
  args: {
    phase: "intro",
    trialMode: true,
    trialVariant: "full",
    totalClips: 25,
  },
};

// ── Per-clip questionnaire ───────────────────────────────────────────────────

export const PerClipQuestionnaireEmpty: Story = {
  args: {
    phase: "questionnaire",
    trialMode: true,
    trialVariant: "short",
    totalClips: 5,
  },
};

export const PerClipQuestionnairePartiallyAnswered: Story = {
  args: {
    phase: "questionnaire",
    clipAnswered: 2,
    trialMode: true,
    trialVariant: "short",
    totalClips: 5,
  },
};

export const PerClipQuestionnaireAllAnswered: Story = {
  args: {
    phase: "questionnaire",
    clipAnswered: 4,
    trialMode: true,
    trialVariant: "short",
    totalClips: 5,
  },
};

export const PerClipQuestionnaireMidProgress: Story = {
  args: {
    phase: "questionnaire",
    clipNumber: 13,
    totalClips: 25,
    trialMode: true,
    trialVariant: "full",
  },
};

export const RecordedSessionQuestionnaire: Story = {
  args: {
    phase: "questionnaire",
    clipNumber: 13,
    totalClips: 25,
    trialMode: false,
    trialVariant: "full",
  },
};

// ── Transition cards (before each post-video survey) ─────────────────────────

export const TransitionMkaq: Story = {
  args: { phase: "transition_mkaq", trialMode: true, trialVariant: "short" },
};

export const TransitionGad7: Story = {
  args: { phase: "transition_gad7", trialMode: true, trialVariant: "short" },
};

export const TransitionMaq: Story = {
  args: { phase: "transition_maq", trialMode: true, trialVariant: "short" },
};

// ── Carousel surveys ─────────────────────────────────────────────────────────

export const MkaqCarouselPane1: Story = {
  args: { phase: "mkaq", trialMode: true, trialVariant: "short" },
};

export const MkaqCarouselPane1Answered: Story = {
  args: {
    phase: "mkaq",
    carouselAnswered: true,
    trialMode: true,
    trialVariant: "short",
  },
};

export const MkaqFullTrial: Story = {
  args: { phase: "mkaq", trialMode: true, trialVariant: "full" },
};

export const Gad7Survey: Story = {
  args: { phase: "gad7", trialMode: true, trialVariant: "short" },
};

export const Gad7SurveyPartial: Story = {
  args: {
    phase: "gad7",
    gad7Answered: 4,
    trialMode: true,
    trialVariant: "short",
  },
};

export const MaqCarousel: Story = {
  args: { phase: "maq", trialMode: true, trialVariant: "short" },
};

export const MaqFullTrial: Story = {
  args: { phase: "maq", trialMode: true, trialVariant: "full" },
};

// ── End-of-task form ─────────────────────────────────────────────────────────

export const EndOfTask: Story = {
  args: { phase: "end_of_task", trialMode: true, trialVariant: "short" },
};

export const EndOfTaskWithStrongerResponses: Story = {
  args: {
    phase: "end_of_task",
    showTimingRow: true,
    trialMode: true,
    trialVariant: "short",
  },
};

// ── Completion ───────────────────────────────────────────────────────────────

export const Complete: Story = {
  args: { phase: "complete", trialMode: true, trialVariant: "short" },
};

export const Completing: Story = {
  args: { phase: "completing" },
};

export const CompleteError: Story = {
  args: { phase: "complete_error" },
};

// ── Theme + responsive variants ───────────────────────────────────────────────

export const DemographicsDark: Story = {
  args: { phase: "demographics", demoAnswered: true, demoPaneIndex: 3 },
  globals: { theme: "dark" },
};

export const PerClipDark: Story = {
  args: {
    phase: "questionnaire",
    clipAnswered: 2,
    trialMode: true,
    trialVariant: "short",
  },
  globals: { theme: "dark" },
};

export const TransitionMkaqDark: Story = {
  args: { phase: "transition_mkaq", trialMode: true, trialVariant: "short" },
  globals: { theme: "dark" },
};

export const MkaqDark: Story = {
  args: {
    phase: "mkaq",
    carouselAnswered: true,
    trialMode: true,
    trialVariant: "short",
  },
  globals: { theme: "dark" },
};

export const CompleteDark: Story = {
  args: { phase: "complete" },
  globals: { theme: "dark" },
};

export const DemographicsMobile: Story = {
  args: { phase: "demographics", demoAnswered: true, demoPaneIndex: 1 },
  decorators: [misokinesiaMobileDecorator],
};

export const PerClipMobile: Story = {
  args: {
    phase: "questionnaire",
    clipAnswered: 2,
    trialMode: true,
    trialVariant: "short",
  },
  decorators: [misokinesiaMobileDecorator],
};

export const MkaqMobile: Story = {
  args: { phase: "mkaq", trialMode: true, trialVariant: "short" },
  decorators: [misokinesiaMobileDecorator],
};

export const CompleteMobile: Story = {
  args: { phase: "complete" },
  decorators: [misokinesiaMobileDecorator],
};
