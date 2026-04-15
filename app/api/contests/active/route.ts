import { prisma } from '@/lib/prisma'
import { getContestStatus } from '@/lib/contest-time'

// GET /api/contests/active — return the current active or upcoming contest
export async function GET() {
  const contest = await prisma.contest.findFirst({
    where: { status: { in: ['ACTIVE', 'PENDING'] } },
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

    return Response.json({ contest: updated.status === 'ENDED' ? null : updated })
  }

  return Response.json({ contest })
}
