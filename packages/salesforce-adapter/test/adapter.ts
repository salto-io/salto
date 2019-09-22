import Connection from '../src/client/jsforce'
import SalesforceClient from '../src/client/client'
import SalesforceAdapter, { SalesforceAdapterParams } from '../src/adapter'
import createClient from './client'

export type Mocks = {
  connection: Connection
  client: SalesforceClient
  adapter: SalesforceAdapter
}

export type Opts = {
  adapterParams?: Partial<SalesforceAdapterParams>
}

const mockAdapter = ({ adapterParams }: Opts = {}): Mocks => {
  const { connection, client } = createClient()
  const adapter = new SalesforceAdapter({ client, ...adapterParams || {} })
  return { connection, client, adapter }
}

export default mockAdapter
