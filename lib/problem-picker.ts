import {
  CFProblem,
  fetchProblemset,
  getUserSolvedProblemIds,
  getProblemId,
  sleep,
} from './cf-api'

export interface PickerSettings {
  b_rating_min: number
  b_rating_max: number
  c_rating_min: number
  c_rating_max: number
}

export interface PickedProblems {
  b: CFProblem
  c: CFProblem
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export async function pickProblems(
  studentHandles: string[],
  usedProblemIds: Set<string>,
  settings: PickerSettings
): Promise<PickedProblems> {
  // Fetch full CF problemset
  const allProblems = await fetchProblemset()

  // Collect every problem solved by any registered student
  const studentSolvedIds = new Set<string>()
  for (const handle of studentHandles) {
    try {
      const solved = await getUserSolvedProblemIds(handle)
      solved.forEach((id) => studentSolvedIds.add(id))
    } catch (err) {
      console.warn(`Could not fetch submissions for ${handle}:`, err)
    }
    await sleep(300)
  }

  const inRating = (p: CFProblem, min: number, max: number) =>
    p.rating !== undefined && p.rating >= min && p.rating <= max

  const notUsed = (p: CFProblem) => !usedProblemIds.has(getProblemId(p.contestId, p.index))
  const notSolvedByStudents = (p: CFProblem) =>
    !studentSolvedIds.has(getProblemId(p.contestId, p.index))

  // Primary filter: not used + not solved by students
  let bCandidates = allProblems.filter(
    (p) =>
      inRating(p, settings.b_rating_min, settings.b_rating_max) &&
      notUsed(p) &&
      notSolvedByStudents(p)
  )
  let cCandidates = allProblems.filter(
    (p) =>
      inRating(p, settings.c_rating_min, settings.c_rating_max) &&
      notUsed(p) &&
      notSolvedByStudents(p)
  )

  // Fallback: relax the student-solved filter
  if (bCandidates.length === 0) {
    console.warn('B: no unsolved candidates — falling back to unused-only')
    bCandidates = allProblems.filter(
      (p) => inRating(p, settings.b_rating_min, settings.b_rating_max) && notUsed(p)
    )
  }
  if (cCandidates.length === 0) {
    console.warn('C: no unsolved candidates — falling back to unused-only')
    cCandidates = allProblems.filter(
      (p) => inRating(p, settings.c_rating_min, settings.c_rating_max) && notUsed(p)
    )
  }

  if (bCandidates.length === 0) throw new Error('No B-slot candidates found even after fallback')
  if (cCandidates.length === 0) throw new Error('No C-slot candidates found even after fallback')

  const b = pickRandom(bCandidates)
  const bId = getProblemId(b.contestId, b.index)

  // Ensure B and C are distinct problems
  const filteredC = cCandidates.filter((p) => getProblemId(p.contestId, p.index) !== bId)
  if (filteredC.length === 0) throw new Error('Could not find a distinct C-slot problem')
  const c = pickRandom(filteredC)

  return { b, c }
}
