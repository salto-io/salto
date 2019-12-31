import { creator as salesforceAdapterCreator } from 'salesforce-adapter'
import { AdapterCreator } from 'adapter-api'

const adapterCreators: Record<string, AdapterCreator> = {
  salesforce: salesforceAdapterCreator,
}

export const isAdapterAvailable = (adapterName: string): boolean => !!adapterCreators[adapterName]

export default adapterCreators
