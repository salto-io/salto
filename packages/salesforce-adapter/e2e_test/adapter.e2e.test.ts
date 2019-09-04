import _ from 'lodash'
import {
  Type,
  ObjectType,
  ElemID,
  InstanceElement,
  Field,
  Value,
  Element,
  Values,
} from 'adapter-api'
import { PicklistEntry } from 'jsforce'
import makeArray from '../src/client/make_array'
import * as constants from '../src/constants'
import { FIELD_LEVEL_SECURITY_ANNOTATION, PROFILE_METADATA_TYPE } from '../src/filters/field_permissions'
import SalesforceClient from '../src/client/client'
import SalesforceAdapter from '../src/adapter'
import {
  CustomObject,
  ProfileInfo,
  FieldPermissions,
} from '../src/client/types'
import {
  Types, sfCase, fromMetadataInfo,
} from '../src/transformer'

describe('Test Salesforce adapter E2E with real account', () => {
  const requiredEnvVar = (name: string): string => {
    const result = process.env[name]
    if (!result) {
      throw new Error(`required env var ${name} missing or empty`)
    }
    return result
  }

  const client = new SalesforceClient(
    requiredEnvVar('SF_USER'),
    requiredEnvVar('SF_PASSWORD') + requiredEnvVar('SF_TOKEN'),
    false,
  )

  const adapter = new SalesforceAdapter({ clientOrConfig: client })

  // Set long timeout as we communicate with salesforce API
  beforeAll(() => {
    jest.setTimeout(1000000)
  })

  describe('should discover account settings', () => {
    let result: Element[]

    beforeAll(async () => {
      result = await adapter.discover()
    })

    beforeEach(() => {
      expect(result).toBeDefined()
    })

    it('should discover sobject', async () => {
      // Check few field types on lead object
      const lead = result.filter(element => element.elemID.name === 'lead')[0] as ObjectType

      // Test few possible types
      expect(lead.fields.last_name.type.elemID.name).toBe('string')
      expect(lead.fields.description.type.elemID.name).toBe('longtextarea')
      expect(lead.fields.salutation.type.elemID.name).toBe('picklist')

      // Test label
      expect(lead.fields.last_name.getAnnotationsValues()[constants.LABEL]).toBe('Last Name')

      // Test true and false required
      expect(lead.fields.description.getAnnotationsValues()[Type.REQUIRED]).toBe(false)
      expect(lead.fields.created_date.getAnnotationsValues()[Type.REQUIRED]).toBe(true)

      // Test picklist restricted_pick_list prop
      expect(lead.fields.industry.getAnnotationsValues().restricted_pick_list).toBe(
        false
      )
      expect(
        lead.fields.clean_status.getAnnotationsValues().restricted_pick_list
      ).toBe(true)

      // Test picklist values
      expect(
        (lead.fields.salutation.getAnnotationsValues().values as string[]).join(';')
      ).toBe('Mr.;Ms.;Mrs.;Dr.;Prof.')

      // Test _default
      // TODO: add test to primitive with _default and combobox _default (no real example for lead)
      expect(lead.fields.status.getAnnotationsValues()[Type.DEFAULT]).toBe(
        'Open - Not Contacted'
      )
    })

    it('should discover metadata type', () => {
      const flow = result
        .filter(element => element.elemID.name === 'flow')
        .pop() as ObjectType
      expect(flow.fields.description.type.elemID.name).toBe('string')
      expect(flow.fields.is_template.type.elemID.name).toBe('boolean')
      expect(flow.fields.action_calls.type.elemID.name).toBe('flow_action_call')
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
    const objectExists = async (type: string, name: string, fields?: string[],
      missingFields?: string[], label?: string): Promise<boolean> => {
      const result = (await client.readMetadata(type, name)
      )[0] as CustomObject
      if (!result || !result.fullName) {
        return false
      }
      if (label && label !== result.label) {
        return false
      }
      if (fields || missingFields) {
        const fieldNames = makeArray(result.fields).map(rf => rf.fullName)
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
      const profileInfo = (await client.readMetadata(PROFILE_METADATA_TYPE,
        profile))[0] as ProfileInfo
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

    it('should add new profile instance', async () => {
      const instanceElementName = 'TestAddProfileInstance__c'
      const mockElemID = new ElemID(constants.SALESFORCE, 'test')
      const mockInstanceID = new ElemID(constants.SALESFORCE, instanceElementName)

      const instance = new InstanceElement(mockInstanceID, new ObjectType({
        elemID: mockElemID,
        fields: {
        },
        annotations: {},
        annotationsValues: {
          [constants.METADATA_TYPE]: PROFILE_METADATA_TYPE,
          [constants.API_NAME]: instanceElementName,
        },
      }),
      {
        fieldPermissions: [
          {
            field: 'Lead.Fax',
            readable: true,
            editable: false,
          },
          {
            editable: false,
            field: 'Account.AccountNumber',
            readable: false,
          },
        ],
        tabVisibilities: [
          {
            tab: 'standard-Account',
            visibility: 'DefaultOff',
          },
        ],
        userPermissions: [
          {
            enabled: false,
            name: 'ConvertLeads',
          },
        ],
        applicationVisibilities: [
          {
            application: 'standard__ServiceConsole',
            default: false,
            visible: true,
          },
        ],
        description: 'new e2e profile',
      })

      if (await objectExists(PROFILE_METADATA_TYPE, sfCase(instance.elemID.name))) {
        await adapter.remove(instance)
      }

      const post = await adapter.add(instance) as InstanceElement

      // Test
      expect(post).toBe(instance)

      expect(
        await objectExists(
          post.type.getAnnotationsValues()[constants.METADATA_TYPE], sfCase(post.elemID.name)
        )
      ).toBeTruthy()

      // Clean-up
      await adapter.remove(post)
    })

    it('should add custom object', async () => {
      const customObjectName = 'TestAddCustom__c'
      const mockElemID = new ElemID(constants.SALESFORCE, 'test')
      const element = new ObjectType({
        elemID: mockElemID,
        annotationsValues: {
          [constants.API_NAME]: customObjectName,
          [constants.METADATA_TYPE]: constants.CUSTOM_OBJECT,
        },
        fields: {
          description: new Field(
            mockElemID,
            'description',
            stringType,
            {
              [Type.REQUIRED]: false,
              [Type.DEFAULT]: '"test"',
              [constants.LABEL]: 'description label',
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
              [constants.LABEL]: 'Test formula',
              [constants.FORMULA]: '"some text"',
            },
          ),
        },
      })

      if (await objectExists(constants.CUSTOM_OBJECT, customObjectName)) {
        await adapter.remove(element)
      }
      const post = await adapter.add(element) as ObjectType

      // Test
      expect(post).toBeInstanceOf(ObjectType)
      expect(
        post.fields.description.getAnnotationsValues()[constants.API_NAME]
      ).toBe('Description__c')
      expect(
        post.fields.formula.getAnnotationsValues()[constants.API_NAME]
      ).toBe('Formula__c')

      expect(await objectExists(constants.CUSTOM_OBJECT, customObjectName, ['Description__c', 'Formula__c'])).toBe(true)
      expect((await permissionExists('Admin', [`${customObjectName}.Description__c`]))[0]).toBe(true)
      expect((await permissionExists('Standard', [`${customObjectName}.Description__c`]))[0]).toBe(true)

      // Clean-up
      await adapter.remove(post)
    })

    it('should remove object', async () => {
      const customObjectName = 'TestRemoveCustom__c'
      const mockElemID = new ElemID(constants.SALESFORCE, 'test remove custom')
      const element = new ObjectType({
        elemID: mockElemID,
        annotationsValues: {
          [constants.API_NAME]: customObjectName,
          [constants.METADATA_TYPE]: constants.CUSTOM_OBJECT,
        },
        fields: {
          description: new Field(
            mockElemID,
            'description',
            stringType,
            {
              [constants.LABEL]: 'test label',
              [Type.REQUIRED]: false,
              [Type.DEFAULT]: '"test"',
            },
          ),
        },
      })
      // Setup
      if (!await objectExists(constants.CUSTOM_OBJECT, customObjectName)) {
        await adapter.add(element)
        expect(await objectExists(constants.CUSTOM_OBJECT, customObjectName)).toBe(true)
      }
      // Run
      const removeResult = await adapter.remove(element)
      // Validate
      expect(removeResult).toBeUndefined()
      expect(await objectExists(constants.CUSTOM_OBJECT, customObjectName)).toBe(false)
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
          [constants.LABEL]: 'test label',
          [constants.API_NAME]: customObjectName,
          [constants.METADATA_TYPE]: constants.CUSTOM_OBJECT,
        },
      })

      if (await objectExists(constants.CUSTOM_OBJECT, customObjectName)) {
        await adapter.remove(oldElement)
      }
      const addResult = await adapter.add(oldElement)
      // Verify setup was performed properly
      expect(addResult).toBeInstanceOf(ObjectType)

      expect(await objectExists(constants.CUSTOM_OBJECT, customObjectName, ['Address__c', 'Banana__c'])).toBe(true)

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
          [constants.LABEL]: 'test2 label',
          [constants.API_NAME]: customObjectName,
        },
      })

      // Test
      const modificationResult = await adapter.update(oldElement, newElement)

      expect(modificationResult).toBeInstanceOf(ObjectType)
      expect(await objectExists(constants.CUSTOM_OBJECT, customObjectName, ['Banana__c', 'Description__c'],
        ['Address__c'])).toBe(true)
      expect((await permissionExists('Admin', [`${customObjectName}.Description__c`]))[0]).toBe(true)

      // Clean-up
      await adapter.remove(oldElement)
    })

    it('should modify an instance', async () => {
      const instanceElementName = 'TestProfileInstanceUpdate__c'
      const mockElemID = new ElemID(constants.SALESFORCE, 'test')
      const mockInstanceID = new ElemID(constants.SALESFORCE, instanceElementName)
      const oldInstance = new InstanceElement(mockInstanceID, new ObjectType({
        elemID: mockElemID,
        fields: {
        },
        annotations: {},
        annotationsValues: {
          [constants.METADATA_TYPE]: PROFILE_METADATA_TYPE,
          [constants.API_NAME]: instanceElementName,
        },
      }),
      {
        fieldPermissions: [
          {
            field: 'Lead.Fax',
            readable: 'true',
            editable: 'false',
          },
          {
            editable: 'false',
            field: 'Account.AccountNumber',
            readable: 'false',
          },
        ],
        tabVisibilities: [
          {
            tab: 'standard-Account',
            visibility: 'DefaultOff',
          },
        ],
        applicationVisibilities: [
          {
            application: 'standard__ServiceConsole',
            default: 'false',
            visible: 'true',
          },
        ],
        description: 'new e2e profile',
      })

      const newInstance = new InstanceElement(mockInstanceID, new ObjectType({
        elemID: mockElemID,
        fields: {
        },
        annotations: {},
        annotationsValues: {
          [constants.METADATA_TYPE]: PROFILE_METADATA_TYPE,
          [constants.API_NAME]: instanceElementName,
        },
      }),
      {
        fieldPermissions: [
          {
            field: 'Lead.Fax',
            readable: 'true',
            editable: 'true',
          },
          {
            editable: 'false',
            field: 'Account.AccountNumber',
            readable: 'false',
          },
          {
            editable: 'false',
            field: 'Account.AnnualRevenue',
            readable: 'false',
          },
        ],
        tabVisibilities: [
          {
            tab: 'standard-Account',
            visibility: 'DefaultOff',
          },
        ],
        applicationVisibilities: [
          {
            application: 'standard__ServiceConsole',
            default: 'false',
            visible: 'true',
          },
        ],
        description: 'updated e2e profile',

      })

      if (await objectExists(PROFILE_METADATA_TYPE, sfCase(oldInstance.elemID.name))) {
        await adapter.remove(oldInstance)
      }

      const post = await adapter.add(oldInstance) as InstanceElement
      const updateResult = await adapter.update(oldInstance, newInstance)

      // Test
      expect(updateResult).toBe(newInstance)

      // Checking that the saved instance identical to newInstance
      const savedInstance = (await client.readMetadata(
        PROFILE_METADATA_TYPE, sfCase(newInstance.elemID.name)
      ))[0] as Profile

      type Profile = ProfileInfo & {
        tabVisibilities: Record<string, Value>
        applicationVisibilities: Record<string, Value>
      }

      const valuesMap = new Map<string, Value>()
      const newValues = newInstance.value
      savedInstance.fieldPermissions.forEach(f => valuesMap.set(f.field, f))
      savedInstance.tabVisibilities.forEach((f: Value) => valuesMap.set(f.tab, f))
      savedInstance.applicationVisibilities.forEach((f: Value) => valuesMap.set(f.application, f))

      expect((newValues.fieldPermissions as []).some((v: Value) =>
        _.isEqual(v, valuesMap.get(v.field)))).toBeTruthy()

      expect((newValues.tabVisibilities as []).some((v: Value) =>
        _.isEqual(v, valuesMap.get(v.tab)))).toBeTruthy()

      expect((newValues.applicationVisibilities as []).some((v: Value) =>
        _.isEqual(v, valuesMap.get(v.application)))).toBeTruthy()


      // Clean-up
      await adapter.remove(post)
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
              [constants.LABEL]: 'Address',
            },
          ),
          banana: new Field(
            mockElemID,
            'banana',
            stringType,
            {
              [constants.API_NAME]: 'Banana__c',
              [constants.LABEL]: 'Banana',
            },
          ),
        },
        annotationsValues: {
          [Type.REQUIRED]: false,
          [Type.DEFAULT]: 'test',
          [constants.LABEL]: 'test label',
          [constants.API_NAME]: customObjectName,
          [constants.METADATA_TYPE]: constants.CUSTOM_OBJECT,
        },
      })

      if (await objectExists(constants.CUSTOM_OBJECT, customObjectName)) {
        await adapter.remove(oldElement)
      }
      await adapter.add(oldElement)

      const newElement = new ObjectType({
        elemID: mockElemID,
        fields: {
          address: new Field(
            mockElemID,
            'address',
            stringType,
            {
              [constants.API_NAME]: 'Address__c',
              [constants.LABEL]: 'Address',
            },
          ),
          banana: new Field(
            mockElemID,
            'banana',
            stringType,
            {
              [constants.API_NAME]: 'Banana__c',
              [constants.LABEL]: 'Banana Split',
            },
          ),
        },
        annotationsValues: {
          [Type.REQUIRED]: false,
          [Type.DEFAULT]: 'test2',
          [constants.LABEL]: 'test label 2',
          [constants.API_NAME]: customObjectName,
        },
      })

      // Test
      const modificationResult = await adapter.update(oldElement, newElement)
      expect(modificationResult).toBeInstanceOf(ObjectType)
      expect(await objectExists(constants.CUSTOM_OBJECT, customObjectName, undefined, undefined, 'test label 2')).toBe(true)

      const readResult = (await client.readMetadata(
        constants.CUSTOM_OBJECT,
        customObjectName
      ))[0] as CustomObject
      const field = makeArray(readResult.fields).filter(f => f.fullName === 'Banana__c')[0]
      expect(field).toBeDefined()
      expect(field.label).toBe('Banana Split')

      // Clean-up
      await adapter.remove(oldElement)
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
          [constants.LABEL]: 'test label',
          [constants.API_NAME]: customObjectName,
          [constants.METADATA_TYPE]: constants.CUSTOM_OBJECT,
        },
      })

      if (await objectExists(constants.CUSTOM_OBJECT, customObjectName)) {
        await adapter.remove(oldElement)
      }
      const addResult = await adapter.add(oldElement)
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
          [constants.LABEL]: 'test label',
          [constants.API_NAME]: customObjectName,
        },
      })

      // Test
      const modificationResult = await adapter.update(oldElement, newElement)
      expect(modificationResult).toBeInstanceOf(ObjectType)

      expect(await objectExists(constants.CUSTOM_OBJECT, customObjectName)).toBe(true)

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
      await adapter.remove(oldElement)
    })

    it('should add a custom object with various field types', async () => {
      const customObjectName = 'TestAddFieldTypes__c'
      const mockElemID = new ElemID(constants.SALESFORCE, 'test add custom object with various field types')
      const adminReadable = {
        [FIELD_LEVEL_SECURITY_ANNOTATION]: {
          admin: { editable: false, readable: true },
        },
      }
      const element = new ObjectType({
        elemID: mockElemID,
        annotationsValues: {
          [constants.API_NAME]: customObjectName,
          [constants.METADATA_TYPE]: constants.CUSTOM_OBJECT,
        },
        fields: {
          pickle: new Field(
            mockElemID,
            'pickle',
            Types.salesforceDataTypes.picklist,
            {
              [Type.REQUIRED]: false,
              // TODO: At this point we do not know how to pass a default value for a picklist
              // (API fails for this field)
              // [Type.DEFAULT]: 'NEW',
              [constants.LABEL]: 'Picklist description label',
              values: ['NEW', 'OLD'],
              ...adminReadable,
            },
          ),
          alpha: new Field(
            mockElemID,
            'alpha',
            Types.salesforceDataTypes.currency,
            {
              [Type.REQUIRED]: false,
              [Type.DEFAULT]: 25,
              [constants.LABEL]: 'Currency description label',
              [constants.FIELD_ANNOTATIONS.SCALE]: 3,
              [constants.FIELD_ANNOTATIONS.PRECISION]: 18,
              ...adminReadable,
            },
          ),
          bravo: new Field(
            mockElemID,
            'bravo',
            Types.salesforceDataTypes.autonumber,
            {
              [Type.REQUIRED]: false,
              [constants.LABEL]: 'Autonumber description label',
              [constants.FIELD_ANNOTATIONS.DISPLAY_FORMAT]: 'ZZZ-{0000}',
              ...adminReadable,
            },
          ),
          charlie: new Field(
            mockElemID,
            'charlie',
            Types.salesforceDataTypes.date,
            {
              [constants.LABEL]: 'Date description label',
              [Type.DEFAULT]: 'Today() + 7',
              ...adminReadable,
            },
          ),
          delta: new Field(
            mockElemID,
            'delta',
            Types.salesforceDataTypes.time,
            {
              [constants.LABEL]: 'Time description label',
              [Type.DEFAULT]: 'TIMENOW() + 5',
              ...adminReadable,
            },
          ),
          echo: new Field(
            mockElemID,
            'echo',
            Types.salesforceDataTypes.datetime,
            {
              [constants.LABEL]: 'DateTime description label',
              [Type.DEFAULT]: 'Now() + 7',
              ...adminReadable,
            },
          ),
          foxtrot: new Field(
            mockElemID,
            'foxtrot',
            Types.salesforceDataTypes.email,
            {
              [constants.LABEL]: 'Email description label',
              [constants.FIELD_ANNOTATIONS.UNIQUE]: true,
              [constants.FIELD_ANNOTATIONS.CASE_SENSITIVE]: true,
              ...adminReadable,
            },
          ),
          golf: new Field(
            mockElemID,
            'golf',
            Types.salesforceDataTypes.location,
            {
              [constants.LABEL]: 'Location description label',
              [constants.FIELD_ANNOTATIONS.SCALE]: 2,
              [constants.FIELD_ANNOTATIONS.DISPLAY_LOCATION_IN_DECIMAL]: true,
              ...adminReadable,
            },
          ),
          hotel: new Field(
            mockElemID,
            'hotel',
            Types.salesforceDataTypes.multipicklist,
            {
              [constants.LABEL]: 'Multipicklist description label',
              values: ['DO', 'RE', 'MI', 'FA', 'SOL', 'LA', 'SI'],
              [constants.FIELD_ANNOTATIONS.VISIBLE_LINES]: 4,
              ...adminReadable,
            },
          ),
          india: new Field(
            mockElemID,
            'india',
            Types.salesforceDataTypes.percent,
            {
              [constants.LABEL]: 'Percent description label',
              [constants.FIELD_ANNOTATIONS.SCALE]: 3,
              [constants.FIELD_ANNOTATIONS.PRECISION]: 12,
              ...adminReadable,
            },
          ),
          juliett: new Field(
            mockElemID,
            'juliett',
            Types.salesforceDataTypes.phone,
            {
              [constants.LABEL]: 'Phone description label',
              ...adminReadable,
            },
          ),
          kilo: new Field(
            mockElemID,
            'kilo',
            Types.salesforceDataTypes.longtextarea,
            {
              [constants.LABEL]: 'LongTextArea description label',
              [constants.FIELD_ANNOTATIONS.VISIBLE_LINES]: 5,
              ...adminReadable,
            },
          ),
          lima: new Field(
            mockElemID,
            'lima',
            Types.salesforceDataTypes.richtextarea,
            {
              [constants.LABEL]: 'RichTextArea description label',
              [constants.FIELD_ANNOTATIONS.VISIBLE_LINES]: 27,
              ...adminReadable,
            },
          ),
          mike: new Field(
            mockElemID,
            'mike',
            Types.salesforceDataTypes.textarea,
            {
              [constants.LABEL]: 'TextArea description label',
              ...adminReadable,
            },
          ),
          november: new Field(
            mockElemID,
            'november',
            Types.salesforceDataTypes.encryptedtext,
            {
              [constants.LABEL]: 'EncryptedText description label',
              [constants.FIELD_ANNOTATIONS.MASK_TYPE]: 'creditCard',
              [constants.FIELD_ANNOTATIONS.MASK_CHAR]: 'X',
              [constants.FIELD_ANNOTATIONS.LENGTH]: 35,
              ...adminReadable,
            },
          ),
          oscar: new Field(
            mockElemID,
            'oscar',
            Types.salesforceDataTypes.url,
            {
              [constants.LABEL]: 'Url description label',
              ...adminReadable,
            },
          ),
          papa: new Field(
            mockElemID,
            'papa',
            Types.salesforceDataTypes.number,
            {
              [constants.FIELD_ANNOTATIONS.SCALE]: 3,
              [constants.FIELD_ANNOTATIONS.PRECISION]: 15,
              [constants.FIELD_ANNOTATIONS.UNIQUE]: true,
              [Type.DEFAULT]: 42,
              [constants.LABEL]: 'Number description label',
              ...adminReadable,
            },
          ),
        },
      })

      if (await objectExists(constants.CUSTOM_OBJECT, customObjectName)) {
        await adapter.remove(element)
      }
      const post = await adapter.add(element)

      // Test
      const objectFields = await client.describeSObjects([customObjectName])
      expect(objectFields[0]).toBeDefined()
      const allFields = objectFields[0].fields
      // Verify picklist
      const picklistField = allFields.filter(field => field.name === 'Pickle__c')[0]
      expect(picklistField).toBeDefined()
      expect(picklistField.label).toBe('Picklist description label')
      expect(picklistField.type).toBe('picklist')
      expect(_.isEqual((picklistField.picklistValues as PicklistEntry[]).map(value => value.label), ['NEW', 'OLD'])).toBeTruthy()
      // Verify currency
      const currencyField = allFields.filter(field => field.name === 'Alpha__c')[0]
      expect(currencyField).toBeDefined()
      expect(currencyField.label).toBe('Currency description label')
      expect(currencyField.scale).toBe(3)
      expect(currencyField.precision).toBe(18)
      expect(currencyField.type).toBe('currency')
      // Verify autonumber
      const autonumber = allFields.filter(field => field.name === 'Bravo__c')[0]
      expect(autonumber).toBeDefined()
      expect(autonumber.label).toBe('Autonumber description label')
      expect(autonumber.type).toBe('string')
      // TODO: As of this point we do not knpow how to retrieve the displayFormat annotation from
      // the autonumber field

      // Verify date
      const date = allFields.filter(field => field.name === 'Charlie__c')[0]
      expect(date).toBeDefined()
      expect(date.label).toBe('Date description label')
      expect(date.type).toBe('date')
      // Verify time
      const time = allFields.filter(field => field.name === 'Delta__c')[0]
      expect(time).toBeDefined()
      expect(time.label).toBe('Time description label')
      expect(time.type).toBe('time')
      // Verify datetime
      const datetime = allFields.filter(field => field.name === 'Echo__c')[0]
      expect(datetime).toBeDefined()
      expect(datetime.label).toBe('DateTime description label')
      expect(datetime.type).toBe('datetime')
      // Verify email
      const email = allFields.filter(field => field.name === 'Foxtrot__c')[0]
      expect(email).toBeDefined()
      expect(email.label).toBe('Email description label')
      expect(email.type).toBe('email')
      expect(email.unique).toBe(true)
      expect(email.caseSensitive).toBe(true)
      // Verify location
      const location = allFields.filter(field => field.name === 'Golf__c')[0]
      expect(location).toBeDefined()
      expect(location.label).toBe('Location description label')
      expect(location.type).toBe('location')
      expect(location.displayLocationInDecimal).toBe(true)
      // TODO: From some reason the api returns scale = 0 despite the fact that it successfully
      // sets the scale to what was defined (verified in Salesforce UX)
      // expect(location.scale).toBe(2)

      // Verify multipicklist
      const multipicklist = allFields.filter(field => field.name === 'Hotel__c')[0]
      expect(multipicklist).toBeDefined()
      expect(multipicklist.label).toBe('Multipicklist description label')
      expect(multipicklist.type).toBe('multipicklist')
      expect(multipicklist.precision).toBe(4)
      expect(_.isEqual((multipicklist.picklistValues as PicklistEntry[]).map(value => value.label), ['DO', 'RE', 'MI', 'FA', 'SOL', 'LA', 'SI'])).toBeTruthy()
      // Verify percent
      const percentField = allFields.filter(field => field.name === 'India__c')[0]
      expect(percentField).toBeDefined()
      expect(percentField.label).toBe('Percent description label')
      expect(percentField.type).toBe('percent')
      expect(percentField.scale).toBe(3)
      expect(percentField.precision).toBe(12)
      // Verify phone
      const phoneField = allFields.filter(field => field.name === 'Juliett__c')[0]
      expect(phoneField).toBeDefined()
      expect(phoneField.label).toBe('Phone description label')
      expect(phoneField.type).toBe('phone')
      // Verify longtextarea
      // TODO: We do not know how to retrieve the visible lines info when discovering
      // long text area
      const longTextAreaField = allFields.filter(field => field.name === 'Kilo__c')[0]
      expect(longTextAreaField).toBeDefined()
      expect(longTextAreaField.label).toBe('LongTextArea description label')
      expect(longTextAreaField.type).toBe('textarea')
      expect(longTextAreaField.length).toBe(32768)
      // Verify richtextarea
      // TODO: We do not know how to retrieve the visible lines info when discovering
      // rich text area
      const richTextAreaField = allFields.filter(field => field.name === 'Lima__c')[0]
      expect(richTextAreaField).toBeDefined()
      expect(richTextAreaField.label).toBe('RichTextArea description label')
      expect(richTextAreaField.type).toBe('textarea')
      expect(richTextAreaField.length).toBe(32768)
      // Verify textarea
      const textAreaField = allFields.filter(field => field.name === 'Mike__c')[0]
      expect(textAreaField).toBeDefined()
      expect(textAreaField.label).toBe('TextArea description label')
      expect(textAreaField.type).toBe('textarea')
      // Verify Encrypted Text
      const encryptedTextField = allFields.filter(field => field.name === 'November__c')[0]
      expect(encryptedTextField).toBeDefined()
      expect(encryptedTextField.label).toBe('EncryptedText description label')
      expect(encryptedTextField.type).toBe('encryptedstring')
      expect(encryptedTextField.mask).toBe('X')
      expect(encryptedTextField.maskType).toBe('creditCard')
      expect(encryptedTextField.length).toBe(35)
      // Verify textarea
      const urlField = allFields.filter(field => field.name === 'Oscar__c')[0]
      expect(urlField).toBeDefined()
      expect(urlField.label).toBe('Url description label')
      expect(urlField.type).toBe('url')
      // Verify number
      const numberField = allFields.filter(field => field.name === 'Papa__c')[0]
      expect(numberField).toBeDefined()
      expect(numberField.label).toBe('Number description label')
      expect(numberField.type).toBe('double')
      expect(numberField.defaultValueFormula).toBe('42')
      expect(numberField.scale).toBe(3)
      expect(numberField.precision).toBe(15)
      expect(numberField.unique).toBe(true)

      // Clean-up
      await adapter.remove(post as ObjectType)
    })

    // Assignment rules are special because they use the Deploy API so they get their own test
    describe('assignment rules manipulation', () => {
      const getRulesFromClient = async (): Promise<Values> => fromMetadataInfo(
        (await client.readMetadata('AssignmentRules', 'Lead'))[0]
      )

      const dummyAssignmentRulesType = new ObjectType({
        elemID: new ElemID(constants.SALESFORCE, 'assignment_rules'),
        annotationsValues: {
          [constants.METADATA_TYPE]: 'AssignmentRules',
        },
      })

      let before: InstanceElement
      let after: InstanceElement
      let validAssignment: Values

      beforeAll(async () => {
        before = new InstanceElement(
          new ElemID(constants.SALESFORCE, 'lead_assignment_rules'),
          dummyAssignmentRulesType,
          await getRulesFromClient(),
        )
        validAssignment = _.omit(
          _.flatten([_.flatten([before.value.assignment_rule])[0].rule_entry]).pop(),
          'criteria_items'
        )
      })

      beforeEach(async () => {
        after = new InstanceElement(
          before.elemID,
          before.type,
          _.cloneDeep(before.value),
        )
      })

      afterEach(async () => {
        await adapter.update(after, before)
      })

      it('should create rule', async () => {
        // eslint-disable-next-line @typescript-eslint/camelcase
        after.value.assignment_rule = _.flatten([
          after.value.assignment_rule,
          {
            // eslint-disable-next-line @typescript-eslint/camelcase
            full_name: 'NonStandard',
            active: 'false',
            // eslint-disable-next-line @typescript-eslint/camelcase
            rule_entry: _.merge({}, validAssignment, {
              // eslint-disable-next-line @typescript-eslint/camelcase
              criteria_items: {
                field: 'Lead.City',
                operation: 'equals',
                value: 'Here',
              },
            }),
          },
        ])

        await adapter.update(before, after)

        const updatedRules = await getRulesFromClient()
        // Since assignment rules order is not relevant so we have to compare sets
        expect(new Set(updatedRules.assignment_rule)).toEqual(new Set(after.value.assignment_rule))

        // Because removing assignment rules does not work currently, we have to clean up with a
        // different api call, this part of the test should be changed once removing rules works
        // we should be issuing another `sfAdater.update` call here in order to remove the rule
        await client.delete('AssignmentRule', 'Lead.NonStandard')

        // TODO: test deletion of assignment rule once it is fixed
      })

      it('should update existing', async () => {
        // eslint-disable-next-line @typescript-eslint/camelcase
        const rule = _.flatten([after.value.assignment_rule])[0]
        // eslint-disable-next-line @typescript-eslint/camelcase
        rule.rule_entry = _.flatten([rule.rule_entry])
        rule.rule_entry.push(_.merge({}, validAssignment, {
          // eslint-disable-next-line @typescript-eslint/camelcase
          assigned_to: validAssignment.assigned_to,
          // eslint-disable-next-line @typescript-eslint/camelcase
          assigned_to_type: validAssignment.assigned_to_type,
          // eslint-disable-next-line @typescript-eslint/camelcase
          criteria_items: [
            {
              field: 'Lead.City',
              operation: 'startsWith',
              value: 'A',
            },
            {
              field: 'Lead.Country',
              operation: 'startsWith',
              value: 'B',
            },
          ],
        }))
        _.flatten([rule.rule_entry[0].criteria_items])[0].value = 'bla'

        await adapter.update(before, after)

        const updatedRules = await getRulesFromClient()
        expect(updatedRules).toEqual(after.value)
      })
    })
  })
})
