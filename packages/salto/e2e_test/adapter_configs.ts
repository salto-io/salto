import {
  InstanceElement, ElemID, ObjectType,
} from 'adapter-api'
import {
  adapterId as salesforceAdapterId,
} from 'salesforce-adapter'
import createCredentials from './credentials'

export default {
  salesforce: (): InstanceElement => {
    const configType = new ObjectType({ elemID: new ElemID(salesforceAdapterId) })
    const credentials = createCredentials()
    const configValues = {
      username: credentials.salesforce.username,
      password: credentials.salesforce.password,
      token: credentials.salesforce.apiToken,
      sandbox: credentials.salesforce.isSandbox,
    }

    return new InstanceElement(
      new ElemID(configType.elemID.adapter, ElemID.CONFIG_INSTANCE_NAME),
      configType,
      configValues,
    )
  },
}
