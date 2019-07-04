import {
  Type,
  PrimitiveType,
  ObjectType,
  TypeID,
  PrimitiveTypes
} from 'adapter-api'

import SalesforceAdapter from '../src/adapter'
import * as constants from '../src/constants'
import { CustomObject } from '../src/salesforce_types'

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
      expect(lead.fields.last_name.typeID.name).toBe('string')
      expect(lead.fields.description.typeID.name).toBe('textarea')
      expect(lead.fields.salutation.typeID.name).toBe('picklist')

      // Test label
      expect(lead.fields.last_name.annotationsValues.label).toBe('Last Name')

      // Test true and false required
      expect(lead.fields.description.annotationsValues.required).toBe(true)
      expect(lead.fields.created_date.annotationsValues.required).toBe(false)

      // Test picklist restricted_pick_list prop
      expect(lead.fields.industry.annotationsValues.restricted_pick_list).toBe(
        false
      )
      expect(
        lead.fields.clean_status.annotationsValues.restricted_pick_list
      ).toBe(true)

      // Test picklist values
      expect(
        (lead.fields.salutation.annotationsValues.values as string[]).join(';')
      ).toBe('Mr.;Ms.;Mrs.;Dr.;Prof.')

      // Test _default
      // TODO: add test to primitive with _default and combobox _default (no real example for lead)
      // eslint-disable-next-line no-underscore-dangle
      expect(lead.fields.status.annotationsValues._default).toBe(
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
      expect(flow.fields.is_template.typeID.name).toBe('checkbox')
      expect(flow.fields.action_calls.typeID.name).toBe('FlowActionCall')
    })
  })

  describe('should perform CRUD operations E2E', () => {
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
      const post = await sfAdapter.add(element)

      // Test
      expect(post).toBeInstanceOf(Type)
      expect(post.annotationsValues[constants.API_NAME]).toBe('Test__c')
      expect(
        post.fields.description.annotationsValues[constants.API_NAME]
      ).toBe('Description__c')
      const readResult = await sfAdapter.client.readMetadata(
        constants.CUSTOM_OBJECT,
        'test__c'
      )
      expect(readResult.fullName).toBe('test__c')

      // Clean-up
      await sfAdapter.remove(post)
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

      const post = await sfAdapter.add(element)

      // Test
      const removeResult = await sfAdapter.remove(post)
      expect(removeResult).toBe(undefined)

      const readResult = await sfAdapter.client.readMetadata(
        constants.CUSTOM_OBJECT,
        'test__c'
      )
      expect(readResult.fullName).toBeUndefined()
    })

    it('should modify an object by creating a new custom field and remove another one E2E', async () => {
      // Setup
      // set long timeout as we communicate with salesforce API
      jest.setTimeout(15000)
      const sfAdapter = adapter()

      const oldElement = new ObjectType({
        typeID: new TypeID({ adapter: constants.SALESFORCE, name: 'test' }),
        fields: {
          address: new PrimitiveType({
            typeID: new TypeID({
              adapter: constants.SALESFORCE,
              name: 'string'
            }),
            primitive: PrimitiveTypes.STRING
          }),
          banana: new PrimitiveType({
            typeID: new TypeID({
              adapter: constants.SALESFORCE,
              name: 'string'
            }),
            primitive: PrimitiveTypes.STRING
          })
        },
        annotationsValues: {
          required: false,
          _default: 'test',
          label: 'test label',
          // eslint-disable-next-line @typescript-eslint/camelcase
          api_name: 'Test__c'
        }
      })

      const addResult = await sfAdapter.add(oldElement)
      // Verify setup was performed properly
      expect(addResult).toBeInstanceOf(ObjectType)

      const oldElementReadResult = (await sfAdapter.client.readMetadata(
        constants.CUSTOM_OBJECT,
        'Test__c'
      )) as CustomObject
      expect(oldElementReadResult.fullName).toBe('Test__c')
      expect(oldElementReadResult.fields.map(f => f.fullName)).toContain(
        'Address__c'
      )
      expect(oldElementReadResult.fields.map(f => f.fullName)).toContain(
        'Banana__c'
      )

      const newElement = new ObjectType({
        typeID: new TypeID({ adapter: constants.SALESFORCE, name: 'test' }),
        fields: {
          banana: new PrimitiveType({
            typeID: new TypeID({
              adapter: constants.SALESFORCE,
              name: 'string'
            }),
            primitive: PrimitiveTypes.STRING
          }),
          description: new PrimitiveType({
            typeID: new TypeID({
              adapter: constants.SALESFORCE,
              name: 'string'
            }),
            primitive: PrimitiveTypes.STRING
          })
        },
        annotationsValues: {
          required: false,
          _default: 'test2',
          label: 'test2 label'
        }
      })

      // Test
      const modificationResult = await sfAdapter.update(oldElement, newElement)
      expect(modificationResult).toBe(true)

      const readResult = (await sfAdapter.client.readMetadata(
        constants.CUSTOM_OBJECT,
        'Test__c'
      )) as CustomObject
      expect(readResult.fullName).toBe('Test__c')
      expect(readResult.fields.map(f => f.fullName)).toContain('Banana__c')
      expect(readResult.fields.map(f => f.fullName)).toContain('Description__c')
      expect(readResult.fields.map(f => f.fullName)).not.toContain('Address__c')

      // Clean-up
      await sfAdapter.remove(oldElement)
    })
  })
})
