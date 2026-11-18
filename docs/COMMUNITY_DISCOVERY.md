# Discover communities — Stage 9B

Discover lives in the existing Explore/Community area. The existing five primary tabs are unchanged. Search and category filters work without completing onboarding or providing medical information; signing in is required to join and view member content. Suggestions never enroll anyone.

## Configured communities

| ID | Community | Category |
| --- | --- | --- |
| dexcom-g7 | Dexcom G7 users | Devices |
| tandem | Tandem users | Devices |
| omnipod | Omnipod users | Devices |
| twiist | twiist users | Devices |
| libre | Libre users | Devices |
| mdi | Multiple daily injection users | Devices |
| newly-diagnosed-t1d | Newly diagnosed with T1D | Experience |
| long-term-t1d | Long-term diabetes community | Experience |
| diabetic-runners | Running and fitness | Activity |
| supporters | Caregivers and supporters | Support |
| parents-caregivers | Parents and caregivers | Support |
| advocacy | Awareness and advocacy | Support |

The existing stable IDs/catalogue definitions are reused where available. The account presentation is configured in `src/domain/community-discovery.ts`; the older local catalogue/functions remain intact for fictional demos and historical local data. Never rename/reuse an ID to move users into a different community. Configure a new entry instead; the shared discovery/detail/feed components need no separate page implementation.

## Owner-only suggestions

`recommendedCommunityIds(profile, today, joined)` is a pure, local function. It receives only the current user's voluntarily supplied Profile fields, not glucose readings or Dexcom connection state. The server returns the same catalogue to everyone; it does not receive recommendation reasons or private matching attributes. No recommendation analytics, third-party calls, automatic memberships or public medical labels are created.

- Explicit living-with-diabetes role plus reported CGM/delivery choices can suggest device groups. A reported G7 is not treated as an authorized Dexcom connection.
- Exact, non-approximate diagnosis dates can suggest the first-year T1D community. Month/year-only and year-only dates are not converted into a fabricated first anniversary.
- Conservative existing shield-year calculations can suggest the long-term group across diabetes types. Prefer-not-to-say diabetes type does not trigger a diagnosis-based suggestion.
- Voluntary running/fitness interests can suggest the activity group for either people with diabetes or supporters.
- Supporter/caregiver/awareness/advocacy choices can suggest corresponding groups without requiring diabetes, insulin or Dexcom.
- Unknown roles, missing attributes and prefer-not-to-say device/treatment choices are not filled in. Optional interests remain independently usable.

The account onboarding preview uses the same recommendation function (up to three names); it still does not join anything. At most four unjoined suggestions are shown in catalogue order. Suggested cards use generic owner-only copy; they do not expose the matching diagnosis/device/treatment reason. Already suggested cards are not duplicated in the unfiltered Browse list. Search and categories show all matching communities, and My communities shows explicit memberships only.

## Interaction and privacy

Cards show name, short description, category, public member count and clear Joined/private/public state. Opening a card does not join. Join defaults private; leaving requires confirmation. Membership visibility uses both per-group opt-in and existing global profile privacy. See `COMMUNITY_SYSTEM.md` for the count/list gates, authorization, publishing and moderator permissions.

Account screens no longer inherit misleading Fictional community/Synthetic glucose labels. The explicitly expanded legacy demo retains those labels, and every synthetic glucose graphic keeps its mandatory simulation label. Shared design tokens, touch-friendly controls, reduced-motion-compatible existing interaction feedback and the persistent application shell are reused. Decorative artwork has not been added as a separate design system.

## Manual check

1. Open Explore with an empty/prefer-not-to-say profile; browse/search all 12 groups.
2. Add optional interests/device fields to a fictional account. Verify suggestions appear only to that owner, and another account's public profile response does not expose those private attributes.
3. Open a community without joining. Verify no member feed is fetched/displayed.
4. Join, verify private status/zero public count, then enable per-group visibility. With global membership privacy off, the public directory must still exclude the membership.
5. Explicitly enable global membership sharing; check the public profile/list from another account. Disable either switch and verify removal.
6. Publish only synthetic text/photo/story fixtures. Verify member-only image reads, comments and Boosts; leave from the second account and verify access is revoked.
7. Inspect 375/430/1280px light/dark layouts, search wrapping, safe-area navigation and named member/report/leave sheets.

Automated discovery, permission, membership, publishing, moderation and regression evidence is recorded in `COMMUNITY_SYSTEM.md`. No production moderation staffing, native device test or live Dexcom success is implied by a mocked test.
