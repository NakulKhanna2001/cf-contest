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
