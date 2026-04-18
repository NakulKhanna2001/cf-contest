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

function ContestCountdown({ targetTime, label }: { targetTime: string; label: string }) {
  const [display, setDisplay] = useState('')
  const [urgent, setUrgent] = useState(false)

  useEffect(() => {
    function tick() {
      const diff = Math.max(0, new Date(targetTime).getTime() - Date.now())
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setDisplay(h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`)
      setUrgent(diff < 600000)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [targetTime])

  return (
    <div style={{ marginTop: 12 }}>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</p>
      <span className="font-mono" style={{ fontSize: 24, fontWeight: 700, color: urgent ? 'var(--red)' : 'var(--accent)' }}>
        {display}
      </span>
    </div>
  )
}

function contestLabel(startIso: string): string {
  const start = new Date(startIso)
  const now = new Date()
  const startIST = new Date(start.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
  const nowIST = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
  const isTomorrow = startIST.getDate() !== nowIST.getDate()
  return isTomorrow ? 'Tomorrow' : 'Tonight'
}

export default function HomePage() {
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
        if (!res.ok) throw new Error('failed')
        const text = await res.text()
        const data = text ? JSON.parse(text) : { contest: null }
        setContest(data.contest)
      } catch {
        setContestError('Could not load contest status.')
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
      body: JSON.stringify({ cf_handle: handle }),
    })
    const data = await res.json()
    if (res.ok) {
      setStatus('success')
      setMessage(`${handle} is registered for tonight's contest.`)
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

  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Nav */}
      <nav style={{
        borderBottom: '1px solid var(--border)',
        padding: '0 24px',
      }}>
        <div style={{
          maxWidth: 760,
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 56,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              background: 'var(--accent)',
              color: '#fff',
              fontFamily: 'Syne, sans-serif',
              fontWeight: 800,
              fontSize: 13,
              padding: '3px 8px',
              borderRadius: 5,
              letterSpacing: '0.02em',
            }}>CF</span>
            <span className="font-display" style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>
              Practice Arena
            </span>
          </div>
          <Link href="/results" className="nav-link">Past Results</Link>
        </div>
      </nav>

      {/* Hero */}
      <div style={{
        maxWidth: 760,
        margin: '0 auto',
        padding: '48px 24px 0',
      }}>
        <div style={{ marginBottom: 40 }}>
          <p className="font-mono" style={{ color: 'var(--accent)', fontSize: 12, letterSpacing: '0.1em', marginBottom: 10 }}>
            NIGHTLY · 9:30 PM – 10:30 PM IST
          </p>
          <h1 className="font-display" style={{ fontSize: 36, fontWeight: 800, lineHeight: 1.15, color: 'var(--text-primary)', margin: 0 }}>
            Tonight&apos;s Contest
          </h1>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* Contest status card */}
          <div className="card" style={{ padding: 24 }}>
            <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 16 }}>
              Contest Status
            </p>

            {contestLoading ? (
              <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading…</div>
            ) : contestError ? (
              <div style={{ color: 'var(--red)', fontSize: 13 }}>{contestError}</div>
            ) : contest ? (
              contest.status === 'ACTIVE' ? (
                <div>
                  <div style={{ marginBottom: 16 }}>
                    <span className="badge-live">LIVE NOW</span>
                  </div>
                  <div className="font-mono" style={{ fontSize: 22, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>
                    {formatTime(contest.start_time)}
                    <span style={{ color: 'var(--text-muted)', margin: '0 8px', fontWeight: 400 }}>→</span>
                    {formatTime(contest.end_time)}
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 12 }}>
                    Problems are live — check the scoreboard.
                  </p>
                  <Link
                    href={`/contests/${contest.id}/scoreboard`}
                    style={{
                      display: 'block',
                      marginTop: 16,
                      background: 'var(--green-dim)',
                      color: 'var(--green)',
                      border: '1px solid rgba(52,211,153,0.25)',
                      borderRadius: 8,
                      padding: '8px 0',
                      textAlign: 'center',
                      fontSize: 13,
                      fontWeight: 600,
                      textDecoration: 'none',
                      transition: 'background 0.15s',
                    }}
                  >
                    View Live Scoreboard →
                  </Link>
                </div>
              ) : (
                <div>
                  <div style={{ marginBottom: 16 }}>
                    <span className="badge-upcoming">UPCOMING</span>
                  </div>
                  <div className="font-mono" style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                    {contestLabel(contest.start_time)} · {formatTime(contest.start_time)} – {formatTime(contest.end_time)}
                  </div>
                  <ContestCountdown
                    targetTime={contest.start_time}
                    label="Contest starts in"
                  />
                  <div style={{
                    marginTop: 14,
                    padding: '10px 14px',
                    borderRadius: 8,
                    border: '1px dashed var(--border-bright)',
                    fontSize: 12,
                    color: 'var(--text-muted)',
                  }}>
                    Problems are revealed at {formatTime(contest.start_time)}.
                  </div>
                </div>
              )
            ) : (
              <div>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🌙</div>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  No contest yet. Problems are auto-selected at 9:30 PM.
                </p>
              </div>
            )}
          </div>

          {/* Registration card */}
          <div className="card" style={{ padding: 24 }}>
            <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 16 }}>
              Register
            </p>

            {contestLoading ? (
              <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading…</div>
            ) : !contest ? (
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                No upcoming contest. Registration opens after 10:30 PM.
              </p>
            ) : contest.status === 'ACTIVE' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Registration is closed — the contest is live.
                </p>
                <Link
                  href={`/contests/${contest.id}/scoreboard`}
                  style={{
                    display: 'block',
                    background: 'var(--green-dim)',
                    color: 'var(--green)',
                    border: '1px solid rgba(52,211,153,0.25)',
                    borderRadius: 8,
                    padding: '10px 0',
                    textAlign: 'center',
                    fontSize: 13,
                    fontWeight: 600,
                    textDecoration: 'none',
                    transition: 'background 0.15s',
                  }}
                >
                  View Live Scoreboard →
                </Link>
              </div>
            ) : status === 'success' ? (
              <div style={{
                background: 'var(--green-dim)',
                border: '1px solid rgba(52,211,153,0.2)',
                borderRadius: 8,
                padding: '14px 16px',
                color: 'var(--green)',
                fontSize: 13,
                fontWeight: 500,
                lineHeight: 1.5,
              }}>
                <div style={{ fontSize: 18, marginBottom: 6 }}>✓</div>
                {message}
              </div>
            ) : (
              <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: 12,
                    fontWeight: 500,
                    color: 'var(--text-secondary)',
                    marginBottom: 6,
                  }}>
                    Codeforces Handle
                  </label>
                  <input
                    type="text"
                    value={handle}
                    onChange={(e) => setHandle(e.target.value)}
                    placeholder="e.g. tourist"
                    required
                    className="input-field"
                  />
                </div>

                {status === 'error' && (
                  <div style={{
                    background: 'var(--red-dim)',
                    border: '1px solid rgba(248,113,113,0.2)',
                    borderRadius: 6,
                    padding: '8px 12px',
                    color: 'var(--red)',
                    fontSize: 12,
                  }}>
                    {message}
                  </div>
                )}

                <button type="submit" disabled={status === 'loading'} className="btn-primary">
                  {status === 'loading' ? 'Verifying…' : 'Register for Tonight'}
                </button>

                <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginTop: 2 }}>
                  Registration closes 5 min before start · Register each night
                </p>
              </form>
            )}
          </div>
        </div>

        {/* Footer info */}
        <div style={{
          marginTop: 32,
          paddingTop: 24,
          borderTop: '1px solid var(--border)',
          display: 'flex',
          gap: 32,
        }}>
          {[
            { label: 'Problem B', value: '1000–1300 rating' },
            { label: 'Problem C', value: '1300–1600 rating' },
            { label: 'Duration', value: '60 minutes' },
          ].map((item) => (
            <div key={item.label}>
              <p className="font-mono" style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>{item.label}</p>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>{item.value}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
