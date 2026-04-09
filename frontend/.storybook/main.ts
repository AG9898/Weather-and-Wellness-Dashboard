import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { StorybookConfig } from "@storybook/nextjs-vite";

const storybookDir = dirname(fileURLToPath(import.meta.url));

const config: StorybookConfig = {
  stories: ["../src/stories/pages/ra/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
  addons: [
    "@chromatic-com/storybook",
    "@storybook/addon-vitest",
    "@storybook/addon-a11y",
    "@storybook/addon-docs",
  ],
  framework: "@storybook/nextjs-vite",
  staticDirs: ["../public"],
  async viteFinal(baseConfig) {
    const existingAliases = baseConfig.resolve?.alias ?? [];
    const alias = Array.isArray(existingAliases)
      ? [
          ...existingAliases,
          {
            find: "@/lib/supabase",
            replacement: resolve(storybookDir, "./mocks/supabase.ts"),
          },
        ]
      : {
          ...existingAliases,
          "@/lib/supabase": resolve(storybookDir, "./mocks/supabase.ts"),
        };

    return {
      ...baseConfig,
      resolve: {
        ...baseConfig.resolve,
        alias,
      },
    };
  },
};

export default config;
