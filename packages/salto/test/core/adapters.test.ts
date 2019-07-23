import {
  InstanceElement, ObjectType, ElemID, BuiltinTypes,
} from 'adapter-api'
import SalesforceAdapter from 'salesforce-adapter'
import { init } from '../../src/core/adapters'

describe('Test adapters.ts', () => {
  const configType = new SalesforceAdapter().getConfigType()

  const notConfigType = BuiltinTypes.STRING

  const configElemID = new ElemID(
    configType.elemID.adapter,
    ElemID.CONFIG_INSTANCE_NAME
  )

  const bpConfig = new InstanceElement(
    configElemID,
    configType,
    {
      username: 'bpuser',
      password: 'bppass',
      token: 'bptoken',
      sandbox: false,
    }
  )

  const userConfig = new InstanceElement(
    configElemID,
    configType,
    {
      username: 'useruser',
      password: 'userpass',
      token: 'usertoken',
      sandbox: true,
    }
  )

  const RedHeringWrongAdapter = new InstanceElement(
    new ElemID('err', ElemID.CONFIG_INSTANCE_NAME),
    notConfigType,
    {
      username: 'err',
      password: 'err',
      token: 'err',
      sandbox: true,
    }
  )

  const RedHeringNotConfig = new InstanceElement(
    new ElemID(configType.elemID.adapter, 'reg'),
    notConfigType,
    {
      username: 'err',
      password: 'err',
      token: 'err',
      sandbox: true,
    }
  )

  const fillConfig = async (_ct: ObjectType): Promise<InstanceElement> => userConfig

  it('should return adapter when config is defined', async () => {
    const elements = [
      configType,
      RedHeringNotConfig,
      RedHeringWrongAdapter,
      bpConfig,
    ]
    const [adapters, newConfigs] = await init(elements, fillConfig)
    expect(adapters.salesforce).toBeDefined()
    expect(newConfigs.length).toBe(0)
  })

  it('should prompt for config when no proper config exists', async () => {
    const elements = [
      configType,
      RedHeringNotConfig,
      RedHeringWrongAdapter,
    ]
    const [adapters, newConfigs] = await init(elements, fillConfig)
    expect(adapters.salesforce).toBeDefined()
    expect(newConfigs.length).toEqual(1)
    expect(newConfigs[0]).toBe(userConfig)
  })
})
