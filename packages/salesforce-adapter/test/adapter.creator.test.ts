import { InstanceElement, ElemID } from 'adapter-api'
import { creator } from '../src/adapter'
import SalesforceClient from '../src/client/client'

jest.mock('../src/client/client')

describe('SalesforceAdapter creator', () => {
  describe('when passed a config element', () => {
    const config = new InstanceElement(
      ElemID.CONFIG_INSTANCE_NAME,
      creator.configType,
      {
        username: 'myUser',
        password: 'myPassword',
        token: 'myToken',
        sandbox: false,
      }
    )

    beforeEach(() => {
      creator.create({ config })
    })

    it('creates the client correctly', () => {
      expect(SalesforceClient).toHaveBeenCalledWith({
        credentials: {
          username: 'myUser',
          password: 'myPassword',
          apiToken: 'myToken',
          isSandbox: false,
        },
      })
    })
  })
})
