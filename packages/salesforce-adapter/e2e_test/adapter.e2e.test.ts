import { isArray } from 'util'
import {
  Type,
  ObjectType,
  ElemID,
  InstanceElement,
  Field,
  Element,
} from 'adapter-api'
import { PicklistEntry } from 'jsforce'
import _ from 'lodash'
import SalesforceAdapter from '../src/adapter'
import * as constants from '../src/constants'
import { FIELD_LEVEL_SECURITY_ANNOTATION, PROFILE_METADATA_TYPE } from '../src/aspects/field_permissions'
import {
  CustomObject,
  ProfileInfo,
  FieldPermissions,
} from '../src/client/types'
import { Types } from '../src/transformer'

describe('Test Salesforce adapter E2E with real account', () => {
  const adapter = (): SalesforceAdapter => {
    const a = new SalesforceAdapter()
    const configType = a.getConfigType()
    const value = {
      username: process.env.SF_USER,
      password: process.env.SF_PASSWORD,
      token: process.env.SF_TOKEN,
      sandbox: false,
    }
    const elemID = new ElemID('salesforce')
    const config = new InstanceElement(elemID, configType, value)
    a.init(config)
    return a
  }

  // Set long timeout as we communicate with salesforce API
  beforeAll(() => {
    jest.setTimeout(1000000)
  })

  describe('should discover account settings', () => {
    let result: Element[]

    beforeAll(async done => {
      try {
        result = await adapter().discover()
      } catch (e) {
        // Catch and continue, we want done() to be called anyway, o/w test stuck
      }
      done()
    })
    it('should discover sobject', async () => {
      // Check few field types on lead object
      const lead = result
        .filter(element => element.elemID.name === 'lead')
        .pop() as ObjectType

      // Test few possible types
      expect(lead.fields.last_name.type.elemID.name).toBe('string')
      expect(lead.fields.description.type.elemID.name).toBe('textarea')
      expect(lead.fields.salutation.type.elemID.name).toBe('picklist')

      // Test label
      expect(lead.fields.last_name.annotationsValues[constants.LABEL]).toBe('Last Name')

      // Test true and false required
      expect(lead.fields.description.annotationsValues[Type.REQUIRED]).toBe(false)
      expect(lead.fields.created_date.annotationsValues[Type.REQUIRED]).toBe(true)

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
      expect(lead.fields.status.annotationsValues[Type.DEFAULT]).toBe(
        'Open - Not Contacted'
      )
    })

    it('should discover metadata type', () => {
      const flow = result
        .filter(element => element.elemID.name === 'flow_type')
        .pop() as ObjectType
      expect(flow.fields.description.type.elemID.name).toBe('string')
      expect(flow.fields.is_template.type.elemID.name).toBe('boolean')
      expect(flow.fields.action_calls.type.elemID.name).toBe('flow_action_call_type')
    })

    it('should discover settings instance', () => {
      // As we discover now only instances from the STANDALONE list,
      // settings is the only one with instance by default.
      // once we support adding instances test can be improved
      const quoteSettings = result
        .filter(element => element instanceof InstanceElement
          && element.elemID.name === 'settings_quote')
        .pop() as InstanceElement

      expect(quoteSettings.value.enable_quote).toBeDefined()
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
      if (fields || missingFields) {
        const fieldNames = isArray(result.fields) ? result.fields.map(rf => rf.fullName)
          : [result.fields.fullName]
        if (fields && !fields.every(f => fieldNames.includes(f))) {
          return false
        }
        return (!missingFields || missingFields.every(f => !fieldNames.includes(f)))
      }
      return true
    }

    const permissionExists = async (profile: string, fields: string[]): Promise<boolean[]> => {
      // The following const method is a workaround for a bug in SFDC metadata API that returns
      // the editable and readable fields in FieldPermissions as string instead of boolean
      const verifyBoolean = (variable: string | boolean): boolean => {
        const unknownVariable = variable as unknown
        return typeof unknownVariable === 'string' ? JSON.parse(unknownVariable) : variable
      }
      const profileInfo = (await sfAdapter.client.readMetadata(PROFILE_METADATA_TYPE,
        profile)) as ProfileInfo
      const fieldPermissionsMap = new Map<string, FieldPermissions>()
      profileInfo.fieldPermissions.map(f => fieldPermissionsMap.set(f.field, f))
      return fields.map(field => {
        if (!fieldPermissionsMap.has(field)) {
          return false
        }
        const fieldObject: FieldPermissions = fieldPermissionsMap.get(field) as FieldPermissions
        return verifyBoolean(fieldObject.editable) || verifyBoolean(fieldObject.readable)
      })
    }

    const stringType = Types.salesforceDataTypes.text

    it('should add custom object', async () => {
      const customObjectName = 'TestAddCustom__c'
      const mockElemID = new ElemID(constants.SALESFORCE, 'test')
      const element = new ObjectType({
        elemID: mockElemID,
        annotationsValues: {
          [constants.API_NAME]: customObjectName,
        },
        fields: {
          description: new Field(
            mockElemID,
            'description',
            stringType,
            {
              [Type.REQUIRED]: false,
              [Type.DEFAULT]: 'test',
              label: 'description label',
              [FIELD_LEVEL_SECURITY_ANNOTATION]: {
                admin: { editable: true, readable: true },
                standard: { editable: true, readable: true },
              },
            },
          ),
          formula: new Field(
            mockElemID,
            'formula',
            stringType,
            {
              label: 'Test formula',
              [constants.FORMULA]: '"some text"',
            },
          ),
        },
      })

      if (await objectExists(customObjectName) === true) {
        await sfAdapter.remove(element)
      }
      const post = await sfAdapter.add(element)

      // Test
      expect(post).toBeInstanceOf(ObjectType)
      expect(
        post.fields.description.annotationsValues[constants.API_NAME]
      ).toBe('Description__c')
      expect(
        post.fields.formula.annotationsValues[constants.API_NAME]
      ).toBe('Formula__c')

      expect(await objectExists(customObjectName, ['Description__c', 'Formula__c'])).toBe(true)
      expect((await permissionExists('Admin', [`${customObjectName}.Description__c`]))[0]).toBe(true)
      expect((await permissionExists('Standard', [`${customObjectName}.Description__c`]))[0]).toBe(true)

      // Clean-up
      await sfAdapter.remove(post)
    })

    it('should remove object', async () => {
      const customObjectName = 'TestRemoveCustom__c'
      const mockElemID = new ElemID(constants.SALESFORCE, 'test remove custom')
      const element = new ObjectType({
        elemID: mockElemID,
        annotationsValues: {
          [constants.API_NAME]: customObjectName,
        },
        fields: {
          description: new Field(
            mockElemID,
            'description',
            stringType,
            {
              label: 'test label',
              [Type.REQUIRED]: false,
              [Type.DEFAULT]: 'test',
            },
          ),
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
      const mockElemID = new ElemID(constants.SALESFORCE, 'test modify fields')
      const oldElement = new ObjectType({
        elemID: mockElemID,
        fields: {
          address: new Field(
            mockElemID,
            'address',
            stringType,
            {
              [constants.API_NAME]: 'Address__c',
            },
          ),
          banana: new Field(
            mockElemID,
            'banana',
            stringType,
            {
              [constants.API_NAME]: 'Banana__c',
            },
          ),
        },
        annotationsValues: {
          [Type.REQUIRED]: false,
          [Type.DEFAULT]: 'test',
          label: 'test label',
          [constants.API_NAME]: customObjectName,
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
        elemID: mockElemID,
        fields: {
          banana: new Field(
            mockElemID,
            'banana',
            stringType,
            {
              [constants.API_NAME]: 'Banana__c',
            },
          ),
          description: new Field(
            mockElemID,
            'description',
            stringType,
            {
              [FIELD_LEVEL_SECURITY_ANNOTATION]: {
                admin: { editable: true, readable: true },
                standard: { editable: true, readable: true },
              },
            },
          ),
        },
        annotationsValues: {
          [Type.REQUIRED]: false,
          [Type.DEFAULT]: 'test2',
          label: 'test2 label',
          [constants.API_NAME]: customObjectName,
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
      const mockElemID = new ElemID(constants.SALESFORCE, 'test modify annotations')
      const oldElement = new ObjectType({
        elemID: mockElemID,
        fields: {
          address: new Field(
            mockElemID,
            'address',
            stringType,
            {
              [constants.API_NAME]: 'Address__c',
              label: 'Address',
            },
          ),
          banana: new Field(
            mockElemID,
            'banana',
            stringType,
            {
              [constants.API_NAME]: 'Banana__c',
              label: 'Banana',
            },
          ),
        },
        annotationsValues: {
          [Type.REQUIRED]: false,
          [Type.DEFAULT]: 'test',
          label: 'test label',
          [constants.API_NAME]: customObjectName,
        },
      })

      if (await objectExists(customObjectName)) {
        await sfAdapter.remove(oldElement)
      }
      await sfAdapter.add(oldElement)

      const newElement = new ObjectType({
        elemID: mockElemID,
        fields: {
          address: new Field(
            mockElemID,
            'address',
            stringType,
            {
              [constants.API_NAME]: 'Address__c',
              label: 'Address',
            },
          ),
          banana: new Field(
            mockElemID,
            'banana',
            stringType,
            {
              [constants.API_NAME]: 'Banana__c',
              label: 'Banana Split',
            },
          ),
        },
        annotationsValues: {
          [Type.REQUIRED]: false,
          [Type.DEFAULT]: 'test2',
          label: 'test label 2',
          [constants.API_NAME]: customObjectName,
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

    it("should modify an object's custom fields' permissions", async () => {
      // Setup
      const customObjectName = 'TestModifyCustomFieldsPermissions__c'
      const mockElemID = new ElemID(constants.SALESFORCE, 'test modify custom field permissions')
      const oldElement = new ObjectType({
        elemID: mockElemID,
        fields: {
          address: new Field(
            mockElemID,
            'address',
            stringType,
            {
              [constants.API_NAME]: 'Address__c',
              [FIELD_LEVEL_SECURITY_ANNOTATION]: {
                admin: { editable: true, readable: true },
              },
            },
          ),
          banana: new Field(
            mockElemID,
            'banana',
            stringType,
            {
              [constants.API_NAME]: 'Banana__c',
              [FIELD_LEVEL_SECURITY_ANNOTATION]: {
                standard: { editable: true, readable: true },
              },
            },
          ),
          delta: new Field(
            mockElemID,
            'delta',
            stringType,
            {
              [constants.API_NAME]: 'Delta__c',
              [FIELD_LEVEL_SECURITY_ANNOTATION]: {
                standard: { editable: false, readable: true },
                admin: { editable: true, readable: true },
              },
            },
          ),
        },
        annotationsValues: {
          [Type.REQUIRED]: false,
          [Type.DEFAULT]: 'test',
          label: 'test label',
          [constants.API_NAME]: customObjectName,
        },
      })

      if (await objectExists(customObjectName) === true) {
        await sfAdapter.remove(oldElement)
      }
      const addResult = await sfAdapter.add(oldElement)
      // Verify setup was performed properly
      expect(addResult).toBeInstanceOf(ObjectType)

      const newElement = new ObjectType({
        elemID: mockElemID,
        fields: {
          address: new Field(
            mockElemID,
            'address',
            stringType,
            {
              [constants.API_NAME]: 'Address__c',
              [FIELD_LEVEL_SECURITY_ANNOTATION]: {
                standard: { editable: true, readable: true },
              },
            },
          ),
          banana: new Field(
            mockElemID,
            'banana',
            stringType,
            {
              [constants.API_NAME]: 'Banana__c',
              [FIELD_LEVEL_SECURITY_ANNOTATION]: {
                admin: { editable: true, readable: true },
                standard: { editable: true, readable: true },
              },
            },
          ),
          delta: new Field(
            mockElemID,
            'delta',
            stringType,
            {
              [constants.API_NAME]: 'Delta__c',
              [FIELD_LEVEL_SECURITY_ANNOTATION]: {
                standard: { editable: false, readable: true },
              },
            },
          ),
        },
        annotationsValues: {
          [Type.REQUIRED]: false,
          [Type.DEFAULT]: 'test',
          label: 'test label',
          [constants.API_NAME]: customObjectName,
        },
      })

      // Test
      const modificationResult = await sfAdapter.update(oldElement, newElement)
      expect(modificationResult).toBeInstanceOf(ObjectType)

      expect(await objectExists(customObjectName)).toBe(true)

      const [addressStandardExists,
        bananaStandardExists,
        deltaStandardExists] = await permissionExists(
        'Standard',
        [`${customObjectName}.Address__c`, `${customObjectName}.Banana__c`, `${customObjectName}.Delta__c`]
      )
      expect(addressStandardExists).toBeTruthy()
      expect(bananaStandardExists).toBeTruthy()
      expect(deltaStandardExists).toBeTruthy()
      const [addressAdminExists,
        bananaAdminExists,
        deltaAdminExists] = await permissionExists(
        'Admin',
        [`${customObjectName}.Address__c`, `${customObjectName}.Banana__c`, `${customObjectName}.Delta__c`]
      )
      expect(addressAdminExists).toBeFalsy()
      expect(bananaAdminExists).toBeTruthy()
      expect(deltaAdminExists).toBeFalsy()

      // Clean-up
      await sfAdapter.remove(oldElement)
    })

    it('should add a custom object with various field types', async () => {
      const customObjectName = 'TestAddFieldTypes__c'
      const mockElemID = new ElemID(constants.SALESFORCE, 'test add custom object with various field types')
      const element = new ObjectType({
        elemID: mockElemID,
        annotationsValues: {
          [constants.API_NAME]: customObjectName,
        },
        fields: {
          alpha: new Field(
            mockElemID,
            'alpha',
            Types.salesforceDataTypes.currency,
            {
              [Type.REQUIRED]: false,
              [Type.DEFAULT]: 25,
              label: 'Currency description label',
              scale: 3,
              precision: 18,
              [FIELD_LEVEL_SECURITY_ANNOTATION]: {
                admin: { editable: false, readable: true },
                standard: { editable: false, readable: true },
              },
            },
          ),
          bravo: new Field(
            mockElemID,
            'bravo',
            Types.salesforceDataTypes.picklist,
            {
              [Type.REQUIRED]: false,
              [Type.DEFAULT]: 'NEW',
              label: 'test label',
              values: ['NEW', 'OLD'],
              [FIELD_LEVEL_SECURITY_ANNOTATION]: {
                admin: { editable: false, readable: true },
                standard: { editable: false, readable: true },
              },
            },
          ),
        },
      })

      if (await objectExists(customObjectName) === true) {
        await sfAdapter.remove(element)
      }
      const post = await sfAdapter.add(element)

      // Test
      const objectFields = await sfAdapter.client.describeSObjects([customObjectName])
      expect(objectFields[0]).toBeDefined()
      const allFields = objectFields[0].fields
      // Verify currency
      const currencyField = allFields.filter(field => field.name === 'Alpha__c')[0]
      expect(currencyField).toBeDefined()
      expect(currencyField.label).toBe('Currency description label')
      expect(currencyField.scale).toBe(3)
      expect(currencyField.precision).toBe(18)

      // Verify picklist
      const picklistField = allFields.filter(field => field.name === 'Bravo__c')[0]
      expect(picklistField).toBeDefined()
      expect(picklistField.label).toBe('test label')
      expect(_.isEqual((picklistField.picklistValues as PicklistEntry[]).map(value => value.label), ['NEW', 'OLD'])).toBeTruthy()

      // Clean-up
      await sfAdapter.remove(post)
    })
  })
})
