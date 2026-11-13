# Skills and expertise

Two kinds of skill matter here: agent skills (packaged instructions an AI agent loads before a task) and human expertise that no agent should stand in for.

## Agent skills by milestone

Names are the skill identifiers available in Claude at the time of writing (November 2026). Load a skill before starting the work it covers. If a skill is not installed, the Expo docs at https://docs.expo.dev cover the same ground.

| Milestone | Load these skills | Why |
| --- | --- | --- |
| Any Expo work | `expo:expo-overview` | Entry point; routes to the right Expo skill and holds shared setup rules |
| M0 Baseline | `expo:expo-overview`, `expo:expo-upgrade` | Running, dependency checks, fixing SDK mismatches |
| M1 Brand | `frontend-design`, `expo:expo-design-system` | Mark drawing, tokens, icon config |
| M2 Split screens | `expo:expo-router`, `expo:expo-design-system` | Route conventions, where files belong, extracting shared components. Do not use `expo:expo-project-structure` to restructure; it is for new projects |
| M3 Data layer | `expo:expo-data-fetching` | TanStack Query patterns for readings |
| M4 First run and flags | `expo:expo-router`, `expo:expo-native-ui` | Welcome route, first-launch redirect, native-feeling entry screen |
| M5 Create polish | `expo:expo-ui`, `expo:expo-native-ui`, `expo:expo-animation`, `dataviz` | Bottom sheet, pickers, native controls, press feedback, chart legibility |
| M6 Design pass | `frontend-design`, `expo:expo-design-system`, `expo:expo-native-ui`, `dataviz` | Visual direction, token discipline, platform styling, the glucose chart |
| M7 Device tests | `expo:expo-dev-client`, `expo:eas-simulator` | Development builds; cloud simulators when no Mac is available |
| M8 Event logging | `expo:expo-router` (form sheet reference), `expo:expo-ui`, `expo:expo-animation` | Slide-up sheet, wheel pickers, gesture handoff |
| M10 Backend | `expo:expo-examples` (the Supabase example), `expo:expo-data-fetching` | Canonical Supabase integration pattern |
| M10 Release | `expo:eas-app-stores`, `expo:eas-update`, `expo:eas-workflows`, `expo:eas-hosting` | Store builds and submission, over-the-air updates, CI, web hosting. All are paid EAS services and need the owner's approval |

Skills that help across the project:

- `frontend-design`: use whenever a screen is being designed, to avoid generic-looking UI.
- `dataviz`: use before touching any chart, stat tile or colour-by-meaning choice. It reinforces the rule that colour is never the only signal.
- `docs`, `docx`, `pdf`: for owner-facing documents such as a validation report or a privacy policy draft.
- `skill-creator`: if the same multi-step procedure keeps recurring (for example "add a new story template"), package it as a project skill. A good first candidate is described below.

## A project skill worth creating: "add a story template"

The steps are always the same, so they suit a packaged skill:

1. Add the id to `TemplateId` in `src/art/telemetry.ts` and to `TEMPLATE_ORDER` and `TEMPLATE_INFO` in `src/art/templates.ts`.
2. Add `defaultShow` and default copy for it (`src/art/templates.ts`, `src/art/copy.ts`).
3. Add a `case` in `buildArtwork` that draws inside `Y0..bodyEnd`, calls `note()` for every visible element, and sets `usedY`.
4. Give sizes per format with `pick(story, portrait, square)`.
5. Run `npm test`: the template loop asserts exact size and zero overflow for every format.
6. Render all three formats and look at them before calling it done.

## Human expertise

| Need | When | Why an agent is not enough |
| --- | --- | --- |
| Trademark attorney | Before any public name use | Clearance search for "Gluca", including unreleased products |
| Clinician or certified diabetes educator | M9, and before any educational copy ships | Safety of wording; avoiding stigma and unsafe encouragement |
| People living with diabetes | M9 and every design pass after | Whether the tone, humour and templates feel like theirs |
| Privacy counsel | Before M10 | Health-data law, policy and store requirements; no compliance claim is made today |
| Security reviewer | M10 | Row-level security, token handling, storage encryption |
| Accessibility tester | M6 and M7 | Screen reader, large text and contrast on real devices |
| Brand or visual designer | M1 and M6, optional | Refining the mark and type beyond what was built here |

## Working style that suits this project

- Small, verified steps. The codebase is small enough to read before editing.
- Look at the output. Type checks do not catch a headline that collides with a footer; rendering does.
- Say what was not verified. The owner tests on a phone and relies on accurate status.
- Ask the owner before anything in the "needs approval" list in `AGENTS.md`.
