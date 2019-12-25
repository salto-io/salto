type IntervalEntry = {
  startTime: Date
  intervalId: NodeJS.Timeout
}

export default class IntervalScheduler {
  private readonly intervals = new Map<string, IntervalEntry>()
  constructor(
    private readonly f: (id: string, startTime: Date) => void,
    private readonly interval: number
  ) { }

  schedule(id: string): void {
    const startTime = new Date()
    this.intervals.set(id, {
      startTime,
      intervalId: setInterval(() => this.f(id, startTime), this.interval),
    })
  }

  unschedule(id: string): void {
    const { intervalId } = this.intervals.get(id) ?? {}
    if (intervalId === undefined) return
    clearTimeout(intervalId)
    this.intervals.delete(id)
  }

  clear(): void {
    [...this.intervals.values()].map(v => v.intervalId).forEach(clearInterval)
    this.intervals.clear()
  }
}
