import { isArray } from 'util'
import {
  Type,
  PrimitiveType,
  ObjectType,
  ElemID,
  PrimitiveTypes,
  InstanceElement,
} from 'adapter-api'
import SalesforceAdapter from '../src/adapter'
import * as constants from '../src/constants'
import { CustomObject, ProfileInfo } from '../src/client/types'

describe('Test Salesforce adapter E2E with real account', () => {
  const adapter = (): SalesforceAdapter => {
    const configType = SalesforceAdapter.getConfigType()
    const value = {
      username: 'vanila@salto.io',
      password: '!A123456',
      token: 'rwVvOsh7HjF8Zki9ZmyQdeth',
      sandbox: false,
    }
    const elemID = new ElemID('salesforce')
    const config = new InstanceElement(elemID, configType, value)
    return new SalesforceAdapter(config)
  }

  // Set long timeout as we communicate with salesforce API
  beforeAll(() => {
    jest.setTimeout(1000000)
  })

  describe('should discover account settings', () => {
    let result: Type[]

    beforeAll(async done => {
      result = await adapter().discover()
      done()
    })
    it('should discover sobject', async () => {
      // Check few field types on lead object
      const lead = result
        .filter(element => element.elemID.name === 'Lead')
        .pop() as ObjectType

      // Test few possible types
      expect(lead.fields.last_name.elemID.name).toBe('string')
      expect(lead.fields.description.elemID.name).toBe('textarea')
      expect(lead.fields.salutation.elemID.name).toBe('picklist')

      // Test label
      expect(lead.annotationsValues.last_name.label).toBe('Last Name')

      // Test true and false required
      expect(lead.annotationsValues.description.required).toBe(true)
      expect(lead.annotationsValues.created_date.required).toBe(false)

      // Test picklist restricted_pick_list prop
      expect(lead.annotationsValues.industry.restricted_pick_list).toBe(
        false
      )
      expect(
        lead.annotationsValues.clean_status.restricted_pick_list
      ).toBe(true)

      // Test picklist values
      expect(
        (lead.annotationsValues.salutation.values as string[]).join(';')
      ).toBe('Mr.;Ms.;Mrs.;Dr.;Prof.')

      // Test _default
      // TODO: add test to primitive with _default and combobox _default (no real example for lead)
      // eslint-disable-next-line no-underscore-dangle
      expect(lead.annotationsValues.status._default).toBe(
        'Open - Not Contacted'
      )
    })

    it('should discover metadata object', () => {
      // Check few field types on lead object
      const flow = result
        .filter(element => element.elemID.name === 'Flow')
        .pop() as ObjectType

      expect(flow.fields.description.elemID.name).toBe('string')
      expect(flow.fields.is_template.elemID.name).toBe('checkbox')
      expect(flow.fields.action_calls.elemID.name).toBe('FlowActionCall')
    })
  })

  describe('should perform CRUD operations', () => {
    const sfAdapter = adapter()

    const objectExists = async (name: string, fields?: string[], missingFields?: string[],
      label?: string): Promise<boolean> => {
      const result = (await sfAdapter.client.readMetadata(constants.CUSTOM_OBJECT, name)
        ) as CustomObject
      if (!result || !result.fullName) {
        return false
      }
      if (label && label !== result.label) {
        return false
      }
      const fieldNames = isArray(result.fields) ? result.fields.map(rf => rf.fullName)
        : [result.fields.fullName]
      if (fields && !fields.every(f => fieldNames.includes(f))) {
        return false
      }
      return (!missingFields || missingFields.every(f => !fieldNames.includes(f)))
    }

    const permissionExists = async (profile: string, fields: string[]): Promise<boolean[]> => {
      const profileInfo = (await sfAdapter.client.readMetadata(constants.METADATA_PROFILE_OBJECT,
        profile)) as ProfileInfo
      const fieldPermissions = profileInfo.fieldPermissions.map(f => f.field)
      return fields.map(field => fieldPermissions.includes(field))
    }

    const stringType = new PrimitiveType({
      elemID: new ElemID(constants.SALESFORCE, 'string'),
      primitive: PrimitiveTypes.STRING,
    })

    it('should add custom object', async () => {
      const customObjectName = 'TestAddCustom__c'
      const element = new ObjectType({
        elemID: new ElemID(constants.SALESFORCE, 'test'),
        annotationsValues: {
          [constants.API_NAME]: customObjectName,
          description: {
            required: false,
            _default: 'test',
            label: 'description label',
            [constants.FIELD_LEVEL_SECURITY]: {
              admin: { editable: true, readable: true },
              standard: { editable: true, readable: true },
            },
          },
        },
        fields: {
          description: stringType,
        },
      })

      if (await objectExists(customObjectName) === true) {
        await sfAdapter.remove(element)
      }
      const post = await sfAdapter.add(element)

      // Test
      expect(post).toBeInstanceOf(ObjectType)
      expect(
        post.annotationsValues.description[constants.API_NAME]
      ).toBe('Description__c')

      expect(await objectExists(customObjectName)).toBe(true)
      expect((await permissionExists('Admin', [`${customObjectName}.Description__c`]))[0]).toBe(true)
      expect((await permissionExists('Standard', [`${customObjectName}.Description__c`]))[0]).toBe(true)

      // Clean-up
      await sfAdapter.remove(post)
    })

    it('should remove object', async () => {
      const customObjectName = 'TestRemoveCustom__c'
      const element = new ObjectType({
        elemID: new ElemID(constants.SALESFORCE, 'test remove custom'),
        annotationsValues: {
          [constants.API_NAME]: customObjectName,
          description: {
            label: 'test label',
            required: false,
            _default: 'test',
          },
        },
        fields: {
          description: stringType,
        },
      })
      // Setup
      if (await objectExists(customObjectName) === false) {
        await sfAdapter.add(element)
        expect(await objectExists(customObjectName)).toBe(true)
      }
      // Run
      const removeResult = await sfAdapter.remove(element)
      // Validate
      expect(removeResult).toBeUndefined()
      expect(await objectExists(customObjectName)).toBe(false)
    })

    it('should modify an object by creating a new custom field and remove another one', async () => {
      const customObjectName = 'TestModifyCustom__c'
      const oldElement = new ObjectType({
        elemID: new ElemID(constants.SALESFORCE, 'test modify fields'),
        fields: {
          address: stringType,
          banana: stringType,
        },
        annotationsValues: {
          required: false,
          _default: 'test',
          label: 'test label',
          [constants.API_NAME]: customObjectName,
          address: {
            [constants.API_NAME]: 'Address__c',
          },
          banana: {
            [constants.API_NAME]: 'Banana__c',
          },
        },
      })

      if (await objectExists(customObjectName) === true) {
        await sfAdapter.remove(oldElement)
      }
      const addResult = await sfAdapter.add(oldElement)
      // Verify setup was performed properly
      expect(addResult).toBeInstanceOf(ObjectType)

      expect(await objectExists(customObjectName, ['Address__c', 'Banana__c'])).toBe(true)

      const newElement = new ObjectType({
        elemID: new ElemID(constants.SALESFORCE, 'test modify fields'),
        fields: {
          banana: stringType,
          description: stringType,
        },
        annotationsValues: {
          required: false,
          _default: 'test2',
          label: 'test2 label',
          [constants.API_NAME]: customObjectName,
          banana: {
            [constants.API_NAME]: 'Banana__c',
          },
          description: {
            [constants.FIELD_LEVEL_SECURITY]: {
              admin: { editable: true, readable: true },
              standard: { editable: true, readable: true },
            },
          },
        },
      })

      // Test
      const modificationResult = await sfAdapter.update(oldElement, newElement)

      expect(modificationResult).toBeInstanceOf(ObjectType)
      expect(await objectExists(customObjectName, ['Banana__c', 'Description__c'],
        ['Address__c'])).toBe(true)
      expect((await permissionExists('Admin', [`${customObjectName}.Description__c`]))[0]).toBe(true)

      // Clean-up
      await sfAdapter.remove(oldElement)
    })

    it("should modify an object's annotations", async () => {
      const customObjectName = 'TestModifyCustomAnnotations__c'
      const oldElement = new ObjectType({
        elemID: new ElemID(constants.SALESFORCE, 'test modify annotations'),
        fields: {
          address: stringType,
          banana: stringType,
        },
        annotationsValues: {
          required: false,
          _default: 'test',
          label: 'test label',
          [constants.API_NAME]: customObjectName,
          address: {
            [constants.API_NAME]: 'Address__c',
            label: 'Address',
          },
          banana: {
            [constants.API_NAME]: 'Banana__c',
            label: 'Banana',
          },
        },
      })

      if (await objectExists(customObjectName) === false) {
        await sfAdapter.add(oldElement)
      }

      const newElement = new ObjectType({
        elemID: new ElemID(constants.SALESFORCE, 'test modify annotations'),
        fields: {
          address: stringType,
          banana: stringType,
        },
        annotationsValues: {
          required: false,
          _default: 'test2',
          label: 'test label 2',
          [constants.API_NAME]: customObjectName,
          address: {
            [constants.API_NAME]: 'Address__c',
            label: 'Address',
          },
          banana: {
            [constants.API_NAME]: 'Banana__c',
            label: 'Banana Split',
          },
        },
      })

      // Test
      const modificationResult = await sfAdapter.update(oldElement, newElement)
      expect(modificationResult).toBeInstanceOf(ObjectType)
      expect(await objectExists(customObjectName, undefined, undefined, 'test label 2')).toBe(true)

      const readResult = (await sfAdapter.client.readMetadata(
        constants.CUSTOM_OBJECT,
        customObjectName
      )) as CustomObject
      const label = isArray(readResult.fields) ? readResult.fields.filter(f => f.fullName === 'Banana__c')[0].label
        : readResult.fields.label
      expect(label).toBe('Banana Split')

      // Clean-up
      await sfAdapter.remove(oldElement)
    })

    it("should modify an object's custom fields' permissions E2E", async () => {
      // Setup
      const customObjectName = 'TestModifyCustomFieldsPermissions__c'
      const oldElement = new ObjectType({
        elemID: new ElemID(constants.SALESFORCE, 'test modify custom field permissions'),
        fields: {
          address: stringType,
          banana: stringType,
        },
        annotationsValues: {
          required: false,
          _default: 'test',
          label: 'test label',
          [constants.API_NAME]: customObjectName,
          address: {
            [constants.API_NAME]: 'Address__c',
            [constants.FIELD_LEVEL_SECURITY]: {
              admin: { editable: true, readable: true },
            },
          },
          banana: {
            [constants.API_NAME]: 'Banana__c',
            [constants.FIELD_LEVEL_SECURITY]: {
              standard: { editable: true, readable: true },
            },
          },
        },
      })

      if (await objectExists(customObjectName) === true) {
        await sfAdapter.remove(oldElement)
      }
      const addResult = await sfAdapter.add(oldElement)
      // Verify setup was performed properly
      expect(addResult).toBeInstanceOf(ObjectType)

      const newElement = new ObjectType({
        elemID: new ElemID(constants.SALESFORCE, 'test modify custom field permissions'),
        fields: {
          address: stringType,
          banana: stringType,
        },
        annotationsValues: {
          required: false,
          _default: 'test',
          label: 'test label',
          [constants.API_NAME]: customObjectName,
          address: {
            [constants.API_NAME]: 'Address__c',
            [constants.FIELD_LEVEL_SECURITY]: {
              standard: { editable: true, readable: true },
            },
          },
          banana: {
            [constants.API_NAME]: 'Banana__c',
            [constants.FIELD_LEVEL_SECURITY]: {
              admin: { editable: true, readable: true },
              standard: { editable: true, readable: true },
            },
          },
        },
      })

      // Test
      const modificationResult = await sfAdapter.update(oldElement, newElement)
      expect(modificationResult).toBeInstanceOf(ObjectType)

      expect(await objectExists(customObjectName)).toBe(true)

      const [addressStandardExists, bananaStandardExists] = await permissionExists(
        'Standard',
        [`${customObjectName}.Address__c`, `${customObjectName}.Banana__c`]
      )
      expect(addressStandardExists).toBe(true)
      expect(bananaStandardExists).toBe(true)
      // The addressAdminExists will be used once we figure out how to remove existing permission
      const [/* addressAdminExists, */bananaAdminExists] = await permissionExists(
        'Admin',
        [`${customObjectName}.Address__c`, `${customObjectName}.Banana__c`]
      )
      // The following step is disabled until we figure out how to remove an existing permission
      // expect(addressAdminExists).toBe(false)
      expect(bananaAdminExists).toBe(true)

      // Clean-up
      await sfAdapter.remove(oldElement)
    })
  })
})
