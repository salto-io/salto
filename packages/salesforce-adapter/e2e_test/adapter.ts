import SalesforceClient from '../src/client/client'
import SalesforceAdapter, { SalesforceAdapterParams } from '../src/adapter'
import realClient from './client'

export type Reals = {
  client: SalesforceClient
  adapter: SalesforceAdapter
}

export type Opts = {
  adapterParams?: Partial<SalesforceAdapterParams>
}

const realAdapter = ({ adapterParams }: Opts = {}): Reals => {
  const client = (adapterParams && adapterParams.client) || realClient()
  const adapter = new SalesforceAdapter({ client, ...adapterParams || {} })
  return { client, adapter }
}

export default realAdapter
