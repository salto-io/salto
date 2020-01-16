import { InstanceElement, ElemID, ObjectType } from 'adapter-api'
import { creator } from 'salesforce-adapter'
import { initAdapters, getAdaptersLoginConf } from '../../src/core/adapters/adapters'

describe('adapters.ts', () => {
  const { configType } = creator
  const services = ['salesforce']

  describe('run get adapters config statuses', () => {
    let configs: Record<string, ObjectType>

    it('should return config for defined adapter', () => {
      configs = getAdaptersLoginConf(services)
      expect(configs.salesforce).toEqual(configType)
    })

    it('should return undefined for non defined adapter', () => {
      configs = getAdaptersLoginConf(services.concat('fake'))
      expect(configs.salesforce).toEqual(configType)
      expect(configs.fake).toBeUndefined()
    })
  })

  it('should return adapter when config is defined', () => {
    const sfConfig = new InstanceElement(
      ElemID.CONFIG_NAME,
      configType,
      {
        username: 'bpuser',
        password: 'bppass',
        token: 'bptoken',
        sandbox: false,
      }
    )
    const adapters = initAdapters({ salesforce: sfConfig })
    expect(adapters.salesforce).toBeDefined()
  })

  it('should throw error when no proper config exists', async () => {
    expect(() => initAdapters({ [services[0]]: undefined })).toThrow()
  })
})
