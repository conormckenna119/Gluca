# Gluca device tests

This is a checklist for testing Gluca on real phones. It is for the owner to fill in while holding the phones.
As of 2026-11-13 nothing here has been run on a phone yet, so every result cell is blank.
For each check, record Pass, Fail or Not tested in the matching cell, and add a short note. Log any failure in the table at the end and in `docs/PROJECT_MAP.md` known problems.

## Before you start

1. Test in the phone browser first. On the computer run `npm run web` and leave it running. Run `ipconfig` and note the IPv4 address. On the phone, open `http://<your-IPv4-address>:8081`.
2. Then try Expo Go. Run `npm start` and scan the QR code. If the phone can't reach the computer, run `npx expo login` once, then `npx expo start --tunnel`.
3. If Expo Go does not open the project, make a development build. Android: `npx expo install expo-dev-client`, then `eas build --profile development --platform android`. iPhone: `eas build --profile development --platform ios` (needs a paid Apple Developer account). Then run `npm start` and open the project from the dev build.
   A development build uses an Expo account and the EAS build service, which can cost money. That is the owner's decision; do not start one without it.
4. The photo picker, saving to the photo library and fonts may need a development build rather than Expo Go. This is not confirmed yet.

## Devices

Fill in one row for an iPhone and one row for an Android phone. Add more rows if you test more phones.

| Device | OS version | Browser or build | Date | Tester |
| --- | --- | --- | --- | --- |
|  |  |  |  |  |
|  |  |  |  |  |

## App basics

| # | Check | How to do it | iPhone result | Android result | Notes |
| --- | --- | --- | --- | --- | --- |
| A1 | App opens | Open Gluca from its icon or the browser address and wait for the first screen. |  |  |  |
| A2 | Welcome screen shows once | Close the app fully, reopen it, and check the welcome screen does not come back. |  |  |  |
| A3 | Every tab renders | Tap Home, My Glucose, Create, Explore and Profile in turn. Each one should show content. |  |  |  |
| A4 | Safe areas on a notched phone | Check no text or buttons sit under the notch, status bar or home bar. |  |  |  |
| A5 | Dark and light theme | Switch the theme in Settings and check every screen you can read clearly in both. |  |  |  |

## Create

| # | Check | How to do it | iPhone result | Android result | Notes |
| --- | --- | --- | --- | --- | --- |
| C1 | Preview is correct | Open Create and check the preview shows the trace and numbers you expect. |  |  |  |
| C2 | Inter typeface | Look at the preview text and check it looks like Inter, not the phone's usual font. |  |  |  |
| C3 | Trace glow visible | Check a soft glow sits behind the trace in the preview. |  |  |  |
| C4 | Template thumbnails scroll | Swipe the template strip sideways and check all six templates appear with labels. |  |  |  |
| C5 | Previous and next day | Tap previous day and next day. The date and preview should change. |  |  |  |
| C6 | "Choose a day" sheet | Tap the date, pick a day, and check the sheet closes and the day changes. |  |  |  |
| C7 | Customize sheet | Open Customize, scroll to the bottom, then close it. |  |  |  |
| C8 | Story export | Choose Story and export. Check you see a clear success line. |  |  |  |
| C9 | Portrait export | Choose Portrait and export. Check you see a clear success line. |  |  |  |
| C10 | Square export | Choose Square and export. Check you see a clear success line. |  |  |  |
| C11 | Exact pixel size | Open the saved image's file details. Story should be 1080 by 1920, Portrait 1080 by 1350, Square 1080 by 1080. |  |  |  |
| C12 | Transparent PNG keeps transparency | Turn on transparent export, save it, and view it over a coloured background. The colour should show through. |  |  |  |
| C13 | Pick a photo background | Choose Transparent overlay, tap the photo background control, and pick a photo from the library. |  |  |  |
| C14 | Photo shows in preview | Check the chosen photo appears behind the trace in the preview. |  |  |  |
| C15 | Photo is in the export | Export and open the saved image. It should contain the photo. |  |  |  |
| C16 | Photo permission refused | Deny photo access. Check a clear message appears, with no crash or blank screen. |  |  |  |

## Sharing

| # | Check | How to do it | iPhone result | Android result | Notes |
| --- | --- | --- | --- | --- | --- |
| S1 | Share sheet opens with the image | After an export, tap share. The system share sheet should open with the image attached. |  |  |  |
| S2 | Save to photo library works | Choose save, allow the permission prompt, then find the image in Photos or Gallery. |  |  |  |
| S3 | Save refused fails gracefully | Deny the save permission. Check a clear message appears and the app does not crash. |  |  |  |
| S4 | Never says "posted" | Read every message shown after sharing. None should say posted or published. |  |  |  |

## In other apps

| # | Check | How to do it | iPhone result | Android result | Notes |
| --- | --- | --- | --- | --- | --- |
| O1 | Story inside Instagram | Share a Story image to Instagram Stories and check it looks right. |  |  |  |
| O2 | Story inside one other app | Share the same image to one other app, such as Messages or Photos. |  |  |  |
| O3 | Safe margins hold | In each app, check the text and trace are not covered by the app's own top or bottom controls. |  |  |  |
| O4 | What each app does with transparency | Share a transparent PNG to each app. Note whether it shows black, white or keeps transparency. |  |  |  |

## Import

| # | Check | How to do it | iPhone result | Android result | Notes |
| --- | --- | --- | --- | --- | --- |
| I1 | CSV import through the document picker | Put `samples/synthetic-clarity.csv` on the phone (synthetic data only, never a real export). Open Import and pick it. |  |  |  |
| I2 | Review step shows counts | After picking the file, check the review step shows how many rows were read and used. |  |  |  |
| I3 | Confirm import | Confirm the import and check the data appears in My Glucose. |  |  |  |
| I4 | Remove imported data | Use the remove option, confirm it, and check the imported data is gone. |  |  |  |

## Other screens

| # | Check | How to do it | iPhone result | Android result | Notes |
| --- | --- | --- | --- | --- | --- |
| R1 | Home feed | Scroll Home. Each card should show avatar, name, time, title and caption. |  |  |  |
| R2 | Post actions | Tap kudos, comment and save on a post. Each should change state and read clearly. |  |  |  |
| R3 | Empty states | On a test install only, clear the data and look at Home and My Glucose. |  |  |  |
| R4 | Post "More options" sheet | Tap More options on a post. The sheet should open and close cleanly. |  |  |  |
| R5 | My Glucose chart readable | Check the time labels and range labels are readable and gaps show as gaps, not joined lines. |  |  |  |
| R6 | Explore Follow and Join | Tap Follow on a person and Join on a club. Each should show its new state in words. |  |  |  |
| R7 | Settings reset confirmation | Tap reset. A confirmation must appear before anything is deleted. Cancel first. |  |  |  |
| R8 | Settings remove confirmation | Tap remove data. A confirmation must appear before anything is deleted. Cancel first. |  |  |  |

## Accessibility

| # | Check | How to do it | iPhone result | Android result | Notes |
| --- | --- | --- | --- | --- | --- |
| X1 | Large text, nothing clips | Set the phone's text size to the largest setting. Open Home and Create and check nothing is cut off. |  |  |  |
| X2 | Screen reader through Create | Turn on VoiceOver (iPhone) or TalkBack (Android). Swipe through Create. Every control should say its name and state. |  |  |  |
| X3 | Touch targets comfortable | Tap every main button with a thumb. None should need precise aim. |  |  |  |

## Failures and follow-ups

Log every Fail here. Then add it to `docs/PROJECT_MAP.md` known problems, or note the fix.

| Check # | What happened | Fixed or logged where |
| --- | --- | --- |
|  |  |  |
|  |  |  |
