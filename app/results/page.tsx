import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { CONTEST_TIME_ZONE } from '@/lib/contest-time'

export const dynamic = 'force-dynamic'

async function getPastContests() {
  return prisma.contest.findMany({
    where: { status: 'ENDED' },
    orderBy: { start_time: 'desc' },
    include: { problems: { orderBy: { slot: 'asc' } } },
  })
}

export default async function ResultsPage() {
  const contests = await getPastContests()

  function fmt(iso: Date) {
    return new Date(iso).toLocaleDateString([], {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      timeZone: CONTEST_TIME_ZONE,
    })
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="bg-blue-700 text-white py-4 px-4 shadow">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold">Past Results</h1>
          <Link href="/" className="text-white border border-white px-3 py-1.5 rounded text-sm hover:bg-blue-600">
            Home
          </Link>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">
        {contests.length === 0 ? (
          <p className="text-center text-gray-400 py-20">No past contests yet.</p>
        ) : (
          <div className="space-y-3">
            {contests.map((c) => (
              <Link
                key={c.id}
                href={`/results/${c.id}`}
                className="block bg-white rounded-xl border shadow-sm p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold text-gray-800">{fmt(c.start_time)}</div>
                    <div className="text-sm text-gray-400 mt-0.5">
                      {new Date(c.start_time).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        timeZone: CONTEST_TIME_ZONE,
                      })}{' '}
                      –{' '}
                      {new Date(c.end_time).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        timeZone: CONTEST_TIME_ZONE,
                      })}
                    </div>
                    <div className="mt-3 flex gap-2 flex-wrap">
                      {c.problems.map((p) => (
                        <span
                          key={p.id}
                          className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded"
                        >
                          {p.slot}: {p.problem_name} ({p.rating})
                        </span>
                      ))}
                    </div>
                  </div>
                  <span className="text-blue-600 text-sm font-medium">View →</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
