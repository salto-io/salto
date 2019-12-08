export default class IntervalScheduler {
  private readonly intervals = new Map<string, NodeJS.Timeout>()
  constructor(
    private readonly f: (id: string) => void,
    private readonly interval: number
  ) { }

  schedule(id: string): void {
    this.intervals.set(id, setInterval(() => this.f(id), this.interval))
  }

  unschedule(id: string): void {
    const intervalId = this.intervals.get(id)
    if (intervalId === undefined) return
    clearTimeout(intervalId)
    this.intervals.delete(id)
  }

  clear(): void {
    [...this.intervals.values()].forEach(clearInterval)
    this.intervals.clear()
  }
}
