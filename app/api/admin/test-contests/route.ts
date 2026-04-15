import { prisma } from '@/lib/prisma'

export async function DELETE() {
  const testContests = await prisma.contest.findMany({
    where: { is_test: true },
    select: { id: true },
  })

  const contestIds = testContests.map((contest) => contest.id)

  await prisma.$transaction(async (tx) => {
    if (contestIds.length > 0) {
      await tx.submission.deleteMany({
        where: { contest_id: { in: contestIds } },
      })

      await tx.contestProblem.deleteMany({
        where: { contest_id: { in: contestIds } },
      })

      await tx.contest.deleteMany({
        where: { id: { in: contestIds } },
      })
    }

    await tx.student.deleteMany({
      where: { is_test: true },
    })
  })

  return Response.json({
    message: 'Test contests deleted',
    contests_deleted: contestIds.length,
  })
}
