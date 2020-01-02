import { InstanceElement, ElemID } from 'adapter-api'
import { creator } from 'salesforce-adapter'
import { initAdapters, getAdaptersLoginStatus, loginStatus } from '../../src/core/adapters/adapters'

describe('Test adapters.ts', () => {
  const { configType } = creator
  const services = ['salesforce']

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

  describe('run get adapters login statuses', () => {
    let loginStatuses: Record<string, loginStatus>

    it('should return logged in for defined adapter', async () => {
      loginStatuses = await getAdaptersLoginStatus([sfConfig], services)
      expect(loginStatuses.salesforce.isLoggedIn).toBeTruthy()
    })

    it('should return not logged in for non defined adapter', async () => {
      loginStatuses = await getAdaptersLoginStatus([], services)
      expect(loginStatuses.salesforce.isLoggedIn).toBeFalsy()
    })
  })

  it('should return adapter when config is defined', async () => {
    const adapters = await initAdapters([sfConfig], services)
    expect(adapters.salesforce).toBeDefined()
  })

  it('should throw error when no proper config exists', async () => {
    const configs = [] as InstanceElement[]
    await expect(initAdapters(configs, services)).rejects.toThrow()
  })
})
