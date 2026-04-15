import { ScoreboardClient } from './scoreboard-client'

export default async function ContestScoreboardPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <ScoreboardClient contestId={id} />
}
