# Per-Contest Registration — Design Spec

**Date:** 2026-04-17  
**Status:** Approved

---

## Problem

The contest is created by a cron job at exactly 9:30 PM IST — the moment it starts. Students have no way to register before the contest exists. The registration window is effectively zero.

## Goal

Students can register for tonight's contest from **10:30 PM the night before** (as soon as the previous contest ends) up to **9:25 PM tonight** (5 min before start). The home page shows a countdown and registration form during this window.

---

## Approach: Two-Phase Cron

No schema changes. The existing `Contest` model already supports a shell state — a `PENDING` contest with no `ContestProblem` rows.

### Phase 1 — Shell creation (10:30 PM IST)

New endpoint: `POST /api/cron/create-next-contest`

- Triggered by Vercel cron at **17:00 UTC** (10:30 PM IST)
- Computes **tomorrow's** contest window: next day 9:30–10:30 PM IST
- Creates a `Contest` row: `status: PENDING`, `is_test: false`, no problems
- **Idempotent:** if a PENDING contest for tomorrow's window already exists, returns early with its ID

### Phase 2 — Problem selection (9:30 PM IST)

Modified endpoint: `POST /api/cron/create-contest`

- Triggered by Vercel cron at **16:00 UTC** (9:30 PM IST) — schedule unchanged
- **New:** first checks for a PENDING contest in today's window
  - If found: picks 2 problems → inserts `ContestProblem` rows → sets `status: ACTIVE`
  - If not found: falls back to creating a full contest from scratch (preserves current behaviour)

---

## Registration API — No Changes

`POST /api/students` already:
- Finds the active or upcoming (`PENDING`) non-test contest
- Upserts the student record
- Creates a `ContestRegistration` row for that specific contest
- Creates blank `Submission` rows for each problem in that contest
- Enforces the 5-minute pre-start cutoff

**One edge case to handle:** if a student registers during the shell window (before 9:30 PM), the contest has no problems yet — so there are no submission rows to create. The fix spans two places:

- `POST /api/students`: skip submission row creation when `contest.problems` is empty (just create the `ContestRegistration`)
- `POST /api/cron/create-contest` (phase 2): after inserting problems, create blank `Submission` rows for all students already registered via `ContestRegistration`

---

## Vercel Cron Config

`vercel.json` gains one new entry:

```json
{
  "crons": [
    { "path": "/api/cron/create-next-contest", "schedule": "0 17 * * *" },
    { "path": "/api/cron/create-contest",      "schedule": "0 16 * * *" }
  ]
}
```

---

## Home Page UI Changes

The home page fetches `/api/contests/active` which already returns `PENDING` contests. Two additions:

1. **Countdown timer** — client-side, counts down to `contest.start_time`. Turns red under 10 minutes.
2. **Registration window label** — shows "Tomorrow · 9:30–10:30 PM IST" when the contest start is the next day, or "Tonight · 9:30–10:30 PM IST" when it's today.

Existing states remain:
- **PENDING (no problems):** time slot + countdown + registration form + "Problems revealed at 9:30 PM" placeholder
- **ACTIVE:** LIVE badge + countdown to end + problems + scoreboard link
- **No contest:** "Check back after 10:30 PM" message

---

## Edge Cases

| Scenario | Behaviour |
|----------|-----------|
| Shell cron missed (server down at 10:30 PM) | Phase 2 cron falls back to creating full contest at 9:30 PM — no regression |
| Student registers before problems exist | Submission rows created by phase 2 cron for pre-registered students |
| Student registers after 9:30 PM (ACTIVE) | Normal flow — submission rows created immediately at registration |
| Two shells created for same day | Idempotent check in phase 1 prevents duplicates |

---

## Files Changed

| File | Change |
|------|--------|
| `app/api/cron/create-next-contest/route.ts` | **New** — phase 1 cron |
| `app/api/cron/create-contest/route.ts` | Modified — fill shell if found, else create fresh |
| `app/api/students/route.ts` | Skip submission creation when contest has no problems yet |
| `app/page.tsx` | Add countdown timer + "tomorrow vs tonight" label |
| `vercel.json` | Add new cron entry |
