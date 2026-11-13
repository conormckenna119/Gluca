# Success metrics

## What can be measured today
The app records closed-spec events only when telemetry is `local` (in-tab, never sent). No persistent ID exists. So today, metrics come from moderated sessions and the in-tab counter, not from a live dashboard.

| Metric | Source | Measurable now? |
| --- | --- | --- |
| Time to first graphic (target < 30 s) | e2e: 60 ms from demo tap; sessions for real import | Yes (sessions) |
| Demo vs import rate | `demo_started`, `import_succeeded` | Per session only |
| Import failure reasons | `import_failed` enum | Per session only |
| Template chosen | `template_selected` | Per session only |
| Customisation rate | `customization_opened` | Per session only |
| Export rate | `export_started` / `export_succeeded` / `export_failed` | Per session only |
| Format mix incl. transparent | `format` enum | Per session only |
| Share sheet opened | `share_sheet_opened` | Per session only |
| Self-reported shared / felt represented | `feedback_submitted` | Per session only |
| Return to create another | needs a persistent ID | **No** (by design) |
| Actually posted | no browser can tell | **No** |

## Targets for validation (not vanity)
- ≥ 60% of testers import their own file. ≥ 50% export without editing. Felt represented ≥ 4/5.
- Zero reports of unwanted exposure.

## Guardrails
- No health values, filenames, captions or identifiers in analytics (enforced by type and tests).
- A share sheet opening is never reported as a post.
- A remote analytics provider needs a privacy review, explicit consent copy and an owner decision before being added.
