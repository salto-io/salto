import { creator as salesforceAdapterCreator } from 'salesforce-adapter'
import { AdapterCreator } from 'adapter-api'
import { creator as hubspotAdapterCreator } from '@salto/hubspot-adapter'

const adapterCreators: Record<string, AdapterCreator> = {
  salesforce: salesforceAdapterCreator,
  hubspot: hubspotAdapterCreator,
}

export default adapterCreators
