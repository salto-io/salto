import { ElemID, InstanceElement } from 'adapter-api'
import { creator } from '../src/adapter_creator'
import HubspotClient from '../src/client/client'

jest.mock('../src/client/client')

describe('HubspotAdapter creator', () => {
  describe('when validateConfig is called', () => {
    const config = new InstanceElement(
      ElemID.CONFIG_NAME,
      creator.configType,
      {
        apiKey: 'myKey',
      }
    )

    beforeEach(() => {
      creator.validateConfig(config)
    })

    it('should call validateCredentials with the correct credentials', () => {
      const credentials = {
        apiKey: 'myKey',
      }
      expect(HubspotClient.validateCredentials).toHaveBeenCalledWith(credentials)
    })
  })

  describe('when passed a config element', () => {
    const config = new InstanceElement(
      ElemID.CONFIG_NAME,
      creator.configType,
      {
        apiKey: 'myApiKey',
      }
    )

    beforeEach(() => {
      creator.create({ config })
    })

    it('creates the client correctly', () => {
      expect(HubspotClient).toHaveBeenCalledWith({
        credentials: {
          apiKey: 'myApiKey',
        },
      })
    })
  })
})
