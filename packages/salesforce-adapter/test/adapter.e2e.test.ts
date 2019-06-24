import SalesforceAdapter from '../src/adapter'
import { CUSTOM_OBJECT } from '../src/constants'

// This is turned off by default as it has SFDC rate limit implications
// and this is very long test
// eslint-disable-next-line jest/no-disabled-tests
describe.skip('Test Salesforce adapter E2E', () => {
  const adapter = (): SalesforceAdapter => {
    return new SalesforceAdapter({
      username: 'vanila@salto.io',
      password: '!A123456',
      token: 'rwVvOsh7HjF8Zki9ZmyQdeth',
      sandbox: false
    })
  }

  describe('should discover account settings, e2e with real account', () => {
    let result: Record<string, any>[]

    beforeAll(async done => {
      // set long timeout as we communicate with salesforce API
      jest.setTimeout(1000000)
      // TODO: enable this - marking the describe.skip is not working
      // result = await adapter().discover()
      done()
    })
    it('should discover sobject', async () => {
      // Check few field types on lead object
      const lead = result
        .filter(val => {
          return val.object === 'Lead'
        })
        .pop()

      // Test few possible types
      expect(lead.LastName.type).toBe('string')
      expect(lead.Description.type).toBe('textarea')
      expect(lead.Salutation.type).toBe('picklist')

      // Test label
      expect(lead.LastName.label).toBe('Last Name')

      // Test true and false required
      expect(lead.Description.required).toBe(true)
      expect(lead.CreatedDate.required).toBe(false)

      // Test picklist restricted_pick_list prop
      expect(lead.Industry.restricted_pick_list).toBe(false)
      expect(lead.CleanStatus.restricted_pick_list).toBe(true)

      // Test picklist values
      expect((lead.Salutation.values as string[]).join(';')).toBe(
        'Mr.;Ms.;Mrs.;Dr.;Prof.'
      )

      // Test _default
      // TODO: add test to primitive with _default and combobox _default (no real example for lead)
      // eslint-disable-next-line no-underscore-dangle
      expect(lead.Status._default).toBe('Open - Not Contacted')
    })

    it('should discover metadata object', () => {
      // Check few field types on lead object
      const flow = result
        .filter(val => {
          return val.object === 'Flow'
        })
        .pop()

      expect(flow.description.type).toBe('string')
      expect(flow.isTemplate.type).toBe('boolean')
      expect(flow.actionCalls.type).toBe('FlowActionCall')
    })
  })

  describe('Test CRUD operations E2E', () => {
    it('should add custom object metadata component e2e with real account', async () => {
      // Setup
      // set long timeout as we communicate with salesforce API
      jest.setTimeout(10000)
      const sfAdapter = adapter()
      const element = {
        object: 'test',
        description: {
          type: 'string',
          label: 'test label',
          required: false,
          _default: 'test'
        }
      }
      const addResult = await sfAdapter.add(element)

      // Test
      expect(addResult).toBe(true)
      const readResult = await sfAdapter.client.readMetadata(
        CUSTOM_OBJECT,
        'test__c'
      )
      expect(readResult.fullName).toBe('test__c')

      // Clean-up
      await sfAdapter.remove(element)
    })

    it('should remove object metadata component e2e with real account', async () => {
      // Setup
      // set long timeout as we communicate with salesforce API
      jest.setTimeout(10000)
      const sfAdapter = adapter()

      const element = {
        object: 'test',
        description: {
          type: 'string',
          label: 'test label',
          required: false,
          _default: 'test'
        }
      }

      const addResult = await sfAdapter.add(element)
      expect(addResult).toBe(true)

      // Test
      const removeResult = await sfAdapter.remove(element)
      expect(removeResult).toBe(true)

      const readResult = await sfAdapter.client.readMetadata(
        CUSTOM_OBJECT,
        'test__c'
      )
      expect(readResult.fullName).toBeUndefined()
    })
  })
})
