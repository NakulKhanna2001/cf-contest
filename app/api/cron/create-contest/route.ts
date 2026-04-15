import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { pickProblems } from '@/lib/problem-picker'
import { getProblemId } from '@/lib/cf-api'
import { getContestStatus, getTodayContestWindow } from '@/lib/contest-time'

export async function POST(request: NextRequest) {
  // Verify cron secret
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Prevent duplicate contest for the current IST day
  const now = new Date()
  const { startTime, endTime, dayStartUtc, dayEndUtc } = getTodayContestWindow(now)

  const existing = await prisma.contest.findFirst({
    where: { start_time: { gte: dayStartUtc, lt: dayEndUtc } },
  })
  if (existing) {
    return Response.json({ message: 'Contest already exists for today', id: existing.id })
  }

  // Get settings
  const settings = await prisma.appSettings.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton' },
    update: {},
  })

  // Get all registered students
  const students = await prisma.student.findMany({ select: { id: true, cf_handle: true } })
  const handles = students.map((s) => s.cf_handle)

  // Get all previously used problem IDs
  const usedProblems = await prisma.usedProblem.findMany({ select: { cf_problem_id: true } })
  const usedIds = new Set(usedProblems.map((p) => p.cf_problem_id))

  // Pick 2 problems
  const { b, c } = await pickProblems(handles, usedIds, settings)

  const bId = getProblemId(b.contestId, b.index)
  const cId = getProblemId(c.contestId, c.index)

  // Create contest, problems, used-problem records, and blank submissions in one transaction
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

    // Create blank submission rows for every student × problem
    if (students.length > 0) {
      await tx.submission.createMany({
        data: students.flatMap((s) => [
          { contest_id: created.id, student_id: s.id, cf_problem_id: bId },
          { contest_id: created.id, student_id: s.id, cf_problem_id: cId },
        ]),
        skipDuplicates: true,
      })
    }

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
