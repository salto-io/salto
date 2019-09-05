import {
  InstanceElement, ElemID,
} from 'adapter-api'
import {
  creator as salesforceAdapterCreator,
} from 'salesforce-adapter'
import createCredentials from './credentials'

export default {
  salesforce: (): InstanceElement => {
    const credentials = createCredentials()
    const configValues = {
      username: credentials.salesforce.username,
      password: credentials.salesforce.password,
      token: credentials.salesforce.apiToken,
      sandbox: credentials.salesforce.isSandbox,
    }

    const { configType } = salesforceAdapterCreator

    return new InstanceElement(
      new ElemID(configType.elemID.adapter, ElemID.CONFIG_INSTANCE_NAME),
      configType,
      configValues,
    )
  },
}
