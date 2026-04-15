import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export default async function ScoreboardRedirectPage() {
  const contest = await prisma.contest.findFirst({
    where: {
      is_test: false,
      status: { in: ['ACTIVE', 'PENDING'] },
    },
    orderBy: { start_time: 'asc' },
    select: { id: true },
  })

  if (!contest) {
    redirect('/')
  }

  redirect(`/contests/${contest.id}/scoreboard`)
}
