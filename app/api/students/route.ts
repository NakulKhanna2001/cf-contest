import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { COOKIE_NAME, verifyAdminToken } from '@/lib/auth'
import { fetchUserSubmissions } from '@/lib/cf-api'

// POST /api/students — register a student for the current contest
export async function POST(request: NextRequest) {
  const body = await request.json()
  const handle = typeof body.cf_handle === 'string' ? body.cf_handle.trim() : ''

  if (!handle) {
    return Response.json({ error: 'Codeforces handle is required' }, { status: 400 })
  }

  // Find the active or upcoming contest
  const contest = await prisma.contest.findFirst({
    where: { status: { in: ['PENDING', 'ACTIVE'] }, is_test: false },
    orderBy: { start_time: 'asc' },
    include: { problems: true },
  })

  if (!contest) {
    return Response.json(
      { error: 'No contest is open for registration right now.' },
      { status: 400 }
    )
  }

  // Block registration within 5 minutes of contest start
  const cutoff = new Date(contest.start_time.getTime() - 5 * 60 * 1000)
  if (new Date() >= cutoff) {
    return Response.json(
      { error: 'Registration is closed — contest starts in less than 5 minutes' },
      { status: 400 }
    )
  }

  try {
    // Verify the CF handle exists
    await fetchUserSubmissions(handle)

    const result = await prisma.$transaction(async (tx) => {
      // Upsert the student (same handle can participate in future contests)
      const student = await tx.student.upsert({
        where: { cf_handle: handle },
        create: { name: handle, cf_handle: handle },
        update: {},
      })

      // Register for this specific contest (idempotent)
      await tx.contestRegistration.upsert({
        where: { contest_id_student_id: { contest_id: contest.id, student_id: student.id } },
        create: { contest_id: contest.id, student_id: student.id },
        update: {},
      })

      // Create blank submission rows for each problem in this contest.
      // If the contest is a shell (no problems yet), skip — the create-contest
      // cron will create submission rows when it fills in problems.
      if (contest.problems.length > 0) {
        await tx.submission.createMany({
          data: contest.problems.map((p) => ({
            contest_id: contest.id,
            student_id: student.id,
            cf_problem_id: p.cf_problem_id,
          })),
          skipDuplicates: true,
        })
      }

      return student
    })

    return Response.json(result, { status: 201 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : ''
    if (msg.includes('CF API error')) {
      return Response.json(
        { error: 'That Codeforces handle could not be verified. Please check it and try again.' },
        { status: 400 }
      )
    }
    console.error('Register student error:', err)
    return Response.json({ error: 'Failed to register student' }, { status: 500 })
  }
}

// GET /api/students — list all students (admin)
export async function GET() {
  const token = (await cookies()).get(COOKIE_NAME)?.value
  if (!token || !(await verifyAdminToken(token))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const students = await prisma.student.findMany({
    where: { is_test: false },
    orderBy: { registered_at: 'asc' },
  })
  return Response.json(students)
}
