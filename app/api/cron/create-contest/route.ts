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

  // Collect handles of students registered for today's contest
  const shell = await prisma.contest.findFirst({
    where: {
      start_time: { gte: dayStartUtc, lt: dayEndUtc },
      status: 'PENDING',
      is_test: false,
    },
    include: {
      registrations: { include: { student: { select: { cf_handle: true } } } },
    },
  })
  const registeredHandles = shell
    ? shell.registrations.map((r) => r.student.cf_handle)
    : []

  // Pick 2 problems, filtering out those already solved by registered students
  const { b, c } = await pickProblems(registeredHandles, usedIds, settings)
  const bId = getProblemId(b.contestId, b.index)
  const cId = getProblemId(c.contestId, c.index)

  if (shell) {
    // Phase 2: fill the shell with problems and activate it
    const registrations = shell.registrations.map((r) => ({ student_id: r.student_id }))

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
