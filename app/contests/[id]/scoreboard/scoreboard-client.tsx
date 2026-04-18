'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

interface Problem {
  id: string
  name: string
  rating: number
  slot: string
}

interface StudentScore {
  student: { id: string; name: string; handle: string }
  solvedCount: number
  penalty: number
  problems: Record<string, { solved: boolean; solved_at: string | null; wrong_attempts: number }>
}

interface ScoreboardData {
  contest: { id: string; status: string; start_time: string; end_time: string }
  problems: Problem[]
  scoreboard: StudentScore[]
  synced_at: string
}

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return `${diff}s ago`
  return `${Math.floor(diff / 60)}m ago`
}

function formatElapsed(start: string, solved: string) {
  const diff = Math.floor((new Date(solved).getTime() - new Date(start).getTime()) / 1000)
  const m = Math.floor(diff / 60)
  const s = diff % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function Countdown({ endTime }: { endTime: string }) {
  const [remaining, setRemaining] = useState('')
  const [urgent, setUrgent] = useState(false)

  useEffect(() => {
    function update() {
      const diff = Math.max(0, new Date(endTime).getTime() - Date.now())
      const m = Math.floor(diff / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setRemaining(`${m}:${s.toString().padStart(2, '0')}`)
      setUrgent(diff < 600000) // < 10 min
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [endTime])

  return (
    <span className="font-mono" style={{ color: urgent ? 'var(--red)' : 'var(--green)' }}>
      {remaining}
    </span>
  )
}

function ProblemCell({
  sub,
  start,
}: {
  sub: { solved: boolean; solved_at: string | null; wrong_attempts: number } | undefined
  start: string
}) {
  if (!sub) return <span style={{ color: 'var(--text-muted)' }}>—</span>

  if (sub.solved) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        <span style={{ color: 'var(--green)', fontWeight: 700, fontSize: 15 }}>✓</span>
        {sub.solved_at && (
          <span className="font-mono" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
            {formatElapsed(start, sub.solved_at)}
          </span>
        )}
        {sub.wrong_attempts > 0 && (
          <span style={{ fontSize: 10, color: 'var(--red)', fontWeight: 600 }}>
            +{sub.wrong_attempts} pen
          </span>
        )}
      </div>
    )
  }

  if (sub.wrong_attempts > 0) {
    return (
      <span className="font-mono" style={{ color: 'var(--red)', fontWeight: 600, fontSize: 13 }}>
        -{sub.wrong_attempts}
      </span>
    )
  }

  return <span style={{ color: 'var(--border-bright)' }}>—</span>
}

export function ScoreboardClient({ contestId }: { contestId: string }) {
  const [data, setData] = useState<ScoreboardData | null>(null)
  const [error, setError] = useState('')
  const [pollInterval, setPollInterval] = useState(30)

  useEffect(() => {
    fetch('/api/admin/settings')
      .then(async (r) => { if (!r.ok) return null; const t = await r.text(); return t ? JSON.parse(t) : null })
      .then((s) => s?.poll_interval_s && setPollInterval(s.poll_interval_s))
      .catch(() => {})
  }, [])

  const sync = useCallback(async () => {
    try {
      const res = await fetch(`/api/contests/${contestId}/sync`, { method: 'POST' })
      if (!res.ok) throw new Error('failed')
      const text = await res.text()
      setData(text ? JSON.parse(text) : null)
      setError('')
    } catch {
      setError('Failed to load scoreboard.')
    }
  }, [contestId])

  useEffect(() => { sync() }, [sync])

  useEffect(() => {
    if (!data || data.contest.status !== 'ACTIVE') return
    const id = setInterval(sync, pollInterval * 1000)
    return () => clearInterval(id)
  }, [data, sync, pollInterval])

  if (error && !data) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 12 }}>{error}</p>
          <Link href="/" style={{ color: 'var(--accent)', fontSize: 13 }}>← Back to home</Link>
        </div>
      </main>
    )
  }

  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Nav */}
      <nav style={{ borderBottom: '1px solid var(--border)', padding: '0 24px' }}>
        <div style={{
          maxWidth: 900,
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 56,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
              <span style={{
                background: 'var(--accent)',
                color: '#fff',
                fontFamily: 'Syne, sans-serif',
                fontWeight: 800,
                fontSize: 12,
                padding: '2px 7px',
                borderRadius: 4,
              }}>CF</span>
            </Link>
            <span style={{ color: 'var(--border)', fontSize: 16 }}>·</span>
            <span className="font-display" style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>
              Scoreboard
            </span>
            {data && (
              <span className="font-mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                #{data.contest.id.slice(-6)}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {data?.contest.status === 'ACTIVE' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="badge-live">LIVE</span>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 1 }}>TIME LEFT</div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>
                    <Countdown endTime={data.contest.end_time} />
                  </div>
                </div>
              </div>
            )}
            {data?.contest.status === 'ENDED' && (
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>Contest ended</span>
            )}
            {data && (
              <span className="font-mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                synced {timeAgo(data.synced_at)}
              </span>
            )}
          </div>
        </div>
      </nav>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px' }}>
        {!data ? (
          <div style={{ textAlign: 'center', paddingTop: 80, color: 'var(--text-muted)', fontSize: 14 }}>
            Loading scoreboard…
          </div>
        ) : data.contest.status === 'PENDING' ? (
          <div style={{ textAlign: 'center', paddingTop: 80 }}>
            <div style={{ fontSize: 36, marginBottom: 16 }}>🔒</div>
            <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
              Scoreboard is locked
            </p>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Available once the contest starts.
            </p>
            <Link href="/" style={{ display: 'inline-block', marginTop: 24, color: 'var(--accent)', fontSize: 13 }}>
              ← Back to home
            </Link>
          </div>
        ) : (
          <>
            {/* Problems */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${data.problems.length}, 1fr)`,
              gap: 12,
              marginBottom: 24,
            }}>
              {data.problems.map((p) => (
                <a
                  key={p.id}
                  href={`https://codeforces.com/problemset/problem/${p.id.replace(/[A-Z]$/, '')}/${p.id.slice(-1)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="card"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '14px 16px',
                    textDecoration: 'none',
                    transition: 'border-color 0.15s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
                >
                  <span style={{
                    background: 'var(--accent-dim)',
                    color: 'var(--accent)',
                    fontFamily: 'DM Mono, monospace',
                    fontWeight: 500,
                    fontSize: 13,
                    padding: '4px 10px',
                    borderRadius: 6,
                    flexShrink: 0,
                  }}>
                    {p.slot}
                  </span>
                  <div style={{ overflow: 'hidden' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.name}
                    </div>
                    <div className="font-mono" style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      {p.rating}
                    </div>
                  </div>
                </a>
              ))}
            </div>

            {/* Scoreboard */}
            {data.scoreboard.length === 0 ? (
              <div className="card" style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
                No students registered yet.
              </div>
            ) : (
              <div className="card" style={{ overflow: 'hidden' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}>#</th>
                      <th>Student</th>
                      {data.problems.map((p) => (
                        <th key={p.id} className="text-center" style={{ width: 110 }}>
                          Problem {p.slot}
                        </th>
                      ))}
                      <th className="text-center" style={{ width: 72 }}>Solved</th>
                      <th className="text-center" style={{ width: 80 }}>Penalty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.scoreboard.map((row, i) => (
                      <tr key={row.student.id} style={i === 0 && row.solvedCount > 0 ? { background: 'rgba(52,211,153,0.04)' } : {}}>
                        <td>
                          <span className="font-mono" style={{ fontSize: 13, color: i < 3 ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
                            {i + 1}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>
                            {row.student.name}
                          </div>
                          <a
                            href={`https://codeforces.com/profile/${row.student.handle}`}
                            target="_blank"
                            rel="noreferrer"
                            className="font-mono"
                            style={{ fontSize: 11, color: 'var(--accent)', textDecoration: 'none' }}
                          >
                            {row.student.handle}
                          </a>
                        </td>
                        {data.problems.map((p) => (
                          <td key={p.id} className="text-center">
                            <ProblemCell sub={row.problems[p.id]} start={data.contest.start_time} />
                          </td>
                        ))}
                        <td className="text-center">
                          <span className="font-mono" style={{ fontWeight: 700, fontSize: 14, color: row.solvedCount > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                            {row.solvedCount}/{data.problems.length}
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

            {/* Legend */}
            <div style={{ marginTop: 16, display: 'flex', gap: 20 }}>
              {[
                { symbol: '✓', color: 'var(--green)', label: 'Solved' },
                { symbol: '-N', color: 'var(--red)', label: 'Wrong attempts' },
                { symbol: '+N pen', color: 'var(--red)', label: '20 min per WA (ICPC)' },
              ].map((item) => (
                <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="font-mono" style={{ fontSize: 11, color: item.color, fontWeight: 600 }}>{item.symbol}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.label}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  )
}
