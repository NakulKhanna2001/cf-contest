'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { CONTEST_TIME_ZONE } from '@/lib/contest-time'

interface Contest {
  id: string
  start_time: string
  end_time: string
  status: string
  problems: { slot: string; problem_name: string; cf_problem_id: string; rating: number }[]
}

export default function HomePage() {
  const [name, setName] = useState('')
  const [handle, setHandle] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [contest, setContest] = useState<Contest | null>(null)
  const [contestLoading, setContestLoading] = useState(true)
  const [contestError, setContestError] = useState('')

  useEffect(() => {
    async function loadContest() {
      try {
        const res = await fetch('/api/contests/active')
        if (!res.ok) {
          throw new Error('Failed to load contest status')
        }

        const text = await res.text()
        const data = text ? JSON.parse(text) : { contest: null }
        setContest(data.contest)
      } catch {
        setContestError('Could not load contest status right now.')
      } finally {
        setContestLoading(false)
      }
    }

    loadContest()
  }, [])

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setStatus('loading')
    setMessage('')

    const res = await fetch('/api/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, cf_handle: handle }),
    })
    const data = await res.json()

    if (res.ok) {
      setStatus('success')
      setMessage(`Registered! Welcome, ${name}. You are all set for tonight's contest.`)
      setName('')
      setHandle('')
    } else {
      setStatus('error')
      setMessage(data.error ?? 'Something went wrong')
    }
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: CONTEST_TIME_ZONE,
    })
  }

  function cfProblemUrl(id: string) {
    const contestId = id.replace(/[A-Z]$/, '')
    const index = id.slice(-1)
    return `https://codeforces.com/problemset/problem/${contestId}/${index}`
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="bg-blue-700 text-white py-6 px-4 shadow">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">CF Practice Contest</h1>
            <p className="text-blue-200 text-sm mt-1">Nightly 9:30 PM – 10:30 PM IST</p>
          </div>
          <div className="flex gap-3 text-sm">
            {contest ? (
              <Link
                href={`/contests/${contest.id}/scoreboard`}
                className="bg-white text-blue-700 px-3 py-1.5 rounded font-medium hover:bg-blue-50"
              >
                Scoreboard
              </Link>
            ) : (
              <span className="bg-white/20 text-white px-3 py-1.5 rounded font-medium">
                Scoreboard
              </span>
            )}
            <Link
              href="/results"
              className="text-white border border-white px-3 py-1.5 rounded hover:bg-blue-600"
            >
              Past Results
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-10 space-y-8">
        {/* Tonight's contest */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold mb-3">Tonight&apos;s Contest</h2>
          {contestLoading ? (
            <p className="text-gray-400 text-sm">Loading…</p>
          ) : contestError ? (
            <p className="text-red-600 text-sm">{contestError}</p>
          ) : contest ? (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    contest.status === 'ACTIVE'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-yellow-100 text-yellow-700'
                  }`}
                >
                  {contest.status === 'ACTIVE' ? 'LIVE NOW' : 'Upcoming'}
                </span>
                <span className="text-sm text-gray-500">
                  {formatTime(contest.start_time)} – {formatTime(contest.end_time)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {contest.problems.map((p) => (
                  <a
                    key={p.cf_problem_id}
                    href={cfProblemUrl(p.cf_problem_id)}
                    target="_blank"
                    rel="noreferrer"
                    className="border rounded-lg p-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="text-xs text-gray-400 font-medium">Problem {p.slot}</div>
                    <div className="font-medium text-gray-800 mt-0.5 text-sm">{p.problem_name}</div>
                    <div className="text-xs text-blue-600 mt-1">Rating {p.rating}</div>
                  </a>
                ))}
              </div>
              {contest.status === 'ACTIVE' && (
                <Link
                  href={`/contests/${contest.id}/scoreboard`}
                  className="mt-4 block w-full text-center bg-green-600 text-white py-2 rounded-lg font-medium hover:bg-green-700 transition-colors"
                >
                  View Live Scoreboard
                </Link>
              )}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">
              No contest yet — problems are selected automatically at 9:30 PM.
            </p>
          )}
        </div>

        {/* Registration */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold mb-1">Register</h2>
          <p className="text-sm text-gray-500 mb-4">
            Enter your name and Codeforces handle to participate. Registration closes 5 minutes
            before the contest starts.
          </p>

          {status === 'success' ? (
            <div className="bg-green-50 border border-green-200 text-green-800 rounded-lg p-4 text-sm">
              {message}
            </div>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  required
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Codeforces Handle
                </label>
                <input
                  type="text"
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                  placeholder="e.g. tourist"
                  required
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {status === 'error' && <p className="text-red-600 text-sm">{message}</p>}
              <button
                type="submit"
                disabled={status === 'loading'}
                className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {status === 'loading' ? 'Registering…' : 'Register'}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  )
}
