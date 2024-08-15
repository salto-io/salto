/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
type IntervalEntry = {
  startTime: Date
  intervalId: NodeJS.Timeout
}

export default class IntervalScheduler {
  private readonly intervals = new Map<string, IntervalEntry>()
  constructor(
    private readonly f: (id: string, startTime: Date) => void,
    private readonly interval: number,
  ) {}

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
    ;[...this.intervals.values()].map(v => v.intervalId).forEach(clearInterval)
    this.intervals.clear()
  }

  size(): number {
    return this.intervals.size
  }
}
