# Claude: creative direction and design pass

The owner explicitly reserves creative decoration for Claude. Existing styling and template compositions are functional placeholders. Keep the data, export, navigation, accessibility, and privacy behavior intact while revisiting visual design.

## Start here — ready-to-use prompt

> Act as Gluca's product designer. Inspect README.md, src/ui.tsx, src/screens.tsx, src/story.ts and the Expo Router layouts. Design a distinctive consumer social experience for adults living with diabetes. The product celebrates participation and lived experience, without tying personal worth to glucose values. Develop original visual language, typography, icons, layout, light/dark tokens, and story compositions. Preserve working interactions, labels, missing-data gaps, source attribution, private defaults, explicit publishing preview, export dimensions and transparent backgrounds. Do not introduce clinical advice, rankings, health trackers, paid assets, or copied Strava/Instagram layouts. Deliver the changes in small reviewable passes and run type checking, tests and web export after each pass.

## Design backlog and targeted prompts

| Area / implementation anchor | Prompt for Claude | Constraints to preserve |
| --- | --- | --- |
| Brand and tokens — src/ui.tsx | Explore two original brand directions; select one and implement complete typography, spacing, color, radii, controls and states. | Suggested palette is optional. Contrast and 44+ point touch targets are required. Use licensed assets and document sources. |
| Feed — PostCard, Home in src/screens.tsx | Design an engaging editorial social feed with clear author hierarchy, optional content modules and compact actions. Add avatar treatment and purposeful spacing. | No health numbers by default; distinguish visibility, demo content and local reporting. |
| Navigation — app/(tabs)/_layout.tsx | Replace placeholder circles with a coherent licensed icon family and design a prominent Create action. | Keep five tabs, accessible labels, mobile widths and web keyboard use. |
| Dashboard — Glucose | Refine chart axes, labels, selection affordance, coverage hierarchy and typography. | Never smooth away gaps or imply a partial interval is complete; don't encode personal success with red/green. |
| Story canvas — src/story.ts | Design original Day in Range, transparent trace, Win, Workload and Roller Coaster compositions. Build reusable layout primitives. | Exact 1080×1920 / 1350 / 1080 PNGs; transparent overlay alpha; keep essential content within conservative 250 px top/bottom story margins. |
| Remaining templates | Design Workout, Dia-versary, Wrapped sequence and Awareness after their input models exist. | Only supported/user-entered metrics. Awareness claims need reputable sources and review. Never invent insulin/task counts. |
| Story editor — Create | Design controls, selected states, artwork preview, color selection and later photo-background editing. | Export artwork only. Disclose what is published versus merely downloaded. No claim of direct Instagram publishing. |
| Explore / Profile | Design club identity, member avatars, achievements and personal moments without outcome competition. | Fictional data remains labeled; health profile fields stay optional and private. |
| Motion | Propose restrained Reanimated transitions, kudos feedback and export progress. | Implement later with reduced-motion support and compatible Expo dependencies; no streak pressure. |
| Art / photography | Define art direction and image-generation briefs for optional photo/illustration assets. | No bitmap assets have been generated. Keep export graphics sharp; no health data embedded in external asset prompts. |

## Acceptance for the visual pass

- Inspect at 375 px, 430 px and desktop widths, light and dark; no clipped text or unreachable controls.
- Export real PNGs, check dimensions, transparency, and safe areas; inspect readability after downsampling.
- Preserve tests. Add visual checks when a layout change affects exporting.
- Resolve naming to **Gluca** throughout; the source brief's GlucoClub references are treated as stale working-name references.
- Current story text layout is provisional and only supports a short caption. Improve text wrapping and long localized dates before production.
- Do not present deferred features as working. Design empty/loading/error/offline states around real capabilities.
