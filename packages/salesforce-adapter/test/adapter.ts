import Connection from '../src/client/connection'
import SalesforceClient from '../src/client/client'
import SalesforceAdapter, { SalesforceAdapterParams } from '../src/adapter'
import createConnection from './connection'

export type Mocks = {
  connection: Connection
  client: SalesforceClient
  adapter: SalesforceAdapter
}

export type Opts = {
  adapterParams?: Partial<SalesforceAdapterParams>
}

const mockAdapter = ({ adapterParams }: Opts = {}): Mocks => {
  const connection = createConnection()
  const client = new SalesforceClient('', '', false, { connection })
  const adapter = new SalesforceAdapter({ clientOrConfig: client, ...adapterParams || {} })
  return { connection, client, adapter }
}

export default mockAdapter
