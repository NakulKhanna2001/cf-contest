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
  problems: Record<string, { solved: boolean; solved_at: string | null }>
}

interface ScoreboardData {
  contest: {
    id: string
    status: string
    start_time: string
    end_time: string
  }
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

  useEffect(() => {
    function update() {
      const diff = Math.max(0, new Date(endTime).getTime() - Date.now())
      const m = Math.floor(diff / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setRemaining(`${m}:${s.toString().padStart(2, '0')}`)
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [endTime])

  return <span>{remaining}</span>
}

export function ScoreboardClient({ contestId }: { contestId: string }) {
  const [data, setData] = useState<ScoreboardData | null>(null)
  const [error, setError] = useState('')
  const [pollInterval, setPollInterval] = useState(30)

  useEffect(() => {
    fetch('/api/admin/settings')
      .then(async (r) => {
        if (!r.ok) return null
        const text = await r.text()
        return text ? JSON.parse(text) : null
      })
      .then((s) => s?.poll_interval_s && setPollInterval(s.poll_interval_s))
      .catch(() => {})
  }, [])

  const sync = useCallback(async () => {
    try {
      const res = await fetch(`/api/contests/${contestId}/sync`, { method: 'POST' })
      if (!res.ok) {
        throw new Error('Failed to load scoreboard')
      }
      const text = await res.text()
      const json = text ? JSON.parse(text) : null
      setData(json)
      setError('')
    } catch {
      setError('Failed to load this contest scoreboard.')
    }
  }, [contestId])

  useEffect(() => {
    sync()
  }, [sync])

  useEffect(() => {
    if (!data || data.contest.status !== 'ACTIVE') return
    const id = setInterval(sync, pollInterval * 1000)
    return () => clearInterval(id)
  }, [data, sync, pollInterval])

  if (error && !data) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">{error}</p>
          <Link href="/" className="text-blue-600 hover:underline text-sm">
            Back to home
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="bg-blue-700 text-white py-4 px-4 shadow">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Contest Scoreboard</h1>
            {data && (
              <p className="text-blue-200 text-xs mt-0.5">
                Contest #{data.contest.id.slice(-6)} · synced {timeAgo(data.synced_at)}
                {data.contest.status === 'ACTIVE' ? ` · polling every ${pollInterval}s` : ''}
              </p>
            )}
          </div>
          <div className="flex items-center gap-4">
            {data?.contest.status === 'ACTIVE' && (
              <div className="text-right">
                <div className="text-xs text-blue-200">Time remaining</div>
                <div className="font-mono font-bold text-lg">
                  <Countdown endTime={data.contest.end_time} />
                </div>
              </div>
            )}
            <Link href="/" className="text-white border border-white px-3 py-1.5 rounded text-sm hover:bg-blue-600">
              Home
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {!data ? (
          <div className="text-center py-20 text-gray-400">Loading scoreboard…</div>
        ) : (
          <>
            <div className="bg-white rounded-xl shadow-sm border mb-6 p-4">
              <div className="grid grid-cols-2 gap-4">
                {data.problems.map((p) => (
                  <a
                    key={p.id}
                    href={`https://codeforces.com/problemset/problem/${p.id.replace(/[A-Z]$/, '')}/${p.id.slice(-1)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-3 hover:bg-gray-50 rounded-lg p-2 transition-colors"
                  >
                    <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded">
                      {p.slot}
                    </span>
                    <div>
                      <div className="text-sm font-medium text-gray-800">{p.name}</div>
                      <div className="text-xs text-gray-400">Rating {p.rating}</div>
                    </div>
                  </a>
                ))}
              </div>
            </div>

            {data.scoreboard.length === 0 ? (
              <p className="text-center text-gray-400 py-10">No students registered yet.</p>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-gray-500 w-8">#</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500">Student</th>
                      {data.problems.map((p) => (
                        <th key={p.id} className="text-center px-4 py-3 font-medium text-gray-500 w-28">
                          Problem {p.slot}
                        </th>
                      ))}
                      <th className="text-center px-4 py-3 font-medium text-gray-500 w-20">Solved</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.scoreboard.map((row, i) => (
                      <tr key={row.student.id} className="hover:bg-gray-50">
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
                        {data.problems.map((p) => {
                          const sub = row.problems[p.id]
                          return (
                            <td key={p.id} className="px-4 py-3 text-center">
                              {sub?.solved ? (
                                <div>
                                  <span className="text-green-600 font-bold text-base">✓</span>
                                  {sub.solved_at && (
                                    <div className="text-xs text-gray-400 mt-0.5">
                                      {formatElapsed(data.contest.start_time, sub.solved_at)}
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
                          {row.solvedCount}/{data.problems.length}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}
