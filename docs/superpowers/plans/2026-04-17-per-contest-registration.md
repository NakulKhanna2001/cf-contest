# Per-Contest Registration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow students to register for each nightly contest starting from 10:30 PM the night before, by creating a contest shell at that time and filling in problems at 9:30 PM.

**Architecture:** Two-phase cron — a new `create-next-contest` endpoint creates a datestamped shell at 10:30 PM IST; the existing `create-contest` endpoint is modified to fill that shell with problems at 9:30 PM instead of always creating fresh. Registration and home page UI work against the shell.

**Tech Stack:** Next.js 16 App Router, Prisma 7, PostgreSQL (Neon), Tailwind CSS 4, Vercel Cron

---

## File Map

| File | Action |
|------|--------|
| `app/api/cron/create-next-contest/route.ts` | **Create** — phase 1 shell cron |
| `app/api/cron/create-contest/route.ts` | **Modify** — fill shell if found, else create fresh |
| `app/api/students/route.ts` | **Modify** — skip submission rows when contest has no problems |
| `app/page.tsx` | **Modify** — add countdown + tomorrow/tonight label |
| `vercel.json` | **Modify** — add new cron schedule |

---

## Task 1: Add `getTomorrowContestWindow` to contest-time lib

**Files:**
- Modify: `lib/contest-time.ts`

- [ ] **Step 1: Add the helper function**

Open `lib/contest-time.ts` and add this export after `getTodayContestWindow`:

```typescript
export function getTomorrowContestWindow(now = new Date()) {
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  return getTodayContestWindow(tomorrow)
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/contest-time.ts
git commit -m "feat: add getTomorrowContestWindow helper"
```

---

## Task 2: Create the shell cron endpoint

**Files:**
- Create: `app/api/cron/create-next-contest/route.ts`

- [ ] **Step 1: Create the file**

```typescript
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTomorrowContestWindow } from '@/lib/contest-time'

// POST /api/cron/create-next-contest
// Runs at 10:30 PM IST (17:00 UTC). Creates a PENDING contest shell for tomorrow.
export async function POST(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const { startTime, endTime, dayStartUtc, dayEndUtc } = getTomorrowContestWindow(now)

  // Idempotent — skip if a contest already exists for tomorrow's window
  const existing = await prisma.contest.findFirst({
    where: { start_time: { gte: dayStartUtc, lt: dayEndUtc } },
  })
  if (existing) {
    return Response.json({ message: 'Contest already exists for tomorrow', id: existing.id })
  }

  const contest = await prisma.contest.create({
    data: {
      start_time: startTime,
      end_time: endTime,
      status: 'PENDING',
      is_test: false,
    },
  })

  return Response.json({ message: 'Contest shell created', id: contest.id })
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Smoke-test the endpoint**

```bash
curl -s -X POST http://localhost:3000/api/cron/create-next-contest \
  -H "Authorization: Bearer $(grep CRON_SECRET .env.local | cut -d= -f2)"
```

Expected response: `{"message":"Contest shell created","id":"..."}` or `{"message":"Contest already exists for tomorrow","id":"..."}` if already exists.

- [ ] **Step 4: Verify shell in DB**

```bash
curl -s http://localhost:3000/api/contests/active | python3 -m json.tool
```

Expected: the shell contest appears with `status: "PENDING"` and `problems: []` (hidden by the active endpoint).

- [ ] **Step 5: Commit**

```bash
git add app/api/cron/create-next-contest/
git commit -m "feat: add create-next-contest shell cron endpoint"
```

---

## Task 3: Modify `create-contest` to fill an existing shell

**Files:**
- Modify: `app/api/cron/create-contest/route.ts`

- [ ] **Step 1: Replace the route with the two-path implementation**

Replace the full contents of `app/api/cron/create-contest/route.ts`:

```typescript
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { pickProblems } from '@/lib/problem-picker'
import { getProblemId } from '@/lib/cf-api'
import { getContestStatus, getTodayContestWindow } from '@/lib/contest-time'

export async function POST(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const { startTime, endTime, dayStartUtc, dayEndUtc } = getTodayContestWindow(now)

  // Get settings
  const settings = await prisma.appSettings.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton' },
    update: {},
  })

  // Get all previously used problem IDs
  const usedProblems = await prisma.usedProblem.findMany({ select: { cf_problem_id: true } })
  const usedIds = new Set(usedProblems.map((p) => p.cf_problem_id))

  // Pick 2 problems
  const { b, c } = await pickProblems([], usedIds, settings)
  const bId = getProblemId(b.contestId, b.index)
  const cId = getProblemId(c.contestId, c.index)

  // Check for an existing PENDING shell for today
  const shell = await prisma.contest.findFirst({
    where: {
      start_time: { gte: dayStartUtc, lt: dayEndUtc },
      status: 'PENDING',
      is_test: false,
    },
  })

  if (shell) {
    // Phase 2: fill the shell with problems and activate it
    const registrations = await prisma.contestRegistration.findMany({
      where: { contest_id: shell.id },
      select: { student_id: true },
    })

    const contest = await prisma.$transaction(async (tx) => {
      // Insert problems
      await tx.contestProblem.createMany({
        data: [
          { contest_id: shell.id, cf_problem_id: bId, problem_name: b.name, rating: b.rating!, slot: 'B' },
          { contest_id: shell.id, cf_problem_id: cId, problem_name: c.name, rating: c.rating!, slot: 'C' },
        ],
      })

      await tx.usedProblem.createMany({
        data: [{ cf_problem_id: bId }, { cf_problem_id: cId }],
        skipDuplicates: true,
      })

      // Create submission rows for students who pre-registered
      if (registrations.length > 0) {
        await tx.submission.createMany({
          data: registrations.flatMap((r) => [
            { contest_id: shell.id, student_id: r.student_id, cf_problem_id: bId },
            { contest_id: shell.id, student_id: r.student_id, cf_problem_id: cId },
          ]),
          skipDuplicates: true,
        })
      }

      return tx.contest.update({
        where: { id: shell.id },
        data: { status: 'ACTIVE' },
      })
    })

    return Response.json({
      message: 'Contest shell activated',
      id: contest.id,
      pre_registered: registrations.length,
      problems: [
        { slot: 'B', id: bId, name: b.name, rating: b.rating },
        { slot: 'C', id: cId, name: c.name, rating: c.rating },
      ],
    })
  }

  // Fallback: no shell found — create full contest from scratch
  const existing = await prisma.contest.findFirst({
    where: { start_time: { gte: dayStartUtc, lt: dayEndUtc } },
  })
  if (existing) {
    return Response.json({ message: 'Contest already exists for today', id: existing.id })
  }

  const contest = await prisma.$transaction(async (tx) => {
    const created = await tx.contest.create({
      data: {
        start_time: startTime,
        end_time: endTime,
        status: getContestStatus(now, startTime, endTime),
        is_test: false,
        problems: {
          create: [
            { cf_problem_id: bId, problem_name: b.name, rating: b.rating!, slot: 'B' },
            { cf_problem_id: cId, problem_name: c.name, rating: c.rating!, slot: 'C' },
          ],
        },
      },
    })

    await tx.usedProblem.createMany({
      data: [{ cf_problem_id: bId }, { cf_problem_id: cId }],
      skipDuplicates: true,
    })

    return created
  })

  return Response.json({
    message: 'Contest created',
    id: contest.id,
    problems: [
      { slot: 'B', id: bId, name: b.name, rating: b.rating },
      { slot: 'C', id: cId, name: c.name, rating: c.rating },
    ],
  })
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/cron/create-contest/route.ts
git commit -m "feat: fill PENDING shell in create-contest cron"
```

---

## Task 4: Fix registration to skip submission rows when no problems exist

**Files:**
- Modify: `app/api/students/route.ts`

The `if (contest.problems.length > 0)` guard already exists in the current code — this task verifies it is correct and adds a clear comment.

- [ ] **Step 1: Verify the guard is present**

Open `app/api/students/route.ts` and confirm lines 59–68 read:

```typescript
      // Create blank submission rows for each problem in this contest.
      // If the contest is a shell (no problems yet), skip — the create-contest
      // cron will create submission rows when it fills in problems.
      if (contest.problems.length > 0) {
        await tx.submission.createMany({
          data: contest.problems.map((p) => ({
            contest_id: contest.id,
            student_id: student.id,
            cf_problem_id: p.cf_problem_id,
          })),
          skipDuplicates: true,
        })
      }
```

If the comment is missing, add it. If the guard is missing entirely, add both the comment and the `if` block.

- [ ] **Step 2: Smoke-test registration against the shell**

With the shell contest created in Task 2 still in DB:

```bash
curl -s -X POST http://localhost:3000/api/students \
  -H "Content-Type: application/json" \
  -d '{"cf_handle":"no_profit"}'
```

Expected: `201` response with student object. No error about missing problems.

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/api/students/route.ts
git commit -m "feat: skip submission rows when registering for problem-less shell"
```

---

## Task 5: Update home page — countdown + tomorrow/tonight label

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Add a `ContestCountdown` component and `contestLabel` helper**

In `app/page.tsx`, add these two helpers after the imports and before `export default function HomePage()`:

```typescript
function ContestCountdown({ targetTime, label }: { targetTime: string; label: string }) {
  const [display, setDisplay] = useState('')
  const [urgent, setUrgent] = useState(false)

  useEffect(() => {
    function tick() {
      const diff = Math.max(0, new Date(targetTime).getTime() - Date.now())
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setDisplay(h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`)
      setUrgent(diff < 600000)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [targetTime])

  return (
    <div style={{ marginTop: 12 }}>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</p>
      <span className="font-mono" style={{ fontSize: 24, fontWeight: 700, color: urgent ? 'var(--red)' : 'var(--accent)' }}>
        {display}
      </span>
    </div>
  )
}

function contestLabel(startIso: string): string {
  const start = new Date(startIso)
  const now = new Date()
  const startIST = new Date(start.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
  const nowIST = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
  const isTomorrow = startIST.getDate() !== nowIST.getDate()
  return isTomorrow ? 'Tomorrow' : 'Tonight'
}
```

- [ ] **Step 2: Update the PENDING contest display in the contest status card**

Find the section in the JSX that renders a `PENDING` contest (currently shows "Problems stay hidden until..."). Replace it with:

```tsx
) : (
  <div>
    <div className="font-mono" style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
      {contestLabel(contest.start_time)} · {formatTime(contest.start_time)} – {formatTime(contest.end_time)}
    </div>
    <ContestCountdown
      targetTime={contest.start_time}
      label="Contest starts in"
    />
    <div style={{
      marginTop: 14,
      padding: '10px 14px',
      borderRadius: 8,
      border: '1px dashed var(--border-bright)',
      fontSize: 12,
      color: 'var(--text-muted)',
    }}>
      Problems are revealed at {formatTime(contest.start_time)}.
    </div>
  </div>
```

This replaces the entire `contest.status !== 'ACTIVE'` branch inside the contest card.

- [ ] **Step 3: Verify in browser**

Open `http://localhost:3000`. If a PENDING shell exists you should see:
- "Tomorrow · 9:30 PM – 10:30 PM" or "Tonight · 9:30 PM – 10:30 PM"
- A live countdown in blue (turns red under 10 min)
- "Problems are revealed at 9:30 PM" placeholder
- Registration form still visible below

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx
git commit -m "feat: add countdown and tomorrow/tonight label to home page"
```

---

## Task 6: Add new cron to vercel.json

**Files:**
- Modify: `vercel.json`

- [ ] **Step 1: Add the shell cron entry**

Replace the contents of `vercel.json` with:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  "crons": [
    {
      "path": "/api/cron/create-next-contest",
      "schedule": "0 17 * * *"
    },
    {
      "path": "/api/cron/create-contest",
      "schedule": "30 16 * * *"
    },
    {
      "path": "/api/cron/create-test-contest",
      "schedule": "0 12 * * *"
    }
  ]
}
```

`0 17 * * *` = 17:00 UTC = 10:30 PM IST.

- [ ] **Step 2: Final typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add vercel.json
git commit -m "feat: schedule create-next-contest cron at 10:30 PM IST"
```

---

## End-to-End Verification

Run through this manually to confirm the full flow works:

1. **Create a shell** (simulates 10:30 PM cron):
```bash
curl -s -X POST http://localhost:3000/api/cron/create-next-contest \
  -H "Authorization: Bearer $(grep CRON_SECRET .env.local | cut -d= -f2)" \
  | python3 -m json.tool
```

2. **Register a student against the shell**:
```bash
curl -s -X POST http://localhost:3000/api/students \
  -H "Content-Type: application/json" \
  -d '{"cf_handle":"no_profit"}' | python3 -m json.tool
```

3. **Check the home page** — open `http://localhost:3000`, confirm countdown + label visible.

4. **Activate the shell** (simulates 9:30 PM cron):
```bash
curl -s -X POST http://localhost:3000/api/cron/create-contest \
  -H "Authorization: Bearer $(grep CRON_SECRET .env.local | cut -d= -f2)" \
  | python3 -m json.tool
```
Expected response: `"message": "Contest shell activated"` with `pre_registered: 1`.

5. **Check scoreboard** — the pre-registered student (`no_profit`) should appear with `0/2` and their submission rows created.
