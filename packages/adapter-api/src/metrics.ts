export interface Metrics {
  report(metric: string, counter: number): Promise<void>
}
