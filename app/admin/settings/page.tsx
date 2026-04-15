'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Settings {
  b_rating_min: number
  b_rating_max: number
  c_rating_min: number
  c_rating_max: number
  poll_interval_s: number
}

export default function AdminSettings() {
  const [settings, setSettings] = useState<Settings>({
    b_rating_min: 1200,
    b_rating_max: 1600,
    c_rating_min: 1400,
    c_rating_max: 1700,
    poll_interval_s: 30,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/admin/settings')
      .then((r) => r.json())
      .then(setSettings)
      .finally(() => setLoading(false))
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaved(false)
    await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  function field(label: string, key: keyof Settings) {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
        <input
          type="number"
          value={settings[key]}
          onChange={(e) => setSettings((s) => ({ ...s, [key]: Number(e.target.value) }))}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          min={0}
        />
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="bg-blue-700 text-white py-4 px-4 shadow">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold">Settings</h1>
          <Link href="/admin/dashboard" className="text-white border border-white px-3 py-1.5 rounded text-sm hover:bg-blue-600">
            Dashboard
          </Link>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-sm border p-6">
          {loading ? (
            <p className="text-gray-400 text-sm">Loading…</p>
          ) : (
            <form onSubmit={handleSave} className="space-y-6">
              <div>
                <h2 className="font-semibold text-gray-700 mb-3">Problem B (Div. 2 B style)</h2>
                <div className="grid grid-cols-2 gap-4">
                  {field('Min Rating', 'b_rating_min')}
                  {field('Max Rating', 'b_rating_max')}
                </div>
              </div>

              <div>
                <h2 className="font-semibold text-gray-700 mb-3">Problem C (Div. 2 C style)</h2>
                <div className="grid grid-cols-2 gap-4">
                  {field('Min Rating', 'c_rating_min')}
                  {field('Max Rating', 'c_rating_max')}
                </div>
              </div>

              <div>
                <h2 className="font-semibold text-gray-700 mb-3">Scoreboard</h2>
                {field('Poll Interval (seconds)', 'poll_interval_s')}
                <p className="text-xs text-gray-400 mt-1">
                  How often the scoreboard syncs with Codeforces during a contest.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-blue-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? 'Saving…' : 'Save Settings'}
                </button>
                {saved && (
                  <span className="text-green-600 text-sm font-medium">Saved!</span>
                )}
              </div>
            </form>
          )}
        </div>
      </div>
    </main>
  )
}
