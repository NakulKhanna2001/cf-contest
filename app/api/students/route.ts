import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { COOKIE_NAME, verifyAdminToken } from '@/lib/auth'

// POST /api/students — register a student
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { name, cf_handle } = body

  if (!name?.trim() || !cf_handle?.trim()) {
    return Response.json({ error: 'Name and Codeforces handle are required' }, { status: 400 })
  }

  // Block registration if within 5 minutes of an upcoming or active contest
  const upcomingContest = await prisma.contest.findFirst({
    where: { status: { in: ['PENDING', 'ACTIVE'] } },
    orderBy: { start_time: 'asc' },
  })

  if (upcomingContest) {
    const cutoff = new Date(upcomingContest.start_time.getTime() - 5 * 60 * 1000)
    if (new Date() >= cutoff) {
      return Response.json(
        { error: 'Registration is closed — contest starts in less than 5 minutes' },
        { status: 400 }
      )
    }
  }

  try {
    const student = await prisma.student.create({
      data: { name: name.trim(), cf_handle: cf_handle.trim() },
    })
    return Response.json(student, { status: 201 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : ''
    if (msg.includes('Unique constraint')) {
      return Response.json({ error: 'That Codeforces handle is already registered' }, { status: 409 })
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
    orderBy: { registered_at: 'asc' },
  })
  return Response.json(students)
}
