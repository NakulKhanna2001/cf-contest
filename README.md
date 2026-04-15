# Codeforces Practice Contest App

A full-stack Next.js app for running nightly Codeforces practice contests for students.

Each night, the app can create a 1-hour contest, auto-pick two problems, track student submissions through the Codeforces API, and show a live scoreboard. It also includes a small admin area for settings and contest operations.

## What It Does

- Runs a nightly contest window from 9:30 PM to 10:30 PM IST
- Lets students register with their Codeforces handle
- Automatically picks 2 practice problems from configurable rating bands
- Avoids reusing problems that were already used before
- Tries to avoid problems already solved by registered students
- Polls Codeforces during the contest to keep the scoreboard fresh
- Stores contests, students, submissions, and app settings in PostgreSQL
- Includes password-protected admin pages for settings and manual sync

## Stack

- Next.js 16 App Router
- React 19
- Prisma 7
- PostgreSQL
- Tailwind CSS 4
- Codeforces public API

## Pages

```text
/                    Landing page and registration
/scoreboard          Live contest scoreboard
/results             Past contests
/results/[id]        Detailed results for one contest
/admin               Admin login
/admin/dashboard     Admin dashboard
/admin/settings      Admin settings
```

## API Endpoints

```text
POST /api/students
GET  /api/students

GET  /api/contests
GET  /api/contests/active
POST /api/contests/[id]/sync
GET  /api/contests/[id]/results

POST /api/admin/login
GET  /api/admin/settings
PUT  /api/admin/settings

POST /api/cron/create-contest
```

## Environment Variables

Copy [.env.example](/Users/nx/cf-contest/.env.example) to `.env.local` and fill in real values.

```bash
DATABASE_URL=
ADMIN_PASSWORD=
CRON_SECRET=
NEXTAUTH_SECRET=
```

## Local Development

1. Install dependencies:

```bash
npm install
```

2. Create your local environment file:

```bash
cp .env.example .env.local
```

3. Update `DATABASE_URL` and the app secrets in `.env.local`.

4. Run Prisma migrations:

```bash
npx prisma migrate deploy
```

For a brand-new local database, `npx prisma migrate dev` also works.

5. Start the app:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Available Scripts

```bash
npm run dev
npm run build
npm run build:webpack
npm run start
npm run prisma:generate
npm run typecheck
npm run check
```

`npm run check` is the main verification command used for CI in this repo.

## Contest Rules and Behavior

- Contest time is fixed to 9:30 PM to 10:30 PM IST
- Registration closes 5 minutes before contest start
- Two problems are selected for each contest:
  - Div. 2 B style: 1200-1600 by default
  - Div. 2 C style: 1400-1700 by default
- Problem ranges and polling interval are configurable in admin settings
- The scoreboard sync route checks unsolved submissions and updates results from Codeforces

## Notes

- This repo currently stops at app and CI setup. Deployment is intentionally not wired in yet.
- The project uses a generated Prisma client under `app/generated/prisma`, so `prisma generate` is part of install/check flows.
- The default Next.js Turbopack build can be environment-sensitive in restricted sandboxes, so CI uses the webpack build path for stability.

## Roadmap

- Add richer scoreboard ranking and tie-break rules
- Improve admin tooling around contest management
- Add deployment documentation for Vercel and Neon
- Add end-to-end tests once the core flow stabilizes
