const CF_BASE = 'https://codeforces.com/api'

export interface CFProblem {
  contestId: number
  index: string
  name: string
  rating?: number
  tags: string[]
}

export interface CFSubmission {
  id: number
  verdict: string
  creationTimeSeconds: number
  problem: {
    contestId: number
    index: string
    name: string
  }
}

export function getProblemId(contestId: number, index: string): string {
  return `${contestId}${index}`
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function fetchProblemset(): Promise<CFProblem[]> {
  const res = await fetch(`${CF_BASE}/problemset.problems`, { cache: 'no-store' })
  const data = await res.json()
  if (data.status !== 'OK') throw new Error(`CF API error: ${data.comment}`)
  return data.result.problems as CFProblem[]
}

export async function fetchUserSubmissions(handle: string): Promise<CFSubmission[]> {
  const url = `${CF_BASE}/user.status?handle=${encodeURIComponent(handle)}&count=500`
  const res = await fetch(url, { cache: 'no-store' })
  const data = await res.json()
  if (data.status !== 'OK') throw new Error(`CF API error for ${handle}: ${data.comment}`)
  return data.result as CFSubmission[]
}

export async function getUserSolvedProblemIds(handle: string): Promise<Set<string>> {
  const submissions = await fetchUserSubmissions(handle)
  const solved = new Set<string>()
  for (const sub of submissions) {
    if (sub.verdict === 'OK') {
      solved.add(getProblemId(sub.problem.contestId, sub.problem.index))
    }
  }
  return solved
}
