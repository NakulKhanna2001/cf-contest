import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/contests/[id]/results
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const contest = await prisma.contest.findUnique({
    where: { id },
    include: {
      problems: { orderBy: { slot: 'asc' } },
      submissions: { include: { student: true } },
    },
  })

  if (!contest) return Response.json({ error: 'Contest not found' }, { status: 404 })
  if (contest.is_test) return Response.json({ error: 'Contest not found' }, { status: 404 })

  const studentMap = new Map<string, {
    student: { id: string; name: string; handle: string }
    solvedCount: number
    problems: Record<string, { solved: boolean; solved_at: string | null }>
  }>()

  for (const sub of contest.submissions) {
    if (!studentMap.has(sub.student_id)) {
      studentMap.set(sub.student_id, {
        student: { id: sub.student_id, name: sub.student.name, handle: sub.student.cf_handle },
        solvedCount: 0,
        problems: {},
      })
    }
    const entry = studentMap.get(sub.student_id)!
    entry.problems[sub.cf_problem_id] = {
      solved: sub.solved,
      solved_at: sub.solved_at ? sub.solved_at.toISOString() : null,
    }
    if (sub.solved) entry.solvedCount++
  }

  const results = Array.from(studentMap.values()).sort(
    (a, b) => b.solvedCount - a.solvedCount
  )

  return Response.json({
    contest: {
      id: contest.id,
      status: contest.status,
      start_time: contest.start_time.toISOString(),
      end_time: contest.end_time.toISOString(),
    },
    problems: contest.problems.map((p) => ({
      id: p.cf_problem_id,
      name: p.problem_name,
      rating: p.rating,
      slot: p.slot,
    })),
    results,
  })
}
