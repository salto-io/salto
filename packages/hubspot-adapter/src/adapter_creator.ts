import {
  AdapterCreator, BuiltinTypes, ElemID, Field,
  InstanceElement, ObjectType,
} from 'adapter-api'
import HubspotClient, { Credentials } from './client/client'
import HubspotAdapter from './adapter'

const configID = new ElemID('hubspot')

const configType = new ObjectType({
  elemID: configID,
  fields: {
    apiKey: new Field(configID, 'apiKey', BuiltinTypes.STRING),
  },
  annotationTypes: {},
  annotations: {},
})

const credentialsFromConfig = (config: InstanceElement): Credentials => ({
  apiKey: config.value.apiKey,
})

const clientFromConfig = (config: InstanceElement): HubspotClient =>
  new HubspotClient(
    {
      credentials: credentialsFromConfig(config),
    }
  )

export const creator: AdapterCreator = {
  create: ({ config }) => new HubspotAdapter({
    client: clientFromConfig(config),
  }),
  validateConfig: config => {
    const credentials = credentialsFromConfig(config)
    return HubspotClient.validateCredentials(credentials)
  },
  configType,
}
