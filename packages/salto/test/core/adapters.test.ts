import {
  InstanceElement, ObjectType, ElemID,
} from 'adapter-api'
import { creator } from 'salesforce-adapter'
import initAdapters from '../../src/core/adapters/adapters'

describe('Test adapters.ts', () => {
  const { configType } = creator

  const notConfigType = new ObjectType({ elemID: new ElemID('salesforce', 'not_config') })

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
    const [adapters, newConfigs] = await initAdapters(elements, fillConfig)
    expect(adapters.salesforce).toBeDefined()
    expect(newConfigs.length).toBe(0)
  })

  it('should prompt for config when no proper config exists', async () => {
    const elements = [
      configType,
      RedHeringNotConfig,
      RedHeringWrongAdapter,
    ]
    const [adapters, newConfigs] = await initAdapters(elements, fillConfig)
    expect(adapters.salesforce).toBeDefined()
    expect(newConfigs.length).toEqual(1)
    expect(newConfigs[0]).toBe(userConfig)
  })
})
