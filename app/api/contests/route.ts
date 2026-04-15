import { prisma } from '@/lib/prisma'

// GET /api/contests — list past contests (most recent first)
export async function GET() {
  const contests = await prisma.contest.findMany({
    where: { status: 'ENDED' },
    orderBy: { start_time: 'desc' },
    include: { problems: { orderBy: { slot: 'asc' } } },
  })
  return Response.json(contests)
}
