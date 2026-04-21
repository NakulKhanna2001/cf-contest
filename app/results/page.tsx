import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { CONTEST_TIME_ZONE } from '@/lib/contest-time'

export const dynamic = 'force-dynamic'

async function getPastContests() {
  return prisma.contest.findMany({
    where: { status: 'ENDED', is_test: false },
    orderBy: { start_time: 'desc' },
    include: { problems: { orderBy: { slot: 'asc' } } },
  })
}

export default async function ResultsPage() {
  const contests = await getPastContests()

  function fmt(iso: Date) {
    return new Date(iso).toLocaleDateString([], {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      timeZone: CONTEST_TIME_ZONE,
    })
  }

  function fmtTime(iso: Date) {
    return new Date(iso).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: CONTEST_TIME_ZONE,
    })
  }

  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <nav style={{ borderBottom: '1px solid var(--border)', padding: '0 24px' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
              <span style={{ background: 'var(--accent)', color: '#fff', fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 12, padding: '2px 7px', borderRadius: 4 }}>CF</span>
            </Link>
            <span style={{ color: 'var(--border)' }}>·</span>
            <span className="font-display" style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>Past Results</span>
          </div>
          <Link href="/" className="nav-link">← Home</Link>
        </div>
      </nav>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 24px' }}>
        {contests.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--text-muted)', fontSize: 14 }}>
            No past contests yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {contests.map((c, i) => (
              <Link
                key={c.id}
                href={`/results/${c.id}`}
                className="card"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px 20px',
                  textDecoration: 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <span className="font-mono" style={{ fontSize: 12, color: 'var(--text-muted)', width: 24, textAlign: 'right' }}>
                    {i + 1}
                  </span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', marginBottom: 4 }}>
                      {fmt(c.start_time)}
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span className="font-mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {fmtTime(c.start_time)} → {fmtTime(c.end_time)}
                      </span>
                      {c.problems.map((p) => (
                        <span
                          key={p.id}
                          style={{
                            fontSize: 10,
                            background: 'var(--surface-raised)',
                            color: 'var(--text-secondary)',
                            padding: '2px 7px',
                            borderRadius: 4,
                            border: '1px solid var(--border)',
                            fontFamily: 'DM Mono, monospace',
                          }}
                        >
                          {p.slot}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <span style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 500 }}>View →</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
