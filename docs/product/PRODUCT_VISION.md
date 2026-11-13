# Product vision

## One sentence
Help people with diabetes turn their own glucose data into something they are proud to share, in under 30 seconds, on their terms.

## Problem
Glucose data is rich and personal, but sharing it today means a raw screenshot from a clinical app. People who *want* to be open about life with diabetes (to friends, family, followers, other people with diabetes) have no quick way to make something that looks like theirs, tells the story they want, and leaks nothing they did not choose.

## Hypothesis to test
If a person can get a good-looking default graphic from their own data with almost no effort, a meaningful share of them will export it, and some will share it. If so, a community layer is worth building later. If not, we learn that cheaply.

## What this is, and is not
- **Is:** a share-first graphic maker. Local, no account, nothing posted for you.
- **Is not:** a clinical tool, a coach, a leaderboard, or a social network (yet). It gives no dosing or treatment advice and does not judge numbers.

## Principles
1. **Privacy by construction.** Files are parsed in the browser. Analytics cannot carry health values (closed enum spec). No auto-publishing.
2. **Show exactly what is shared.** A live "What's on this image" list matches the export.
3. **Every number is optional.** A graphic can be just a line, or just words.
4. **No worth in numbers.** No grades, ranks, streak guilt, or red/green success colouring. Range bands are always labelled in words.
5. **Humour is the person's voice.** Tone presets are starting points, are never about unsafe management, and are fully editable.
6. **Honest about gaps.** Missing data is drawn as empty and annotated, never interpolated.
7. **Own look.** No copied layouts or branding from other apps.

## Naming
The product is currently "Gluca" (one constant in `src/brand.ts`). Earlier briefs also used "GlucoClub". Decision needed from the owner.
