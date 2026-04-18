import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { pickProblems } from '@/lib/problem-picker'
import { getProblemId } from '@/lib/cf-api'

// POST /api/cron/create-day-contest
// Creates an ACTIVE contest window for today (noon–9 PM IST) for testing sync.
// Uses real problems, no fake students. Register via the normal home page.
// Auth: Bearer CRON_SECRET
export async function POST(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Compute noon IST and 9 PM IST for today
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000
  const nowIst = new Date(Date.now() + IST_OFFSET_MS)
  const istMidnightUtc = Date.UTC(
    nowIst.getUTCFullYear(),
    nowIst.getUTCMonth(),
    nowIst.getUTCDate()
  )
  const startTime = new Date(istMidnightUtc + 12 * 60 * 60 * 1000 - IST_OFFSET_MS) // noon IST
  const endTime   = new Date(istMidnightUtc + 21 * 60 * 60 * 1000 - IST_OFFSET_MS) // 9 PM IST

  // Idempotent
  const existing = await prisma.contest.findFirst({
    where: { start_time: startTime, is_test: false },
  })
  if (existing) {
    return Response.json({
      message: 'Day contest already exists',
      id: existing.id,
      scoreboard: `/contests/${existing.id}/scoreboard`,
    })
  }

  const settings = await prisma.appSettings.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton' },
    update: {},
  })

  const usedProblems = await prisma.usedProblem.findMany({ select: { cf_problem_id: true } })
  const usedIds = new Set(usedProblems.map((p) => p.cf_problem_id))

  const { b, c } = await pickProblems([], usedIds, settings)
  const bId = getProblemId(b.contestId, b.index)
  const cId = getProblemId(c.contestId, c.index)

  const contest = await prisma.contest.create({
    data: {
      start_time: startTime,
      end_time: endTime,
      status: 'ACTIVE',
      is_test: false,
      problems: {
        create: [
          { cf_problem_id: bId, problem_name: b.name, rating: b.rating!, slot: 'B' },
          { cf_problem_id: cId, problem_name: c.name, rating: c.rating!, slot: 'C' },
        ],
      },
    },
  })

  return Response.json({
    message: 'Day contest created',
    id: contest.id,
    window: `noon–9 PM IST`,
    scoreboard: `/contests/${contest.id}/scoreboard`,
    problems: [
      { slot: 'B', id: bId, name: b.name, rating: b.rating },
      { slot: 'C', id: cId, name: c.name, rating: c.rating },
    ],
  })
}
