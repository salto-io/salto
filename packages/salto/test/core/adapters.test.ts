import {
  InstanceElement, ElemID, ObjectType,
} from 'adapter-api'
import { creator } from 'salesforce-adapter'
import { initAdapters, loginAdapters } from '../../src/core/adapters/adapters'

describe('Test adapters.ts', () => {
  const { configType } = creator
  const services = ['salesforce']

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

  const fillConfig = async (_ct: ObjectType): Promise<InstanceElement> => userConfig

  it('should login when config is empty', async () => {
    const newConfigs = await loginAdapters([], fillConfig, services)
    expect(newConfigs.length).toBeGreaterThan(0)
  })

  it('should not have new configs if exits and no force', async () => {
    const newConfigs = await loginAdapters([bpConfig], fillConfig, services)
    expect(newConfigs.length).toEqual(0)
  })

  it('should have new configs if config exits but ran with force', async () => {
    const newConfigs = await loginAdapters([bpConfig], fillConfig, services, true)
    expect(newConfigs.length).toBeGreaterThan(0)
  })

  it('should return adapter when config is defined', async () => {
    const adapters = await initAdapters([bpConfig], services)
    expect(adapters.salesforce).toBeDefined()
  })

  it('should throw error when no proper config exists', async () => {
    const configs = [] as InstanceElement[]
    await expect(initAdapters(configs, services)).rejects.toThrow()
  })
})
