import { Metrics } from 'adapter-api'

// This possibly need to be moved outside CLI project to be shared with vscode-extension.
// One option is to move this to lowerdash module IMO it's not generic enough.
class MetricsCollector implements Metrics {
  readonly metrics: Map<string, number> = new Map<string, number>()

  report(metric: string, counter: number): Promise<void> {
    this.metrics.set(metric, (this.metrics.get(metric) || 0) + counter)
    return Promise.resolve()
  }

  getAll(): Map<string, number> {
    return this.metrics
  }
}

export default MetricsCollector
