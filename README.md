# Codeforces Practice Contest App — Design Spec

**Date:** 2026-04-15
**Status:** Approved
**Note:** This file doubles as `README.md` in the project root for GitHub.

---

## Overview

A full-stack web app for running nightly 1-hour Codeforces practice contests for students. Contests run automatically every night from 9:30–10:30 PM IST. The system auto-selects 2 problems, tracks student submissions live via the Codeforces API, and shows a real-time scoreboard.

---

## Hosting

| Layer | Service | Cost |
|---|---|---|
| Frontend + API | Vercel Hobby | Free, no CC |
| Database | Neon PostgreSQL | Free, no CC |

Single Next.js 14 (App Router) project. No separate backend server. All logic in API routes.

---

## Architecture

```
Browser
  └── Next.js App (Vercel)
        ├── /app              → React pages
        ├── /app/api          → API routes (all backend logic)
        └── Prisma Client     → Neon PostgreSQL

Vercel Cron (30 16 * * * UTC = 9:30 PM IST)
  └── POST /api/cron/create-contest
        → fetch CF problemset
        → check each student's solved problems
        → auto-pick 2 problems
        → write contest to DB
```

**Live tracking:** scoreboard page polls `POST /api/contests/[id]/sync` every 30 seconds. No separate background worker.

---

## Contest Schedule

- **Start:** 9:30 PM IST (16:00 UTC) daily, triggered by Vercel cron
- **Duration:** 60 minutes (end time = start_time + 1 hour)
- **End:** computed, no second cron needed — status flips to ENDED once `end_time` is past
- **Registration closes:** 5 minutes before start (computed as `start_time - 5min`)

---

## Problem Selection (Automatic)

The cron job picks exactly 2 problems per contest:

| Slot | Style | Rating Range |
|---|---|---|
| Problem 1 | Div. 2 B | 1200–1600 |
| Problem 2 | Div. 2 C | 1400–1700 |

**Selection algorithm:**
1. Fetch full problemset from `api.codeforces.com/api/problemset.problems`
2. Filter by rating range for each slot
3. Exclude any `problem_id` present in the `UsedProblem` table
4. For each remaining candidate, exclude problems solved by any registered student (checked once via `user.status` API at contest creation, with 300ms delay between students)
5. Randomly pick 1 from remaining B candidates, 1 from remaining C candidates
6. Write contest + problems to DB, add both to `UsedProblem`
7. Create `Submission` rows for every student × problem pair (solved = false) — so sync has rows to work with immediately

**Fallback:** if no candidates remain after filtering, relax the "not solved by students" filter and pick from unused problems only. Log a warning.

---

## Data Model (Prisma)

```prisma
model Student {
  id            String   @id @default(cuid())
  name          String
  cf_handle     String   @unique
  registered_at DateTime @default(now())
  submissions   Submission[]
}

model Contest {
  id         String   @id @default(cuid())
  start_time DateTime
  end_time   DateTime
  status     ContestStatus @default(PENDING)
  problems   ContestProblem[]
  submissions Submission[]
}

model ContestProblem {
  id           String  @id @default(cuid())
  contest_id   String
  contest      Contest @relation(fields: [contest_id], references: [id])
  cf_problem_id String  // e.g. "1234B"
  problem_name  String
  rating        Int
  slot          String  // "B" or "C"
}

model Submission {
  id              String   @id @default(cuid())
  contest_id      String
  student_id      String
  cf_problem_id   String
  solved          Boolean  @default(false)
  solved_at       DateTime?
  last_checked_at DateTime @default(now())
  contest         Contest  @relation(fields: [contest_id], references: [id])
  student         Student  @relation(fields: [student_id], references: [id])

  @@unique([contest_id, student_id, cf_problem_id])
}

model UsedProblem {
  id            String   @id @default(cuid())
  cf_problem_id String   @unique
  used_at       DateTime @default(now())
}

model AppSettings {
  id              String @id @default("singleton")
  b_rating_min    Int    @default(1200)
  b_rating_max    Int    @default(1600)
  c_rating_min    Int    @default(1400)
  c_rating_max    Int    @default(1700)
  poll_interval_s Int    @default(30)
}

enum ContestStatus {
  PENDING
  ACTIVE
  ENDED
}
```

---

## API Routes

```
POST /api/students                     → register student (blocked 5min before start)
GET  /api/students                     → list students (admin)

GET  /api/contests/active              → get tonight's contest + current scores
GET  /api/contests/[id]/scoreboard     → scores for a specific contest
POST /api/contests/[id]/sync           → trigger CF submission check, return updated scores
GET  /api/contests                     → list all past contests
GET  /api/contests/[id]/results        → final results for one contest

POST /api/admin/login                  → validate ADMIN_PASSWORD env var, set httpOnly cookie
GET  /api/admin/settings               → fetch AppSettings row
PUT  /api/admin/settings               → update AppSettings row

POST /api/cron/create-contest          → Vercel cron (secured via CRON_SECRET header)
```

---

## Frontend Pages

```
/                    → Landing: register form + tonight's contest status
/scoreboard          → Live scoreboard, auto-polls every 30s
/results             → List of past contests
/results/[id]        → Detailed results for one contest
/admin               → Password login gate
/admin/dashboard     → Contest status, student list, manual sync, last sync time
/admin/settings      → Rating range config
```

---

## Live Sync Logic

Every 30 seconds, the scoreboard calls `POST /api/contests/[id]/sync`:

1. Fetch all `Submission` rows for the contest where `solved = false`
2. Group by student
3. For each student, call `api.codeforces.com/api/user.status?handle=X&count=100`
4. Wait 300ms between each student (CF rate limit: max 5 req/s)
5. For each submission in the CF response with `verdict = OK`, upsert `Submission` to `solved = true`, set `solved_at`
6. Update `last_checked_at` on all checked rows
7. Skip students with all problems already solved
8. Return full scoreboard (student, problem, solved, solved_at)

**Max sync time estimate:** 20 students × 300ms = 6s. Well within 30s poll interval.

---

## Admin Auth

- Single `ADMIN_PASSWORD` environment variable in Vercel
- POST `/api/admin/login` validates it, sets a signed httpOnly cookie (`admin_session`)
- Middleware protects all `/admin/*` routes and `/api/admin/*` routes
- No user table needed

---

## Codeforces API Usage

| Endpoint | Used for |
|---|---|
| `problemset.problems` | Fetch full problem list for picker |
| `user.status` | Check submissions for a handle |

No API key required for these endpoints. Rate limit: 5 requests/second — respected via 300ms inter-request delay.

---

## Environment Variables

```
DATABASE_URL        Neon connection string
ADMIN_PASSWORD      Admin login password
CRON_SECRET         Secret to authenticate Vercel cron calls
NEXTAUTH_SECRET     Cookie signing secret
```

---

## Assumptions

- Timezone is IST (UTC+5:30); cron runs at `30 16 * * *` UTC
- Max ~30 students (CF API rate limits are comfortable at this scale)
- No email/notification system — students check the app directly
- Problems are identified by Codeforces `contestId + index` (e.g. `1234B`)
- Admin settings (rating ranges) can be changed before the nightly cron runs
