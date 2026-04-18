'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { CONTEST_TIME_ZONE } from '@/lib/contest-time'

interface Student {
  id: string
  name: string
  cf_handle: string
  registered_at: string
}

interface Contest {
  id: string
  status: string
  start_time: string
  end_time: string
  problems: { slot: string; problem_name: string; cf_problem_id: string; rating: number }[]
}

interface SyncData {
  contest: { id: string; status: string; start_time: string; end_time: string }
  scoreboard: { student: { name: string; handle: string }; solvedCount: number }[]
  synced_at: string
}

export default function AdminDashboard() {
  const [students, setStudents] = useState<Student[]>([])
  const [contest, setContest] = useState<Contest | null>(null)
  const [syncData, setSyncData] = useState<SyncData | null>(null)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    fetch('/api/students').then((r) => r.json()).then(setStudents)
    fetch('/api/contests/active').then((r) => r.json()).then((d) => setContest(d.contest))
  }, [])

  async function handleSync() {
    if (!contest) return
    setSyncing(true)
    const res = await fetch(`/api/contests/${contest.id}/sync`, { method: 'POST' })
    const data = await res.json()
    setSyncData(data)
    setSyncing(false)
  }

  function fmt(iso: string) {
    return new Date(iso).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: CONTEST_TIME_ZONE,
    })
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="bg-blue-700 text-white py-4 px-4 shadow">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold">Admin Dashboard</h1>
          <div className="flex gap-3 text-sm">
            <Link href="/admin/settings" className="text-white border border-white px-3 py-1.5 rounded hover:bg-blue-600">
              Settings
            </Link>
            <Link href="/" className="text-blue-200 hover:text-white">
              View Site
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Tonight's contest */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold mb-4">Tonight&apos;s Contest</h2>
          {contest ? (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  contest.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                }`}>
                  {contest.status}
                </span>
                <span className="text-sm text-gray-500">
                  {fmt(contest.start_time)} – {fmt(contest.end_time)}
                </span>
              </div>
              <div className="flex gap-3 mb-4 flex-wrap">
                {contest.problems.map((p) => (
                  <a
                    key={p.cf_problem_id}
                    href={`https://codeforces.com/problemset/problem/${p.cf_problem_id.replace(/[A-Z]$/, '')}/${p.cf_problem_id.slice(-1)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm border rounded px-3 py-1.5 hover:bg-gray-50"
                  >
                    <span className="font-medium">{p.slot}:</span> {p.problem_name} ({p.rating})
                  </a>
                ))}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleSync}
                  disabled={syncing}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {syncing ? 'Syncing…' : 'Sync Now'}
                </button>
                <Link
                  href={`/contests/${contest.id}/scoreboard`}
                  className="border px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50"
                >
                  Contest Scoreboard
                </Link>
              </div>
              {syncData && (
                <p className="text-xs text-gray-400 mt-2">
                  Last synced: {new Date(syncData.synced_at).toLocaleTimeString()}
                </p>
              )}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">
              No active contest. The cron job creates one automatically at 9:30 PM IST.
            </p>
          )}
        </div>

        {/* Students */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold mb-4">
            Registered Students{' '}
            <span className="text-gray-400 font-normal text-base">({students.length})</span>
          </h2>
          {students.length === 0 ? (
            <p className="text-gray-400 text-sm">No students registered yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-gray-500">Name</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-500">CF Handle</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-500">Registered</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {students.map((s) => (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-medium text-gray-800">{s.name}</td>
                      <td className="px-3 py-2">
                        <a
                          href={`https://codeforces.com/profile/${s.cf_handle}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-500 hover:underline"
                        >
                          {s.cf_handle}
                        </a>
                      </td>
                      <td className="px-3 py-2 text-gray-600">
                        {new Date(s.registered_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
