import { Type, PrimitiveType, ObjectType, TypeID, PrimitiveTypes } from 'salto'

import SalesforceAdapter from '../src/adapter'
import * as constants from '../src/constants'

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
    let result: Type[]

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
        .filter(element => {
          return element.typeID.name === 'Lead'
        })
        .pop() as ObjectType

      // Test few possible types
      expect(lead.fields.LastName.typeID.name).toBe('string')
      expect(lead.fields.Description.typeID.name).toBe('textarea')
      expect(lead.fields.Salutation.typeID.name).toBe('picklist')

      // Test label
      expect(lead.fields.LastName.annotationsValues.label).toBe('Last Name')

      // Test true and false required
      expect(lead.fields.Description.annotationsValues.required).toBe(true)
      expect(lead.fields.CreatedDate.annotationsValues.required).toBe(false)

      // Test picklist restricted_pick_list prop
      expect(lead.fields.Industry.annotationsValues.restricted_pick_list).toBe(
        false
      )
      expect(
        lead.fields.CleanStatus.annotationsValues.restricted_pick_list
      ).toBe(true)

      // Test picklist values
      expect(
        (lead.fields.Salutation.annotationsValues.values as string[]).join(';')
      ).toBe('Mr.;Ms.;Mrs.;Dr.;Prof.')

      // Test _default
      // TODO: add test to primitive with _default and combobox _default (no real example for lead)
      // eslint-disable-next-line no-underscore-dangle
      expect(lead.fields.Status.annotationsValues._default).toBe(
        'Open - Not Contacted'
      )
    })

    it('should discover metadata object', () => {
      // Check few field types on lead object
      const flow = result
        .filter(element => {
          return element.typeID.name === 'Flow'
        })
        .pop() as ObjectType

      expect(flow.fields.description.typeID.name).toBe('string')
      expect(flow.fields.isTemplate.typeID.name).toBe('checkbox')
      expect(flow.fields.actionCalls.typeID.name).toBe('FlowActionCall')
    })
  })

  describe('Test CRUD operations E2E', () => {
    it('should add custom object metadata component e2e with real account', async () => {
      // Setup
      // set long timeout as we communicate with salesforce API
      jest.setTimeout(10000)
      const sfAdapter = adapter()
      const element = new ObjectType({
        typeID: new TypeID({ adapter: constants.SALESFORCE, name: 'test' }),
        fields: {
          description: new PrimitiveType({
            typeID: new TypeID({
              adapter: constants.SALESFORCE,
              name: 'string'
            }),
            primitive: PrimitiveTypes.STRING,
            annotationsValues: {
              required: false,
              _default: 'test',
              label: 'description label'
            }
          })
        }
      })
      const addResult = await sfAdapter.add(element)

      // Test
      expect(addResult).toBe(true)
      const readResult = await sfAdapter.client.readMetadata(
        constants.CUSTOM_OBJECT,
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

      const element = new ObjectType({
        typeID: new TypeID({ adapter: constants.SALESFORCE, name: 'test' }),
        fields: {
          description: new PrimitiveType({
            typeID: new TypeID({
              adapter: constants.SALESFORCE,
              name: 'string'
            }),
            primitive: PrimitiveTypes.STRING,
            annotationsValues: {
              label: 'test label',
              required: false,
              _default: 'test'
            }
          })
        }
      })

      const addResult = await sfAdapter.add(element)
      expect(addResult).toBe(true)

      // Test
      const removeResult = await sfAdapter.remove(element)
      expect(removeResult).toBe(true)

      const readResult = await sfAdapter.client.readMetadata(
        constants.CUSTOM_OBJECT,
        'test__c'
      )
      expect(readResult.fullName).toBeUndefined()
    })
  })
})
