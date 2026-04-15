import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { pickProblems } from '@/lib/problem-picker'
import { getProblemId } from '@/lib/cf-api'
import { buildRandomTestStudents, getRandomSolvedAt } from '@/lib/test-contest'

const TEST_STUDENT_COUNT = 8

export async function POST(request: NextRequest) {
  if (process.env.ENABLE_TEST_CRON !== 'true') {
    return Response.json({ error: 'Test cron is disabled' }, { status: 403 })
  }

  const auth = request.headers.get('authorization')
  const expectedSecret = process.env.TEST_CRON_SECRET ?? process.env.CRON_SECRET
  if (!expectedSecret || auth !== `Bearer ${expectedSecret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const existing = await prisma.contest.findFirst({
    where: {
      is_test: true,
      status: { in: ['PENDING', 'ACTIVE'] },
    },
  })

  if (existing) {
    return Response.json({
      message: 'An active test contest already exists',
      id: existing.id,
    })
  }

  const settings = await prisma.appSettings.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton' },
    update: {},
  })

  const { b, c } = await pickProblems([], new Set<string>(), settings)
  const bId = getProblemId(b.contestId, b.index)
  const cId = getProblemId(c.contestId, c.index)

  const startTime = new Date()
  const endTime = new Date(startTime.getTime() + 60 * 60 * 1000)
  const testStudents = buildRandomTestStudents(TEST_STUDENT_COUNT)

  const contest = await prisma.$transaction(async (tx) => {
    const students = []
    for (const student of testStudents) {
      students.push(await tx.student.create({ data: student }))
    }

    const created = await tx.contest.create({
      data: {
        start_time: startTime,
        end_time: endTime,
        status: 'ACTIVE',
        is_test: true,
        problems: {
          create: [
            { cf_problem_id: bId, problem_name: b.name, rating: b.rating!, slot: 'B' },
            { cf_problem_id: cId, problem_name: c.name, rating: c.rating!, slot: 'C' },
          ],
        },
      },
    })

    await tx.submission.createMany({
      data: students.flatMap((student) => {
        const solvePattern = Math.floor(Math.random() * 3)

        return [
          {
            contest_id: created.id,
            student_id: student.id,
            cf_problem_id: bId,
            solved: solvePattern >= 1,
            solved_at: solvePattern >= 1 ? getRandomSolvedAt(startTime, endTime) : null,
          },
          {
            contest_id: created.id,
            student_id: student.id,
            cf_problem_id: cId,
            solved: solvePattern === 2,
            solved_at: solvePattern === 2 ? getRandomSolvedAt(startTime, endTime) : null,
          },
        ]
      }),
    })

    return created
  })

  return Response.json({
    message: 'Test contest created',
    id: contest.id,
    students_created: TEST_STUDENT_COUNT,
    problems: [
      { slot: 'B', id: bId, name: b.name, rating: b.rating },
      { slot: 'C', id: cId, name: c.name, rating: c.rating },
    ],
  })
}
