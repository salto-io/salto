import MemoryMetricsCollector from '../src/metrics-collector'

describe('memory metrics', () => {
  let collector: MemoryMetricsCollector
  beforeEach(() => {
    collector = new MemoryMetricsCollector()
  })
  it('should return empty metrics', () => {
    expect(collector.getAll()).toEqual(new Map<string, number>())
  })

  it('should return undefined for not existing metric', () => {
    expect(collector.getAll().get('BLA')).toBeUndefined()
  })

  it('should collect metrics', () => {
    collector.report('BLA', 7)
    collector.report('BLA2', 8)
    expect(collector.getAll().get('BLA')).toBe(7)
    expect(collector.getAll().get('BLA2')).toBe(8)
  })

  it('should aggregate metrics', () => {
    collector.report('BLA', 7)
    collector.report('BLA', 8)
    expect(collector.getAll().get('BLA')).toBe(15)
  })
})
