import HubspotAdapter, { HubspotAdapterParams } from '../src/adapter'
import createClient from './client'
import HubspotClient from '../src/client/client'

export type Mocks = {
  client: HubspotClient
  adapter: HubspotAdapter
}

export type Opts = {
  adapterParams?: Partial<HubspotAdapterParams>
}

const mockAdapter = ({ adapterParams }: Opts = {}): Mocks => {
  const { client } = createClient()
  const adapter = new HubspotAdapter({ client, ...adapterParams || {} })
  return {
    client, adapter,
  }
}

export default mockAdapter
