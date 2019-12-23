import {
  InstanceElement, ObjectType, ElemID,
} from 'adapter-api'
import { creator } from 'salesforce-adapter'
import initAdapters from '../../src/core/adapters/adapters'

describe('Test adapters.ts', () => {
  const { configType } = creator
  const services = ['salesforce']

  const notConfigType = new ObjectType({ elemID: new ElemID('salesforce', 'not_config') })

  const bpConfig = new InstanceElement(
    ElemID.CONFIG_NAME,
    configType,
    {
      username: 'bpuser',
      password: 'bppass',
      token: 'bptoken',
      sandbox: false,
    }
  )

  const userConfig = new InstanceElement(
    ElemID.CONFIG_NAME,
    configType,
    {
      username: 'useruser',
      password: 'userpass',
      token: 'usertoken',
      sandbox: true,
    }
  )

  const RedHeringWrongAdapter = new InstanceElement(
    ElemID.CONFIG_NAME,
    new ObjectType({ elemID: new ElemID('err') }),
    {
      username: 'err',
      password: 'err',
      token: 'err',
      sandbox: true,
    }
  )

  const RedHeringNotConfig = new InstanceElement(
    'reg',
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
    const [adapters, newConfigs] = await initAdapters(elements, fillConfig, services)
    expect(adapters.salesforce).toBeDefined()
    expect(newConfigs.length).toBe(0)
  })

  it('should prompt for config when no proper config exists', async () => {
    const elements = [
      configType,
      RedHeringNotConfig,
      RedHeringWrongAdapter,
    ]
    const [adapters, newConfigs] = await initAdapters(elements, fillConfig, services)
    expect(adapters.salesforce).toBeDefined()
    expect(newConfigs.length).toEqual(1)
    expect(newConfigs[0]).toBe(userConfig)
  })
})
