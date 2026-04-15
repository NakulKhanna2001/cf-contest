import { prisma } from '@/lib/prisma'
import { getContestStatus } from '@/lib/contest-time'

function serializeContest(contest: {
  id: string
  start_time: Date
  end_time: Date
  status: string
  created_at: Date
  is_test: boolean
  problems: {
    id: string
    contest_id: string
    cf_problem_id: string
    problem_name: string
    rating: number
    slot: string
  }[]
}) {
  return {
    ...contest,
    problems: contest.status === 'ACTIVE' ? contest.problems : [],
  }
}

// GET /api/contests/active — return the current active or upcoming contest
export async function GET() {
  const contest = await prisma.contest.findFirst({
    where: {
      status: { in: ['ACTIVE', 'PENDING'] },
      is_test: false,
    },
    orderBy: { start_time: 'asc' },
    include: { problems: { orderBy: { slot: 'asc' } } },
  })

  if (!contest) {
    return Response.json({ contest: null })
  }

  const nextStatus = getContestStatus(new Date(), contest.start_time, contest.end_time)

  if (contest.status !== nextStatus) {
    const updated = await prisma.contest.update({
      where: { id: contest.id },
      data: { status: nextStatus },
      include: { problems: { orderBy: { slot: 'asc' } } },
    })

    return Response.json({
      contest: updated.status === 'ENDED' ? null : serializeContest(updated),
    })
  }

  return Response.json({ contest: serializeContest(contest) })
}
