import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { fetchUserSubmissions, getProblemId, sleep } from '@/lib/cf-api'

// POST /api/contests/[id]/sync — check CF submissions for all students, return scoreboard
export async function POST(
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
  if (contest.is_test) {
    contest.status = new Date() > contest.end_time ? 'ENDED' : contest.status
  }

  // Auto-end if past end_time
  if (contest.status === 'ACTIVE' && new Date() > contest.end_time) {
    await prisma.contest.update({ where: { id }, data: { status: 'ENDED' } })
    contest.status = 'ENDED'
  }

  // Only sync while active
  if (contest.status === 'ACTIVE' && !contest.is_test) {
    type StudentEntry = { handle: string; problemIds: string[] }
    const unsolvedByStudent = new Map<string, StudentEntry>()

    for (const sub of contest.submissions) {
      if (!sub.solved) {
        if (!unsolvedByStudent.has(sub.student_id)) {
          unsolvedByStudent.set(sub.student_id, {
            handle: sub.student.cf_handle,
            problemIds: [],
          })
        }
        unsolvedByStudent.get(sub.student_id)!.problemIds.push(sub.cf_problem_id)
      }
    }

    for (const [studentId, { handle, problemIds }] of unsolvedByStudent) {
      try {
        const cfSubs = await fetchUserSubmissions(handle)

        // Only count submissions made during the contest window
        const solvedDuringContest = new Map<string, Date>()
        const wrongDuringContest = new Map<string, number>()

        for (const s of cfSubs) {
          const submittedAt = new Date(s.creationTimeSeconds * 1000)
          if (submittedAt < contest.start_time || submittedAt > contest.end_time) continue

          const pid = getProblemId(s.problem.contestId, s.problem.index)
          if (!problemIds.includes(pid)) continue

          if (s.verdict === 'OK') {
            if (!solvedDuringContest.has(pid)) {
              solvedDuringContest.set(pid, submittedAt)
            }
          } else if (s.verdict !== 'TESTING' && s.verdict !== 'SKIPPED') {
            wrongDuringContest.set(pid, (wrongDuringContest.get(pid) ?? 0) + 1)
          }
        }

        for (const problemId of problemIds) {
          const solvedAt = solvedDuringContest.get(problemId)
          const wrongs = wrongDuringContest.get(problemId) ?? 0

          if (solvedAt) {
            await prisma.submission.updateMany({
              where: { contest_id: id, student_id: studentId, cf_problem_id: problemId },
              data: {
                solved: true,
                solved_at: solvedAt,
                wrong_attempts: wrongs,
                last_checked_at: new Date(),
              },
            })
          } else {
            await prisma.submission.updateMany({
              where: { contest_id: id, student_id: studentId, cf_problem_id: problemId },
              data: { wrong_attempts: wrongs, last_checked_at: new Date() },
            })
          }
        }
      } catch (err) {
        console.error(`Sync failed for ${handle}:`, err)
      }

      await sleep(300)
    }
  }

  // Build scoreboard from DB
  const submissions = await prisma.submission.findMany({
    where: { contest_id: id },
    include: { student: true },
  })

  const studentMap = new Map<string, {
    student: { id: string; name: string; handle: string }
    solvedCount: number
    penalty: number
    problems: Record<string, { solved: boolean; solved_at: string | null; wrong_attempts: number }>
  }>()

  const contestStart = contest.start_time

  for (const sub of submissions) {
    if (!studentMap.has(sub.student_id)) {
      studentMap.set(sub.student_id, {
        student: { id: sub.student_id, name: sub.student.name, handle: sub.student.cf_handle },
        solvedCount: 0,
        penalty: 0,
        problems: {},
      })
    }
    const entry = studentMap.get(sub.student_id)!
    entry.problems[sub.cf_problem_id] = {
      solved: sub.solved,
      solved_at: sub.solved_at ? sub.solved_at.toISOString() : null,
      wrong_attempts: sub.wrong_attempts,
    }
    if (sub.solved && sub.solved_at) {
      entry.solvedCount++
      const elapsedMinutes = Math.floor(
        (sub.solved_at.getTime() - contestStart.getTime()) / 60000
      )
      entry.penalty += elapsedMinutes + sub.wrong_attempts * 20
    }
  }

  // Sort: most solved first, then least penalty
  const scoreboard = Array.from(studentMap.values()).sort((a, b) => {
    if (b.solvedCount !== a.solvedCount) return b.solvedCount - a.solvedCount
    return a.penalty - b.penalty
  })

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
    scoreboard,
    synced_at: new Date().toISOString(),
  })
}
