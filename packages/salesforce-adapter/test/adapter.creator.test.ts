import _ from 'lodash'
import { InstanceElement, ElemID, Adapter } from 'adapter-api'
import { creator } from '../src/adapter'

describe('SalesforceAdapter creator', () => {
  describe('when passed a config element', () => {
    const config = new InstanceElement(
      ElemID.CONFIG_NAME,
      creator.configType,
      {
        username: 'myUser',
        password: 'myPassword',
        token: 'myToken',
        sandbox: false,
      }
    )

    let adapter: Adapter

    beforeEach(() => {
      adapter = creator.create({ config })
    })

    it('creates the client correctly', () => {
      expect(_.get(adapter, 'client.credentials')).toMatchObject({
        username: 'myUser',
        password: 'myPassword',
        apiToken: 'myToken',
        loginUrl: 'https://login.salesforce.com/',
      })
    })
  })
})
