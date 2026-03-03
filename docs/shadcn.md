# shadcn.md — Component Library Guide (CLI Agent)

> **Related docs:** [styleguide.md](styleguide.md) · [animejs.md](animejs.md) (imperative animation)

Use this guide for all `shadcn/ui` work in this repo. It defines how to install, add, and style components consistently with our existing UI conventions.

## 1) Official References

- Installation (general): https://ui.shadcn.com/docs/installation
- Installation (Next.js): https://ui.shadcn.com/docs/installation/next
- Manual install reference: https://ui.shadcn.com/docs/installation/manual
- Theming: https://ui.shadcn.com/docs/theming

Notes from official docs (verified via Context7):
- Initialize with `npx shadcn@latest init`.
- Add components with `npx shadcn@latest add <component>`.
- Tailwind v4 projects should keep `tailwind.config` empty in `components.json`.
- `cssVariables: true` is the recommended theming path.

## 2) Project Baseline (Current Repo)

The frontend is already initialized.

- Config file: `frontend/components.json`
- Global theme tokens: `frontend/src/app/globals.css`
- Utility helper: `frontend/src/lib/utils.ts` (`cn`)
- UI component target path: `frontend/src/components/ui/*`

Current `components.json` baseline:
- `style`: `new-york`
- `iconLibrary`: `lucide`
- `tailwind.baseColor`: `neutral`
- `tailwind.css`: `src/app/globals.css`
- `tailwind.config`: `""` (correct for Tailwind v4)
- Aliases:
  - `components`: `@/components`
  - `ui`: `@/components/ui`
  - `utils`: `@/lib/utils`
  - `lib`: `@/lib`
  - `hooks`: `@/hooks`

## 3) Standard Agent Workflow

Run all commands from `frontend/`.

1. Add a component:
   - `npx shadcn@latest add button`
2. Import from `@/components/ui/...`.
3. Prefer semantic theme classes in usage (`bg-background`, `text-foreground`, `border-border`, `ring-ring`).
4. Validate:
   - `npm run lint`
   - `npm run build`

## 4) Styling and Consistency Rules

Use shadcn as the component primitive layer, but match this project's style language in `docs/styleguide.md`.

- Keep component structure/variants from shadcn unless there is a concrete product need.
- Prefer adjusting semantic CSS variables in `src/app/globals.css` over hardcoding random hex values in component files.
- Keep visual tone aligned with current guide:
  - light-first, calm, data-oriented surfaces
  - tonal dark theme (when enabled) derived from the same hues
  - UBC token usage from `docs/styleguide.md`
  - clear focus/hover/disabled states
- When composing new UI:
  - Use shadcn components for interactive primitives (button, dialog, select, input, etc.).
  - Use Tailwind utilities for layout/spacing.
  - Avoid duplicating primitive behavior in ad-hoc custom components.

## 5) Theme Token Guidance

shadcn components consume semantic tokens such as:
- `--background`, `--foreground`
- `--card`, `--card-foreground`
- `--primary`, `--primary-foreground`
- `--secondary`, `--muted`, `--accent`, `--border`, `--input`, `--ring`

For this project:
- Keep these semantic tokens as the source of truth for component colors.
- Map them to the brand direction defined in `docs/styleguide.md` (UBC palette) when doing visual updates.
- Do not change `style`, `baseColor`, or icon library casually; treat those as system-level decisions.

## 6) Do / Don't for CLI Agents

Do:
- Use the CLI (`npx shadcn@latest add ...`) instead of manually copying from the website.
- Keep edits local to needed components and call sites.
- Preserve existing aliases and file locations.

Don't:
- Introduce another component library for primitives that shadcn already provides.
- Rewrite generated components for purely cosmetic reasons without a product requirement.
- Bypass semantic tokens with widespread hardcoded color overrides.
