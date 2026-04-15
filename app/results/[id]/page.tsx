import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { CONTEST_TIME_ZONE } from '@/lib/contest-time'

export const dynamic = 'force-dynamic'

async function getContest(id: string) {
  return prisma.contest.findUnique({
    where: { id },
    include: {
      problems: { orderBy: { slot: 'asc' } },
      submissions: { include: { student: true } },
    },
  })
}

export default async function ResultDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const contest = await getContest(id)
  if (!contest) notFound()

  // Build scoreboard
  const studentMap = new Map<string, {
    student: { id: string; name: string; handle: string }
    solvedCount: number
    problems: Record<string, { solved: boolean; solved_at: Date | null }>
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
    entry.problems[sub.cf_problem_id] = { solved: sub.solved, solved_at: sub.solved_at }
    if (sub.solved) entry.solvedCount++
  }

  const rows = Array.from(studentMap.values()).sort((a, b) => b.solvedCount - a.solvedCount)

  function elapsed(solved_at: Date) {
    const diff = Math.floor((solved_at.getTime() - contest!.start_time.getTime()) / 1000)
    const m = Math.floor(diff / 60)
    const s = diff % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="bg-blue-700 text-white py-4 px-4 shadow">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Contest Results</h1>
            <p className="text-blue-200 text-sm mt-0.5">
              {new Date(contest.start_time).toLocaleDateString([], {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                timeZone: CONTEST_TIME_ZONE,
              })}
            </p>
          </div>
          <Link href="/results" className="text-white border border-white px-3 py-1.5 rounded text-sm hover:bg-blue-600">
            All Results
          </Link>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Problems */}
        <div className="bg-white rounded-xl shadow-sm border mb-6 p-4">
          <div className="grid grid-cols-2 gap-4">
            {contest.problems.map((p) => (
              <a
                key={p.id}
                href={`https://codeforces.com/problemset/problem/${p.cf_problem_id.replace(/[A-Z]$/, '')}/${p.cf_problem_id.slice(-1)}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 hover:bg-gray-50 rounded-lg p-2 transition-colors"
              >
                <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded">
                  {p.slot}
                </span>
                <div>
                  <div className="text-sm font-medium text-gray-800">{p.problem_name}</div>
                  <div className="text-xs text-gray-400">Rating {p.rating}</div>
                </div>
              </a>
            ))}
          </div>
        </div>

        {/* Results table */}
        {rows.length === 0 ? (
          <p className="text-center text-gray-400 py-10">No participants.</p>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 w-8">#</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Student</th>
                  {contest.problems.map((p) => (
                    <th key={p.id} className="text-center px-4 py-3 font-medium text-gray-500 w-28">
                      Problem {p.slot}
                    </th>
                  ))}
                  <th className="text-center px-4 py-3 font-medium text-gray-500 w-20">Solved</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((row, i) => (
                  <tr key={row.student.id} className={i === 0 ? 'bg-yellow-50' : 'hover:bg-gray-50'}>
                    <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800">{row.student.name}</div>
                      <a
                        href={`https://codeforces.com/profile/${row.student.handle}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-blue-500 hover:underline"
                      >
                        {row.student.handle}
                      </a>
                    </td>
                    {contest.problems.map((p) => {
                      const sub = row.problems[p.cf_problem_id]
                      return (
                        <td key={p.id} className="px-4 py-3 text-center">
                          {sub?.solved ? (
                            <div>
                              <span className="text-green-600 font-bold text-base">✓</span>
                              {sub.solved_at && (
                                <div className="text-xs text-gray-400 mt-0.5">
                                  {elapsed(sub.solved_at)}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-300 text-base">–</span>
                          )}
                        </td>
                      )
                    })}
                    <td className="px-4 py-3 text-center font-bold text-gray-700">
                      {row.solvedCount}/{contest.problems.length}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  )
}
