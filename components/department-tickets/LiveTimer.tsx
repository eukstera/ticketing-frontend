import { useElapsedTime } from '@/hooks/useElapsedTime'

export default function LiveTimer({ startDate }: { startDate: string }) {
  const elapsed = useElapsedTime(startDate)
  return <span className="text-amber-600 font-medium tabular-nums">{elapsed}</span>
}
