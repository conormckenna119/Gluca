# Trophy Cabinet - Stage 8A

Enable achievements, open Profile -> Trophy Cabinet. Existing original Medal SVGs use consistent round silhouettes, category ribbons and small glyphs, distinct from experience shields. Earned medals use material/colour; upcoming medals use dashed outlines and explicit not-earned labels. Upcoming is optional and hidden by default. No rarity, rank, health progress or loss notifications.

Tap an earned medal for award date, source/eligibility, visibility, pin and Share. Share opens the existing Create milestone template with the name only. No snapshot, diagnosis date, glucose or event ID enters that route. Preview the image and its contents before exporting; nothing is automatically posted. Pins appear beneath the owner profile header; Arrange pinned medals reveals Move earlier/later controls to reorder up to three without drag-only interaction.

Pinning, per-medal visibility and Public collection are independent choices. New collections and medals are private. Individual hiding excludes a medal from public profiles, while keeping it in the owner's collection. Public profile responses include individually public medals only after collection opt-in; they expose registry name/icon/category and year, never exact award date, private source details or account IDs. Public profile details are nonmedical and read-only. Shield privacy is separate.

Personal moments reuses the existing confirmation sheet for Awareness and Personal Milestone; this is not a new challenge system. Unlock notices can be dismissed; View opens the specific earned medal. A subtle 180ms scale animation waits for reduced-motion preference, responds to changes and stops on cleanup. No glow or shine. Shared sheets and persistent navigation are reused.

## QA and limitations

The browser test uses an isolated fictional account and actual synthetic PNG download, confirmations, pinning/reordering, privacy, reload and logout. Twelve cabinet/detail screenshots at 375/430/1280px in light/dark are generated under docs/screenshots/stage8a. They contain fictional fixtures only. Final verified results are recorded in ACHIEVEMENT_SYSTEM.md.

Physical iOS/Android tests remain open: dynamic reduced motion, screen-reader announcements, photo-library permissions/save failure, native Log and compact sheet reachability. Native account support remains gated; guest awards are ephemeral. No durable offline queue or independently verified community service exists. Existing authentication/key/backup/HTTPS production gates still apply.

Creative note for Claude: original existing medal artwork was reused. Future visual polish should keep equal dimensions, legible glyphs, restrained transitions and separation from experience shields; avoid status/rarity styling.
