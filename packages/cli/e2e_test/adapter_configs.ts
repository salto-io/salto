import {
  InstanceElement, ElemID,
} from 'adapter-api'
import {
  creator as salesforceAdapterCreator,
  testHelpers as salesforceTestHelpers,
} from 'salesforce-adapter'

export default {
  salesforce: (): InstanceElement => {
    const credentials = salesforceTestHelpers.credentials()
    const configValues = {
      username: credentials.username,
      password: credentials.password,
      token: credentials.apiToken,
      sandbox: credentials.isSandbox,
    }

    const { configType } = salesforceAdapterCreator

    return new InstanceElement(
      ElemID.CONFIG_NAME,
      configType,
      configValues,
    )
  },
}
