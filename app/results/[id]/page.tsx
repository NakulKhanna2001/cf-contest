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
  if (!contest || contest.is_test) notFound()

  // Build scoreboard
  const studentMap = new Map<string, {
    student: { id: string; name: string; handle: string }
    solvedCount: number
    penalty: number
    problems: Record<string, { solved: boolean; solved_at: Date | null; wrong_attempts: number }>
  }>()

  for (const sub of contest.submissions) {
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
      solved_at: sub.solved_at,
      wrong_attempts: sub.wrong_attempts,
    }
    if (sub.solved && sub.solved_at) {
      entry.solvedCount++
      const elapsedMin = Math.floor((sub.solved_at.getTime() - contest.start_time.getTime()) / 60000)
      entry.penalty += elapsedMin + sub.wrong_attempts * 20
    }
  }

  const rows = Array.from(studentMap.values()).sort((a, b) => {
    if (b.solvedCount !== a.solvedCount) return b.solvedCount - a.solvedCount
    return a.penalty - b.penalty
  })

  function elapsed(solved_at: Date) {
    const diff = Math.floor((solved_at.getTime() - contest!.start_time.getTime()) / 1000)
    const m = Math.floor(diff / 60)
    const s = diff % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <nav style={{ borderBottom: '1px solid var(--border)', padding: '0 24px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
              <span style={{ background: 'var(--accent)', color: '#fff', fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 12, padding: '2px 7px', borderRadius: 4 }}>CF</span>
            </Link>
            <span style={{ color: 'var(--border)' }}>·</span>
            <div>
              <span className="font-display" style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>Results</span>
              <span style={{ fontSize: 13, color: 'var(--text-muted)', marginLeft: 8 }}>
                {new Date(contest.start_time).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric', timeZone: CONTEST_TIME_ZONE })}
              </span>
            </div>
          </div>
          <Link href="/results" className="nav-link">← All Results</Link>
        </div>
      </nav>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px' }}>
        {/* Problems */}
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${contest.problems.length}, 1fr)`, gap: 12, marginBottom: 24 }}>
          {contest.problems.map((p) => (
            <a
              key={p.id}
              href={`https://codeforces.com/problemset/problem/${p.cf_problem_id.replace(/[A-Z]$/, '')}/${p.cf_problem_id.slice(-1)}`}
              target="_blank"
              rel="noreferrer"
              className="card"
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', textDecoration: 'none', transition: 'border-color 0.15s' }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
            >
              <span style={{ background: 'var(--accent-dim)', color: 'var(--accent)', fontFamily: 'DM Mono, monospace', fontWeight: 500, fontSize: 13, padding: '4px 10px', borderRadius: 6, flexShrink: 0 }}>
                {p.slot}
              </span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{p.problem_name}</div>
                <div className="font-mono" style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{p.rating}</div>
              </div>
            </a>
          ))}
        </div>

        {/* Results table */}
        {rows.length === 0 ? (
          <div className="card" style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>No participants.</div>
        ) : (
          <div className="card" style={{ overflow: 'hidden' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th>Student</th>
                  {contest.problems.map((p) => (
                    <th key={p.id} className="text-center" style={{ width: 110 }}>Problem {p.slot}</th>
                  ))}
                  <th className="text-center" style={{ width: 72 }}>Solved</th>
                  <th className="text-center" style={{ width: 80 }}>Penalty</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={row.student.id} style={i === 0 && row.solvedCount > 0 ? { background: 'rgba(52,211,153,0.04)' } : {}}>
                    <td>
                      <span className="font-mono" style={{ fontSize: 13, color: i < 3 ? 'var(--text-secondary)' : 'var(--text-muted)' }}>{i + 1}</span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{row.student.name}</div>
                      <a href={`https://codeforces.com/profile/${row.student.handle}`} target="_blank" rel="noreferrer" className="font-mono" style={{ fontSize: 11, color: 'var(--accent)', textDecoration: 'none' }}>
                        {row.student.handle}
                      </a>
                    </td>
                    {contest.problems.map((p) => {
                      const sub = row.problems[p.cf_problem_id]
                      return (
                        <td key={p.id} className="text-center">
                          {sub?.solved ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                              <span style={{ color: 'var(--green)', fontWeight: 700, fontSize: 15 }}>✓</span>
                              {sub.solved_at && <span className="font-mono" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{elapsed(sub.solved_at)}</span>}
                              {sub.wrong_attempts > 0 && <span style={{ fontSize: 10, color: 'var(--red)', fontWeight: 600 }}>+{sub.wrong_attempts} pen</span>}
                            </div>
                          ) : sub?.wrong_attempts > 0 ? (
                            <span className="font-mono" style={{ color: 'var(--red)', fontWeight: 600, fontSize: 13 }}>-{sub.wrong_attempts}</span>
                          ) : (
                            <span style={{ color: 'var(--border-bright)' }}>—</span>
                          )}
                        </td>
                      )
                    })}
                    <td className="text-center">
                      <span className="font-mono" style={{ fontWeight: 700, fontSize: 14, color: row.solvedCount > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                        {row.solvedCount}/{contest.problems.length}
                      </span>
                    </td>
                    <td className="text-center">
                      <span className="font-mono" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                        {row.solvedCount > 0 ? row.penalty : '—'}
                      </span>
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
