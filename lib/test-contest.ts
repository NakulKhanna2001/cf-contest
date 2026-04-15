type TestStudentInput = {
  name: string
  cf_handle: string
  is_test: true
}

const FIRST_NAMES = [
  'Aarav',
  'Isha',
  'Kabir',
  'Meera',
  'Vihaan',
  'Anaya',
  'Rohan',
  'Siya',
  'Arjun',
  'Diya',
]

const LAST_NAMES = [
  'Sharma',
  'Patel',
  'Reddy',
  'Gupta',
  'Nair',
  'Joshi',
  'Kapoor',
  'Verma',
  'Iyer',
  'Singh',
]

function pickRandom<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)]
}

export function buildRandomTestStudents(count: number): TestStudentInput[] {
  const suffix = Date.now().toString(36)

  return Array.from({ length: count }, (_, index) => {
    const first = pickRandom(FIRST_NAMES)
    const last = pickRandom(LAST_NAMES)
    return {
      name: `${first} ${last}`,
      cf_handle: `test_${suffix}_${index + 1}`,
      is_test: true,
    }
  })
}

export function getRandomSolvedAt(startTime: Date, endTime: Date) {
  const min = startTime.getTime()
  const max = endTime.getTime() - 60_000
  const solvedAt = Math.floor(min + Math.random() * Math.max(max - min, 1))
  return new Date(solvedAt)
}
