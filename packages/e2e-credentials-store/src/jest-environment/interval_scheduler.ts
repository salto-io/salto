/*
 *                      Copyright 2024 Salto Labs Ltd.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
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
