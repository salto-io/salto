import { Metrics } from 'adapter-api'
import SalesforceClient from 'src/client/client'
import createClient from './client'

const mockMetrics = (): Metrics => ({
  report: jest.fn().mockImplementation(() => Promise.resolve()),
})

describe('Salesforce Client', () => {
  let metrics: Metrics
  let client: SalesforceClient

  beforeEach(() => {
    metrics = mockMetrics()
    client = createClient(metrics).client
  })

  it('should collect metrics', async () => {
    await client.create('type', { fullName: 'name' })
    const metricsCalls = (metrics.report as jest.Mock).mock.calls
    expect(metricsCalls).toHaveLength(2)
    expect(metricsCalls[0][0]).toBe('API.SFDC.login')
    expect(metricsCalls[0][1]).toBe(1)
    expect(metricsCalls[1][0]).toBe('API.SFDC.metadata.create')
    expect(metricsCalls[1][1]).toBe(1)
  })
})
