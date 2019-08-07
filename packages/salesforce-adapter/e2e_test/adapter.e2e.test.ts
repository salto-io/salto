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
import { Types, sfCase } from '../src/transformer'

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

    const objectExists = async (type: string, name: string, fields?: string[],
      missingFields?: string[], label?: string): Promise<boolean> => {
      const result = (await sfAdapter.client.readMetadata(type, name)
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

    it('should add new profile instance', async () => {
      const instanceElementName = 'TestAddProfileInstance__c'
      const mockElemID = new ElemID(constants.SALESFORCE, instanceElementName)
      const instance = new InstanceElement(mockElemID, new ObjectType({
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
        await sfAdapter.remove(instance)
      }

      const post = await sfAdapter.add(instance) as InstanceElement

      // Test
      expect(post).toBe(instance)

      expect(
        await objectExists(
          post.type.getAnnotationsValues()[constants.METADATA_TYPE], sfCase(post.elemID.name)
        )
      ).toBeTruthy()

      // Clean-up
      await sfAdapter.remove(post)
    })

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

      if (await objectExists(constants.CUSTOM_OBJECT, customObjectName) === true) {
        await sfAdapter.remove(element)
      }
      const post = await sfAdapter.add(element) as ObjectType

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
      await sfAdapter.remove(post)
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
              label: 'test label',
              [Type.REQUIRED]: false,
              [Type.DEFAULT]: 'test',
            },
          ),
        },
      })
      // Setup
      if (await objectExists(constants.CUSTOM_OBJECT, customObjectName) === false) {
        await sfAdapter.add(element)
        expect(await objectExists(constants.CUSTOM_OBJECT, customObjectName)).toBe(true)
      }
      // Run
      const removeResult = await sfAdapter.remove(element)
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
          label: 'test label',
          [constants.API_NAME]: customObjectName,
          [constants.METADATA_TYPE]: constants.CUSTOM_OBJECT,
        },
      })

      if (await objectExists(constants.CUSTOM_OBJECT, customObjectName) === true) {
        await sfAdapter.remove(oldElement)
      }
      const addResult = await sfAdapter.add(oldElement)
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
          label: 'test2 label',
          [constants.API_NAME]: customObjectName,
        },
      })

      // Test
      const modificationResult = await sfAdapter.update(oldElement, newElement)

      expect(modificationResult).toBeInstanceOf(ObjectType)
      expect(await objectExists(constants.CUSTOM_OBJECT, customObjectName, ['Banana__c', 'Description__c'],
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
          [constants.METADATA_TYPE]: constants.CUSTOM_OBJECT,
        },
      })

      if (await objectExists(constants.CUSTOM_OBJECT, customObjectName)) {
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
      expect(await objectExists(constants.CUSTOM_OBJECT, customObjectName, undefined, undefined, 'test label 2')).toBe(true)

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
          [constants.METADATA_TYPE]: constants.CUSTOM_OBJECT,
        },
      })

      if (await objectExists(constants.CUSTOM_OBJECT, customObjectName) === true) {
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
          pickle: new Field(
            mockElemID,
            'pickle',
            Types.salesforceDataTypes.picklist,
            {
              [Type.REQUIRED]: false,
              // TODO: At this point we do not know how to pass a default value for a picklist
              // (API fails for this field)
              // [Type.DEFAULT]: 'NEW',
              label: 'Picklist description label',
              values: ['NEW', 'OLD'],
              [FIELD_LEVEL_SECURITY_ANNOTATION]: {
                admin: { editable: false, readable: true },
                standard: { editable: false, readable: true },
              },
            },
          ),
          alpha: new Field(
            mockElemID,
            'alpha',
            Types.salesforceDataTypes.currency,
            {
              [Type.REQUIRED]: false,
              [Type.DEFAULT]: 25,
              label: 'Currency description label',
              [constants.SCALE]: 3,
              [constants.PRECISION]: 18,
              [FIELD_LEVEL_SECURITY_ANNOTATION]: {
                admin: { editable: false, readable: true },
                standard: { editable: false, readable: true },
              },
            },
          ),
          bravo: new Field(
            mockElemID,
            'bravo',
            Types.salesforceDataTypes.autonumber,
            {
              [Type.REQUIRED]: false,
              label: 'Autonumber description label',
              displayFormat: 'ZZZ-{0000}',
              [FIELD_LEVEL_SECURITY_ANNOTATION]: {
                admin: { editable: false, readable: true },
                standard: { editable: false, readable: true },
              },
            },
          ),
          charlie: new Field(
            mockElemID,
            'charlie',
            Types.salesforceDataTypes.date,
            {
              label: 'Date description label',
              [Type.DEFAULT]: 'Today() + 7',
              [FIELD_LEVEL_SECURITY_ANNOTATION]: {
                admin: { editable: false, readable: true },
                standard: { editable: false, readable: true },
              },
            },
          ),
          delta: new Field(
            mockElemID,
            'delta',
            Types.salesforceDataTypes.time,
            {
              label: 'Time description label',
              [Type.DEFAULT]: 'TIMENOW() + 5',
              [FIELD_LEVEL_SECURITY_ANNOTATION]: {
                admin: { editable: false, readable: true },
                standard: { editable: false, readable: true },
              },
            },
          ),
          echo: new Field(
            mockElemID,
            'echo',
            Types.salesforceDataTypes.datetime,
            {
              label: 'DateTime description label',
              [Type.DEFAULT]: 'Now() + 7',
              [FIELD_LEVEL_SECURITY_ANNOTATION]: {
                admin: { editable: false, readable: true },
                standard: { editable: false, readable: true },
              },
            },
          ),
          foxtrot: new Field(
            mockElemID,
            'foxtrot',
            Types.salesforceDataTypes.email,
            {
              label: 'Email description label',
              [constants.UNIQUE]: true,
              [constants.CASESENSITIVE]: true,
              [FIELD_LEVEL_SECURITY_ANNOTATION]: {
                admin: { editable: false, readable: true },
                standard: { editable: false, readable: true },
              },
            },
          ),
          golf: new Field(
            mockElemID,
            'golf',
            Types.salesforceDataTypes.location,
            {
              label: 'Location description label',
              [constants.SCALE]: 2,
              [constants.DISPLAYLOCATIONINDECIMAL]: true,
              [FIELD_LEVEL_SECURITY_ANNOTATION]: {
                admin: { editable: false, readable: true },
                standard: { editable: false, readable: true },
              },
            },
          ),
          hotel: new Field(
            mockElemID,
            'hotel',
            Types.salesforceDataTypes.multipicklist,
            {
              label: 'Multipicklist description label',
              values: ['DO', 'RE', 'MI', 'FA', 'SOL', 'LA', 'SI'],
              [constants.VISIBLELINES]: 4,
              [FIELD_LEVEL_SECURITY_ANNOTATION]: {
                admin: { editable: false, readable: true },
                standard: { editable: false, readable: true },
              },
            },
          ),
          india: new Field(
            mockElemID,
            'india',
            Types.salesforceDataTypes.percent,
            {
              label: 'Percent description label',
              [constants.SCALE]: 3,
              [constants.PRECISION]: 12,
              [FIELD_LEVEL_SECURITY_ANNOTATION]: {
                admin: { editable: false, readable: true },
                standard: { editable: false, readable: true },
              },
            },
          ),
          juliett: new Field(
            mockElemID,
            'juliett',
            Types.salesforceDataTypes.phone,
            {
              label: 'Phone description label',
              [FIELD_LEVEL_SECURITY_ANNOTATION]: {
                admin: { editable: false, readable: true },
                standard: { editable: false, readable: true },
              },
            },
          ),
          kilo: new Field(
            mockElemID,
            'kilo',
            Types.salesforceDataTypes.longtextarea,
            {
              label: 'LongTextArea description label',
              [constants.VISIBLELINES]: 5,
              [FIELD_LEVEL_SECURITY_ANNOTATION]: {
                admin: { editable: false, readable: true },
                standard: { editable: false, readable: true },
              },
            },
          ),
          lima: new Field(
            mockElemID,
            'lima',
            Types.salesforceDataTypes.richtextarea,
            {
              label: 'RichTextArea description label',
              [constants.VISIBLELINES]: 27,
              [FIELD_LEVEL_SECURITY_ANNOTATION]: {
                admin: { editable: false, readable: true },
                standard: { editable: false, readable: true },
              },
            },
          ),
          mike: new Field(
            mockElemID,
            'mike',
            Types.salesforceDataTypes.textarea,
            {
              label: 'TextArea description label',
              [FIELD_LEVEL_SECURITY_ANNOTATION]: {
                admin: { editable: false, readable: true },
                standard: { editable: false, readable: true },
              },
            },
          ),
          november: new Field(
            mockElemID,
            'november',
            Types.salesforceDataTypes.encryptedtext,
            {
              label: 'EncryptedText description label',
              [constants.MASKTYPE]: 'creditCard',
              [constants.MASKCHAR]: 'X',
              [constants.LENGTH]: 35,
              [FIELD_LEVEL_SECURITY_ANNOTATION]: {
                admin: { editable: false, readable: true },
                standard: { editable: false, readable: true },
              },
            },
          ),
          oscar: new Field(
            mockElemID,
            'oscar',
            Types.salesforceDataTypes.url,
            {
              label: 'Url description label',
              [FIELD_LEVEL_SECURITY_ANNOTATION]: {
                admin: { editable: false, readable: true },
                standard: { editable: false, readable: true },
              },
            },
          ),
        },
      })

      if (await objectExists(constants.CUSTOM_OBJECT, customObjectName) === true) {
        await sfAdapter.remove(element)
      }
      const post = await sfAdapter.add(element)

      // Test
      const objectFields = await sfAdapter.client.describeSObjects([customObjectName])
      expect(objectFields[0]).toBeDefined()
      const allFields = objectFields[0].fields
      // Verify picklist
      const picklistField = allFields.filter(field => field.name === 'Pickle__c')[0]
      expect(picklistField).toBeDefined()
      expect(picklistField.label).toBe('Picklist description label')
      expect(_.isEqual((picklistField.picklistValues as PicklistEntry[]).map(value => value.label), ['NEW', 'OLD'])).toBeTruthy()
      // Verify currency
      const currencyField = allFields.filter(field => field.name === 'Alpha__c')[0]
      expect(currencyField).toBeDefined()
      expect(currencyField.label).toBe('Currency description label')
      expect(currencyField.scale).toBe(3)
      expect(currencyField.precision).toBe(18)
      // Verify autonumber
      const autonumber = allFields.filter(field => field.name === 'Bravo__c')[0]
      expect(autonumber).toBeDefined()
      expect(autonumber.label).toBe('Autonumber description label')
      // TODO: As of this point we do not knpow how to retrieve the displayFormat annotation from
      // the autonumber field

      // Verify date
      const date = allFields.filter(field => field.name === 'Charlie__c')[0]
      expect(date).toBeDefined()
      expect(date.label).toBe('Date description label')
      // Verify time
      const time = allFields.filter(field => field.name === 'Delta__c')[0]
      expect(time).toBeDefined()
      expect(time.label).toBe('Time description label')
      // Verify datetime
      const datetime = allFields.filter(field => field.name === 'Echo__c')[0]
      expect(datetime).toBeDefined()
      expect(datetime.label).toBe('DateTime description label')
      // Verify email
      const email = allFields.filter(field => field.name === 'Foxtrot__c')[0]
      expect(email).toBeDefined()
      expect(email.label).toBe('Email description label')
      expect(email.unique).toBe(true)
      expect(email.caseSensitive).toBe(true)
      // Verify location
      const location = allFields.filter(field => field.name === 'Golf__c')[0]
      expect(location).toBeDefined()
      expect(location.label).toBe('Location description label')
      expect(location.displayLocationInDecimal).toBe(true)
      // TODO: From some reason the api returns scale = 0 despite the fact that it successfully
      // sets the scale to what was defined (verified in Salesforce UX)
      // expect(location.scale).toBe(2)

      // Verify multipicklist
      const multipicklist = allFields.filter(field => field.name === 'Hotel__c')[0]
      expect(multipicklist).toBeDefined()
      expect(multipicklist.label).toBe('Multipicklist description label')
      expect(multipicklist.precision).toBe(4)
      expect(_.isEqual((multipicklist.picklistValues as PicklistEntry[]).map(value => value.label), ['DO', 'RE', 'MI', 'FA', 'SOL', 'LA', 'SI'])).toBeTruthy()
      // Verify percent
      const percentField = allFields.filter(field => field.name === 'India__c')[0]
      expect(percentField).toBeDefined()
      expect(percentField.label).toBe('Percent description label')
      expect(percentField.scale).toBe(3)
      expect(percentField.precision).toBe(12)
      // Verify phone
      const phoneField = allFields.filter(field => field.name === 'Juliett__c')[0]
      expect(phoneField).toBeDefined()
      expect(phoneField.label).toBe('Phone description label')
      // Verify longtextarea
      const longTextAreaField = allFields.filter(field => field.name === 'Kilo__c')[0]
      expect(longTextAreaField).toBeDefined()
      expect(longTextAreaField.label).toBe('LongTextArea description label')
      expect(longTextAreaField[constants.LENGTH]).toBe(32768)
      // Verify richtextarea
      const richTextAreaField = allFields.filter(field => field.name === 'Lima__c')[0]
      expect(richTextAreaField).toBeDefined()
      expect(richTextAreaField.label).toBe('RichTextArea description label')
      expect(richTextAreaField[constants.LENGTH]).toBe(32768)
      // Verify textarea
      const textAreaField = allFields.filter(field => field.name === 'Mike__c')[0]
      expect(textAreaField).toBeDefined()
      expect(textAreaField.label).toBe('TextArea description label')
      // Verify Encrypted Text
      const encryptedTextField = allFields.filter(field => field.name === 'November__c')[0]
      expect(encryptedTextField).toBeDefined()
      expect(encryptedTextField.label).toBe('EncryptedText description label')
      expect(encryptedTextField.mask).toBe('X')
      expect(encryptedTextField[constants.MASKTYPE]).toBe('creditCard')
      expect(encryptedTextField[constants.LENGTH]).toBe(35)
      // Verify textarea
      const urlField = allFields.filter(field => field.name === 'Oscar__c')[0]
      expect(urlField).toBeDefined()
      expect(urlField.label).toBe('Url description label')

      // Clean-up
      await sfAdapter.remove(post as ObjectType)
    })
  })
})
