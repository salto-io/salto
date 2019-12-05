import _ from 'lodash'
import {
  Type, ObjectType, ElemID, InstanceElement, Field, Value, Element, Values, BuiltinTypes,
  isInstanceElement,
} from 'adapter-api'
import { MetadataInfo, PicklistEntry, RetrieveResult } from 'jsforce'
import { collections } from '@salto/lowerdash'
import * as constants from '../src/constants'
import { ADMIN_PROFILE, PROFILE_METADATA_TYPE } from '../src/filters/field_permissions'
import { STANDARD_VALUE_SET } from '../src/filters/standard_value_sets'
import {
  CustomObject, ProfileFieldPermissionsInfo,
  FieldPermissions, CustomField, FilterItem,
} from '../src/client/types'
import {
  Types, sfCase, fromMetadataInfo, bpCase, metadataType, apiName,
} from '../src/transformers/transformer'
import realAdapter from './adapter'
import { findElements } from '../test/utils'
import { API_VERSION } from '../src/client/client'
import { fromRetrieveResult, toMetadataPackageZip } from '../src/transformers/xml_transformer'

const { makeArray } = collections.array
const { FIELD_LEVEL_SECURITY_ANNOTATION } = constants

const ADMIN = 'salesforce.profile.instance.admin'
const STANDARD = 'salesforce.profile.instance.standard'

describe('Salesforce adapter E2E with real account', () => {
  const { adapter, client } = realAdapter()

  // Set long timeout as we communicate with salesforce API
  jest.setTimeout(1000000)

  let result: Element[]

  const objectExists = async (type: string, name: string, fields?: string[],
    missingFields?: string[], label?: string): Promise<boolean> => {
    const readResult = (await client.readMetadata(type, name)
    )[0] as CustomObject
    if (!readResult || !readResult.fullName) {
      return false
    }
    if (label && label !== readResult.label) {
      return false
    }
    if (fields || missingFields) {
      const fieldNames = makeArray(readResult.fields).map(rf => rf.fullName)
      if (fields && !fields.every(f => fieldNames.includes(f))) {
        return false
      }
      return (!missingFields || missingFields.every(f => !fieldNames.includes(f)))
    }
    return true
  }

  const fetchedRollupSummaryFieldName = 'rollupsummary__c'

  beforeAll(async () => {
    const accountApiName = 'Account'
    if (!(await objectExists(constants.CUSTOM_OBJECT, accountApiName,
      [fetchedRollupSummaryFieldName]))) {
      await client.create(constants.CUSTOM_FIELD, {
        fullName: `${accountApiName}.${fetchedRollupSummaryFieldName}`,
        label: 'Test Fetch Rollup Summary Field',
        summarizedField: 'Opportunity.Amount',
        summaryFilterItems: {
          field: 'Opportunity.Amount',
          operation: 'greaterThan',
          value: '1',
        },
        summaryForeignKey: 'Opportunity.AccountId',
        summaryOperation: 'sum',
        type: 'Summary',
      } as MetadataInfo)
      await client.update(PROFILE_METADATA_TYPE, new ProfileInfo(sfCase(ADMIN_PROFILE), [{
        field: `${accountApiName}.${fetchedRollupSummaryFieldName}`,
        editable: true,
        readable: true,
      }]))
    }
    result = await adapter.fetch()
  })

  describe('should fetch account settings', () => {
    beforeEach(() => {
      expect(result).toBeDefined()
    })

    it('should fetch sobject', async () => {
      // Check few field types on lead object
      const lead = findElements(result, 'lead')[0] as ObjectType

      // Test few possible types
      expect(lead.fields.address.type.elemID).toEqual(Types.compoundDataTypes.address.elemID)
      expect(lead.fields.description.type.elemID).toEqual(
        Types.primitiveDataTypes.longtextarea.elemID,
      )
      expect(lead.fields.name.type.elemID).toEqual(Types.compoundDataTypes.name.elemID)
      expect(lead.fields.owner_id.type.elemID).toEqual(Types.primitiveDataTypes.lookup.elemID)

      // Test label
      expect(lead.fields.name.annotations[constants.LABEL]).toBe('Full Name')

      // Test true and false required
      expect(lead.fields.description.annotations[Type.REQUIRED]).toBe(false)
      expect(lead.fields.created_date.annotations[Type.REQUIRED]).toBe(false)

      // Test picklist restriction.enforce_value prop
      expect(lead.fields.industry.annotations[Type.RESTRICTION][Type.ENFORCE_VALUE]).toBe(
        false
      )
      expect(
        lead.fields.clean_status.annotations[Type.RESTRICTION][Type.ENFORCE_VALUE]
      ).toBe(true)


      // Test standard picklist values from a standard value set
      expect(lead.fields.lead_source.annotations[Type.VALUES]).toEqual(
        new ElemID(
          constants.SALESFORCE,
          bpCase(STANDARD_VALUE_SET),
          'instance',
          'lead_source',
        ).getFullName()
      )

      // Test picklist values
      expect(
        lead.fields.clean_status.annotations[Type.VALUES]
      ).toEqual([
        'Acknowledged',
        'Different',
        'Inactive',
        'Matched',
        'NotFound',
        'Pending',
        'SelectMatch',
        'Skipped',
      ])

      // Test lookup related_to annotation
      expect(lead.fields.owner_id.annotations.related_to).toEqual(['Group', 'User'])

      // Test lookup allow_lookup_record_deletion annotation
      expect(lead.fields.owner_id.annotations.allow_lookup_record_deletion).toBe(true)

      // Test _default
      // TODO: add test to primitive with _default and combobox _default (no real example for lead)
      expect(lead.fields.status.annotations[Type.DEFAULT]).toBe(
        'Open - Not Contacted'
      )

      // Test Rollup Summary
      const account = (findElements(result, 'account') as ObjectType[])
        .filter(a => a.fields[fetchedRollupSummaryFieldName])[0]
      expect(account).toBeDefined()
      const rollupSummary = account.fields[fetchedRollupSummaryFieldName]
      expect(rollupSummary.type.elemID).toEqual(Types.primitiveDataTypes.rollupsummary.elemID)
      expect(rollupSummary.annotations[constants.FIELD_ANNOTATIONS.SUMMARIZED_FIELD])
        .toEqual('Opportunity.Amount')
      expect(rollupSummary.annotations[constants.FIELD_ANNOTATIONS.SUMMARY_FOREIGN_KEY])
        .toEqual('Opportunity.AccountId')
      expect(rollupSummary.annotations[constants.FIELD_ANNOTATIONS.SUMMARY_OPERATION])
        .toEqual('sum')
      const filterItems = rollupSummary
        .annotations[constants.FIELD_ANNOTATIONS.SUMMARY_FILTER_ITEMS]
      expect(filterItems).toHaveLength(1)
      expect(filterItems[0][constants.FILTER_ITEM_FIELDS.FIELD]).toEqual('Opportunity.Amount')
      expect(filterItems[0][constants.FILTER_ITEM_FIELDS.OPERATION]).toEqual('greaterThan')
      expect(filterItems[0][constants.FILTER_ITEM_FIELDS.VALUE]).toEqual('1')
    })

    it('should fetch metadata type', () => {
      const flow = findElements(result, 'flow')[0] as ObjectType
      expect(flow.fields.description.type).toEqual(BuiltinTypes.STRING)
      expect(flow.fields.is_template.type).toEqual(BuiltinTypes.BOOLEAN)
      expect(flow.fields.action_calls.type).toEqual(findElements(result, 'flow_action_call')[0])
    })

    it('should fetch settings instance', () => {
      // As we fetch now only instances from the STANDALONE list,
      // settings is the only one with instance by default.
      // once we support adding instances test can be improved
      const quoteSettings = findElements(result, 'settings_quote')
        .filter(isInstanceElement)
        .pop() as InstanceElement

      expect(quoteSettings).toBeUndefined()
    })
  })

  describe('should perform CRUD operations', () => {
    const permissionExists = async (profile: string, fields: string[]): Promise<boolean[]> => {
      // The following const method is a workaround for a bug in SFDC metadata API that returns
      // the editable and readable fields in FieldPermissions as string instead of boolean
      const verifyBoolean = (variable: string | boolean): boolean => {
        const unknownVariable = variable as unknown
        return typeof unknownVariable === 'string' ? JSON.parse(unknownVariable) : variable
      }
      const profileInfo = (await client.readMetadata(PROFILE_METADATA_TYPE,
        profile))[0] as ProfileFieldPermissionsInfo
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

    const stringType = Types.primitiveDataTypes.text

    it('should add new profile instance', async () => {
      const instanceElementName = 'TestAddProfileInstance__c'
      const mockElemID = new ElemID(constants.SALESFORCE, 'test')

      const instance = new InstanceElement(instanceElementName, new ObjectType({
        elemID: mockElemID,
        fields: {
        },
        annotationTypes: {},
        annotations: {
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
        [constants.INSTANCE_FULL_NAME_FIELD]: instanceElementName,
      })

      if (await objectExists(PROFILE_METADATA_TYPE, sfCase(instance.elemID.name))) {
        await adapter.remove(instance)
      }

      const post = await adapter.add(instance) as InstanceElement

      // Test
      expect(post).toMatchObject(instance)

      expect(
        await objectExists(
          post.type.annotations[constants.METADATA_TYPE], sfCase(post.elemID.name)
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
        annotations: {
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
              [constants.DEFAULT_VALUE_FORMULA]: '"test"',
              [constants.LABEL]: 'description label',
              [FIELD_LEVEL_SECURITY_ANNOTATION]: {
                editable: [ADMIN, STANDARD],
                readable: [ADMIN, STANDARD],
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
        post.fields.description.annotations[constants.API_NAME]
      ).toBe('Description__c')
      expect(
        post.fields.formula.annotations[constants.API_NAME]
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
        annotations: {
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
        annotations: {
          [Type.REQUIRED]: false,
          [constants.DEFAULT_VALUE_FORMULA]: 'test',
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
                editable: [ADMIN, STANDARD],
                readable: [ADMIN, STANDARD],
              },
            },
          ),
        },
        annotations: {
          [Type.REQUIRED]: false,
          [constants.DEFAULT_VALUE_FORMULA]: 'test2',
          [constants.LABEL]: 'test2 label',
          [constants.API_NAME]: customObjectName,
        },
      })

      // Test
      const modificationResult = await adapter.update(oldElement, newElement,
        [
          { action: 'add', data: { after: newElement.fields.description } },
          { action: 'remove', data: { before: oldElement.fields.address } },
        ])

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
      const oldInstance = new InstanceElement(instanceElementName, new ObjectType({
        elemID: mockElemID,
        fields: {
        },
        annotationTypes: {},
        annotations: {
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
        [constants.INSTANCE_FULL_NAME_FIELD]: instanceElementName,

      })

      const newInstance = new InstanceElement(instanceElementName, new ObjectType({
        elemID: mockElemID,
        fields: {
        },
        annotationTypes: {},
        annotations: {
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
        [constants.INSTANCE_FULL_NAME_FIELD]: instanceElementName,

      })

      if (await objectExists(PROFILE_METADATA_TYPE, sfCase(oldInstance.elemID.name))) {
        await adapter.remove(oldInstance)
      }

      const post = await adapter.add(oldInstance) as InstanceElement
      const updateResult = await adapter.update(oldInstance, newInstance, [])

      // Test
      expect(updateResult).toBe(newInstance)

      // Checking that the saved instance identical to newInstance
      const savedInstance = (await client.readMetadata(
        PROFILE_METADATA_TYPE, sfCase(newInstance.elemID.name)
      ))[0] as Profile

      type Profile = ProfileFieldPermissionsInfo & {
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
        annotations: {
          [Type.REQUIRED]: false,
          [constants.DEFAULT_VALUE_FORMULA]: 'test',
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
        annotations: {
          [Type.REQUIRED]: false,
          [constants.DEFAULT_VALUE_FORMULA]: 'test2',
          [constants.LABEL]: 'test label 2',
          [constants.API_NAME]: customObjectName,
        },
      })

      // Test
      const modificationResult = await adapter.update(oldElement, newElement,
        [
          {
            action: 'modify',
            data: {
              before: oldElement.fields.banana,
              after: newElement.fields.banana,
            },
          },
          { action: 'modify', data: { before: oldElement, after: newElement } },
        ])
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
                editable: [ADMIN],
                readable: [ADMIN],
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
                editable: [STANDARD],
                readable: [STANDARD],
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
                editable: [ADMIN],
                readable: [ADMIN, STANDARD],
              },
            },
          ),
        },
        annotations: {
          [Type.REQUIRED]: false,
          [constants.DEFAULT_VALUE_FORMULA]: 'test',
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
                editable: [STANDARD],
                readable: [STANDARD],
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
                editable: [ADMIN, STANDARD],
                readable: [ADMIN, STANDARD],
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
                readable: [STANDARD],
              },
            },
          ),
        },
        annotations: {
          [Type.REQUIRED]: false,
          [constants.DEFAULT_VALUE_FORMULA]: 'test',
          [constants.LABEL]: 'test label',
          [constants.API_NAME]: customObjectName,
        },
      })

      // Test
      const modificationResult = await adapter.update(oldElement, newElement, [
        { action: 'modify',
          data: { before: oldElement.fields.address, after: newElement.fields.address } },
        { action: 'modify',
          data: { before: oldElement.fields.banana, after: newElement.fields.banana } },
        { action: 'modify',
          data: { before: oldElement.fields.delta, after: newElement.fields.delta } },
      ])
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
      const customObjectName = 'TestAddFields__c'
      const mockElemID = new ElemID(constants.SALESFORCE, 'test add object with various field types')
      const adminReadable = {
        [FIELD_LEVEL_SECURITY_ANNOTATION]: {
          editable: [],
          readable: [ADMIN],
        },
      }
      // we use random suffix for the reference field names since they cannot be created
      // more than once until they are permanently deleted (after 15 days)
      const randomString = String(Date.now()).substring(6)
      const picklistFieldApiName = 'Pickle__c'
      const element = new ObjectType({
        elemID: mockElemID,
        annotations: {
          [constants.API_NAME]: customObjectName,
          [constants.METADATA_TYPE]: constants.CUSTOM_OBJECT,
        },
        fields: {
          pickle: new Field(
            mockElemID,
            'pickle',
            Types.primitiveDataTypes.picklist,
            {
              [Type.REQUIRED]: false,
              [Type.DEFAULT]: 'NEW',
              [constants.LABEL]: 'Picklist description label',
              [Type.VALUES]: ['NEW', 'OLD'],
              ...adminReadable,
            },
          ),
          alpha: new Field(
            mockElemID,
            'alpha',
            Types.primitiveDataTypes.currency,
            {
              [Type.REQUIRED]: false,
              [constants.DEFAULT_VALUE_FORMULA]: 25,
              [constants.LABEL]: 'Currency description label',
              [constants.FIELD_ANNOTATIONS.SCALE]: 3,
              [constants.FIELD_ANNOTATIONS.PRECISION]: 18,
              ...adminReadable,
            },
          ),
          bravo: new Field(
            mockElemID,
            'bravo',
            Types.primitiveDataTypes.autonumber,
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
            Types.primitiveDataTypes.date,
            {
              [constants.LABEL]: 'Date description label',
              [constants.DEFAULT_VALUE_FORMULA]: 'Today() + 7',
              ...adminReadable,
            },
          ),
          delta: new Field(
            mockElemID,
            'delta',
            Types.primitiveDataTypes.time,
            {
              [constants.LABEL]: 'Time description label',
              [constants.DEFAULT_VALUE_FORMULA]: 'TIMENOW() + 5',
              ...adminReadable,
            },
          ),
          echo: new Field(
            mockElemID,
            'echo',
            Types.primitiveDataTypes.datetime,
            {
              [constants.LABEL]: 'DateTime description label',
              [constants.DEFAULT_VALUE_FORMULA]: 'Now() + 7',
              ...adminReadable,
            },
          ),
          foxtrot: new Field(
            mockElemID,
            'foxtrot',
            Types.primitiveDataTypes.email,
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
            Types.compoundDataTypes.location,
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
            Types.primitiveDataTypes.multipicklist,
            {
              [constants.LABEL]: 'Multipicklist description label',
              [Type.VALUES]: ['DO', 'RE'],
              [Type.DEFAULT]: 'DO',
              [constants.FIELD_ANNOTATIONS.VISIBLE_LINES]: 4,
              [constants.FIELD_ANNOTATIONS.FIELD_DEPENDENCY]: {
                [constants.FIELD_DEPENDENCY_FIELDS.CONTROLLING_FIELD]: picklistFieldApiName,
                [constants.FIELD_DEPENDENCY_FIELDS.VALUE_SETTINGS]: [
                  {
                    [constants.VALUE_SETTINGS_FIELDS.CONTROLLING_FIELD_VALUE]: ['NEW', 'OLD'],
                    [constants.VALUE_SETTINGS_FIELDS.VALUE_NAME]: 'DO',
                  },
                  {
                    [constants.VALUE_SETTINGS_FIELDS.CONTROLLING_FIELD_VALUE]: ['OLD'],
                    [constants.VALUE_SETTINGS_FIELDS.VALUE_NAME]: 'RE',
                  },
                ],
              },
              ...adminReadable,
            },
          ),
          india: new Field(
            mockElemID,
            'india',
            Types.primitiveDataTypes.percent,
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
            Types.primitiveDataTypes.phone,
            {
              [constants.LABEL]: 'Phone description label',
              ...adminReadable,
            },
          ),
          kilo: new Field(
            mockElemID,
            'kilo',
            Types.primitiveDataTypes.longtextarea,
            {
              [constants.LABEL]: 'LongTextArea description label',
              [constants.FIELD_ANNOTATIONS.VISIBLE_LINES]: 5,
              ...adminReadable,
            },
          ),
          lima: new Field(
            mockElemID,
            'lima',
            Types.primitiveDataTypes.richtextarea,
            {
              [constants.LABEL]: 'RichTextArea description label',
              [constants.FIELD_ANNOTATIONS.VISIBLE_LINES]: 27,
              ...adminReadable,
            },
          ),
          mike: new Field(
            mockElemID,
            'mike',
            Types.primitiveDataTypes.textarea,
            {
              [constants.LABEL]: 'TextArea description label',
              ...adminReadable,
            },
          ),
          november: new Field(
            mockElemID,
            'november',
            Types.primitiveDataTypes.encryptedtext,
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
            Types.primitiveDataTypes.url,
            {
              [constants.LABEL]: 'Url description label',
              ...adminReadable,
            },
          ),
          papa: new Field(
            mockElemID,
            'papa',
            Types.primitiveDataTypes.number,
            {
              [constants.FIELD_ANNOTATIONS.SCALE]: 3,
              [constants.FIELD_ANNOTATIONS.PRECISION]: 15,
              [constants.FIELD_ANNOTATIONS.UNIQUE]: true,
              [constants.DEFAULT_VALUE_FORMULA]: 42,
              [constants.LABEL]: 'Number description label',
              ...adminReadable,
            },
          ),
          queen: new Field(
            mockElemID,
            `queen${randomString}`,
            Types.primitiveDataTypes.lookup,
            {
              [Type.REQUIRED]: false,
              [constants.FIELD_ANNOTATIONS.ALLOW_LOOKUP_RECORD_DELETION]: false,
              [constants.FIELD_ANNOTATIONS.RELATED_TO]: ['Case'],
              [constants.LABEL]: 'Lookup description label',
              [constants.FIELD_ANNOTATIONS.LOOKUP_FILTER]: {
                [constants.LOOKUP_FILTER_FIELDS.ACTIVE]: true,
                [constants.LOOKUP_FILTER_FIELDS.BOOLEAN_FILTER]: '1 OR 2',
                [constants.LOOKUP_FILTER_FIELDS.ERROR_MESSAGE]: 'This is the Error message',
                [constants.LOOKUP_FILTER_FIELDS.INFO_MESSAGE]: 'This is the Info message',
                [constants.LOOKUP_FILTER_FIELDS.IS_OPTIONAL]: false,
                [constants.LOOKUP_FILTER_FIELDS.FILTER_ITEMS]: [{
                  [constants.FILTER_ITEM_FIELDS.FIELD]: 'Case.OwnerId',
                  [constants.FILTER_ITEM_FIELDS.OPERATION]: 'equals',
                  [constants.FILTER_ITEM_FIELDS.VALUE_FIELD]: '$User.Id',
                },
                {
                  [constants.FILTER_ITEM_FIELDS.FIELD]: 'Case.ParentId',
                  [constants.FILTER_ITEM_FIELDS.OPERATION]: 'equals',
                  [constants.FILTER_ITEM_FIELDS.VALUE]: 'ParentIdValue',
                }],
              },
              ...adminReadable,
            }
          ),
          rocket: new Field(
            mockElemID,
            `rocket${randomString}`,
            Types.primitiveDataTypes.masterdetail,
            {
              [Type.REQUIRED]: false,
              [constants.FIELD_ANNOTATIONS.RELATED_TO]: ['Case'],
              [constants.LABEL]: 'MasterDetail description label',
              [constants.FIELD_ANNOTATIONS.WRITE_REQUIRES_MASTER_READ]: true,
              [constants.FIELD_ANNOTATIONS.REPARENTABLE_MASTER_DETAIL]: true,
            }
          ),
        },
      })
      const rollupSummaryFieldName = 'susu'
      const rollupSummaryFieldApiName = `${rollupSummaryFieldName}__c`

      const findCustomCase = (): ObjectType => {
        const caseObjects = findElements(result, 'case') as ObjectType[]
        const customCase = caseObjects
          .filter(c => _.isUndefined(c.annotations[constants.API_NAME]))[0]
        const caseObject = customCase ?? caseObjects[0]
        // we add API_NAME annotation so the adapter will be able to construct the fields full name
        // upon update. in a real scenario, the case object is merged in the core and passed
        // to the adapter with the API_NAME annotation
        caseObject.annotations[constants.API_NAME] = 'Case'
        return caseObject
      }

      let origCase = findCustomCase()

      const removeRollupSummaryFieldFromCase = async (caseObj: ObjectType, fieldName: string):
        Promise<ObjectType> => {
        const caseAfterFieldRemoval = caseObj.clone()
        delete caseAfterFieldRemoval.fields[fieldName]
        await adapter.update(caseObj, caseAfterFieldRemoval,
          [{ action: 'remove',
            data: { before: caseObj.fields[fieldName] } }])
        return caseAfterFieldRemoval
      }

      if (await objectExists(constants.CUSTOM_OBJECT, 'Case', [rollupSummaryFieldApiName])) {
        origCase = await removeRollupSummaryFieldFromCase(origCase, rollupSummaryFieldApiName)
      }

      if (await objectExists(constants.CUSTOM_OBJECT, customObjectName)) {
        await adapter.remove(element)
      }
      const post = await adapter.add(element)

      // Test
      const objectFields = await client.describeSObjects([customObjectName])
      expect(objectFields[0]).toBeDefined()
      const allFields = objectFields[0].fields
      // Verify picklist
      const picklistField = allFields.filter(field => field.name === picklistFieldApiName)[0]
      expect(picklistField).toBeDefined()
      expect(picklistField.label).toBe('Picklist description label')
      expect(picklistField.type).toBe('picklist')
      expect(picklistField.dependentPicklist).toBeFalsy()
      expect(_.isEqual((picklistField.picklistValues as PicklistEntry[]).map(value => value.label), ['NEW', 'OLD'])).toBeTruthy()
      const picklistValueNew = (picklistField.picklistValues as PicklistEntry[]).filter(value => value.label === 'NEW')[0]
      expect(picklistValueNew).toBeDefined()
      expect(picklistValueNew.defaultValue).toEqual(true)
      const picklistValueOld = (picklistField.picklistValues as PicklistEntry[]).filter(value => value.label === 'OLD')[0]
      expect(picklistValueOld).toBeDefined()
      expect(picklistValueOld.defaultValue).toEqual(false)

      // Verify currency
      const currencyFieldApiName = 'Alpha__c'
      const currencyField = allFields.filter(field => field.name === currencyFieldApiName)[0]
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
      // TODO: As of this point we do not know how to retrieve the displayFormat annotation from
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
      expect(multipicklist.dependentPicklist).toBeTruthy()
      expect(_.isEqual((multipicklist.picklistValues as PicklistEntry[]).map(value => value.label), ['DO', 'RE'])).toBeTruthy()
      const multipicklistValueDo = (multipicklist.picklistValues as PicklistEntry[]).filter(value => value.label === 'DO')[0]
      expect(multipicklistValueDo).toBeDefined()
      expect(multipicklistValueDo.defaultValue).toEqual(true)
      const multipicklistValueRe = (multipicklist.picklistValues as PicklistEntry[]).filter(value => value.label === 'RE')[0]
      expect(multipicklistValueRe).toBeDefined()
      expect(multipicklistValueRe.defaultValue).toEqual(false)
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
      // TODO: We do not know how to retrieve the visible lines info when fetching
      // long text area
      const longTextAreaField = allFields.filter(field => field.name === 'Kilo__c')[0]
      expect(longTextAreaField).toBeDefined()
      expect(longTextAreaField.label).toBe('LongTextArea description label')
      expect(longTextAreaField.type).toBe('textarea')
      expect(longTextAreaField.length).toBe(32768)
      // Verify richtextarea
      // TODO: We do not know how to retrieve the visible lines info when fetching
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
      // Verify lookup
      const lookupField = allFields.filter(field => field.name === `Queen${randomString}__c`)[0]
      expect(lookupField).toBeDefined()
      expect(lookupField.label).toBe('Lookup description label')
      expect(lookupField.type).toBe('reference')
      expect(lookupField.relationshipName).toBe(`Queen${randomString}__r`)
      expect(lookupField.referenceTo).toEqual(['Case'])
      expect(_.get(lookupField, 'restrictedDelete')).toBe(true)
      expect(lookupField.filteredLookupInfo).toBeDefined()
      // Verify masterdetail
      const masterDetailApiName = `Rocket${randomString}__c`
      const masterDetailField = allFields.filter(field => field.name === masterDetailApiName)[0]
      expect(masterDetailField).toBeDefined()
      expect(masterDetailField.label).toBe('MasterDetail description label')
      expect(masterDetailField.type).toBe('reference')
      expect(masterDetailField.relationshipName).toBe(`Rocket${randomString}__r`)
      expect(masterDetailField.referenceTo).toEqual(['Case'])
      expect(masterDetailField.cascadeDelete).toBe(true)
      expect(masterDetailField.writeRequiresMasterRead).toBe(true)
      expect(masterDetailField.updateable).toBe(true)

      const verifyRollupSummaryFieldAddition = async (): Promise<void> => {
        const addRollupSummaryField = async (): Promise<ObjectType> => {
          const caseAfterFieldAddition = origCase.clone()
          caseAfterFieldAddition.fields[rollupSummaryFieldName] = new Field(
            caseAfterFieldAddition.elemID,
            rollupSummaryFieldName,
            Types.primitiveDataTypes.rollupsummary,
            {
              [Type.REQUIRED]: false,
              [constants.LABEL]: 'Rollup Summary description label',
              [constants.API_NAME]: rollupSummaryFieldApiName,
              [constants.FIELD_ANNOTATIONS.SUMMARIZED_FIELD]: `${customObjectName}.${currencyFieldApiName}`,
              [constants.FIELD_ANNOTATIONS.SUMMARY_FOREIGN_KEY]: `${customObjectName}.${masterDetailApiName}`,
              [constants.FIELD_ANNOTATIONS.SUMMARY_OPERATION]: 'max',
              [constants.FIELD_ANNOTATIONS.SUMMARY_FILTER_ITEMS]: [
                {
                  [constants.FILTER_ITEM_FIELDS.FIELD]: `${customObjectName}.${currencyFieldApiName}`,
                  [constants.FILTER_ITEM_FIELDS.OPERATION]: 'greaterThan',
                  [constants.FILTER_ITEM_FIELDS.VALUE]: '1',
                },
              ],
            }
          )
          await adapter.update(origCase, caseAfterFieldAddition,
            [{ action: 'add',
              data: { after: caseAfterFieldAddition.fields[rollupSummaryFieldName] } }])
          return caseAfterFieldAddition
        }

        const verifyRollupSummaryField = async (): Promise<void> => {
          const fetchedRollupSummary = (await client.readMetadata(constants.CUSTOM_FIELD,
            `Case.${rollupSummaryFieldApiName}`))[0] as CustomField
          expect(_.get(fetchedRollupSummary, 'summarizedField'))
            .toEqual(`${customObjectName}.${currencyFieldApiName}`)
          expect(_.get(fetchedRollupSummary, 'summaryForeignKey'))
            .toEqual(`${customObjectName}.${masterDetailApiName}`)
          expect(_.get(fetchedRollupSummary, 'summaryOperation')).toEqual('max')
          expect(fetchedRollupSummary.summaryFilterItems).toBeDefined()
          const filterItems = fetchedRollupSummary.summaryFilterItems as FilterItem
          expect(filterItems.field).toEqual(`${customObjectName}.${currencyFieldApiName}`)
          expect(filterItems.operation).toEqual('greaterThan')
          expect(filterItems.value).toEqual('1')
        }

        const caseAfterFieldAddition = await addRollupSummaryField()
        await verifyRollupSummaryField()
        await removeRollupSummaryFieldFromCase(caseAfterFieldAddition, rollupSummaryFieldName)
      }

      await verifyRollupSummaryFieldAddition()
      // Clean-up
      await adapter.remove(post as ObjectType)
    })

    it('should add lookupFilter to an existing lookup field', async () => {
      const customObjectName = 'TestAddLookupFilter__c'
      const mockElemID = new ElemID(constants.SALESFORCE, 'test add lookupFilter')
      const randomString = String(Date.now()).substring(6)
      const lookupFieldName = `lookup${randomString}`
      const lookupFieldApiName = `${_.camelCase(lookupFieldName)}__c`
      const oldElement = new ObjectType({
        elemID: mockElemID,
        fields: {},
        annotations: {
          [Type.REQUIRED]: false,
          [constants.LABEL]: 'test label',
          [constants.API_NAME]: customObjectName,
          [constants.METADATA_TYPE]: constants.CUSTOM_OBJECT,
        },
      })

      oldElement.fields[lookupFieldName] = new Field(
        mockElemID,
        lookupFieldName,
        Types.primitiveDataTypes.lookup,
        {
          [constants.API_NAME]: lookupFieldApiName,
          [constants.FIELD_ANNOTATIONS.RELATED_TO]: ['Case'],
          [FIELD_LEVEL_SECURITY_ANNOTATION]: {
            editable: [ADMIN],
            readable: [ADMIN],
          },
        },
      )
      if (await objectExists(constants.CUSTOM_OBJECT, customObjectName)) {
        await adapter.remove(oldElement)
      }
      const addResult = await adapter.add(oldElement)
      // Verify setup was performed properly
      expect(addResult).toBeInstanceOf(ObjectType)
      expect(await objectExists(constants.CUSTOM_OBJECT, customObjectName, [lookupFieldApiName]))
        .toBe(true)

      const newElement = new ObjectType({
        elemID: mockElemID,
        annotations: {
          [Type.REQUIRED]: false,
          [constants.LABEL]: 'test label',
          [constants.API_NAME]: customObjectName,
          [constants.METADATA_TYPE]: constants.CUSTOM_OBJECT,
        },
      })

      newElement.fields[lookupFieldName] = new Field(
        mockElemID,
        lookupFieldName,
        Types.primitiveDataTypes.lookup,
        {
          [constants.API_NAME]: lookupFieldApiName,
          [constants.FIELD_ANNOTATIONS.RELATED_TO]: ['Case'],
          [constants.FIELD_ANNOTATIONS.LOOKUP_FILTER]: {
            [constants.LOOKUP_FILTER_FIELDS.ACTIVE]: true,
            [constants.LOOKUP_FILTER_FIELDS.INFO_MESSAGE]: 'Info message',
            [constants.LOOKUP_FILTER_FIELDS.IS_OPTIONAL]: true,
            [constants.LOOKUP_FILTER_FIELDS.FILTER_ITEMS]: [
              { [constants.FILTER_ITEM_FIELDS.FIELD]: 'Case.OwnerId',
                [constants.FILTER_ITEM_FIELDS.OPERATION]: 'equals',
                [constants.FILTER_ITEM_FIELDS.VALUE_FIELD]: '$User.Id' },
            ],
          },
          [FIELD_LEVEL_SECURITY_ANNOTATION]: {
            editable: [ADMIN],
            readable: [ADMIN],
          },
        },
      )

      // Test
      const modificationResult = await adapter.update(oldElement, newElement,
        [{ action: 'modify',
          data: { before: oldElement.fields[lookupFieldName],
            after: newElement.fields[lookupFieldName] } }])
      expect(modificationResult).toBeInstanceOf(ObjectType)

      // Verify the lookup filter was created
      const customObject = await client.describeSObjects([customObjectName])
      expect(customObject[0]).toBeDefined()
      const lookupField = customObject[0].fields
        .filter(field => field.name === lookupFieldApiName)[0]
      expect(lookupField).toBeDefined()
      expect(lookupField.filteredLookupInfo).toBeDefined()

      // Clean-up
      await adapter.remove(oldElement)
    })
    // Assignment rules are special because they use the Deploy API so they get their own test
    describe('assignment rules manipulation', () => {
      const getRulesFromClient = async (): Promise<Values> => fromMetadataInfo(
        (await client.readMetadata('AssignmentRules', 'Lead'))[0]
      )

      const dummyAssignmentRulesType = new ObjectType({
        elemID: new ElemID(constants.SALESFORCE, 'assignment_rules'),
        annotations: {
          [constants.METADATA_TYPE]: 'AssignmentRules',
        },
      })

      let before: InstanceElement
      let after: InstanceElement
      let validAssignment: Values

      beforeAll(async () => {
        // Make sure our test rule does not exist before we start
        await client.delete('AssignmentRule', 'Lead.NonStandard').catch(() => undefined)

        before = new InstanceElement(
          'lead_assignment_rules',
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
          before.elemID.name,
          before.type,
          _.cloneDeep(before.value),
        )
      })

      afterEach(async () => {
        await adapter.update(after, before, [])
      })

      it('should create rule', async () => {
        // eslint-disable-next-line @typescript-eslint/camelcase
        after.value.assignment_rule = _.flatten([
          after.value.assignment_rule,
          {
            [constants.INSTANCE_FULL_NAME_FIELD]: 'NonStandard',
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

        await adapter.update(before, after, [])

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

        await adapter.update(before, after, [])

        const updatedRules = await getRulesFromClient()
        expect(updatedRules).toEqual(after.value)
      })
    })

    describe('deploy retrieve manipulations', () => {
      const retrieve = async (type: string): Promise<RetrieveResult> => {
        const retrieveRequest = {
          apiVersion: API_VERSION,
          singlePackage: false,
          unpackaged: [{ types: { name: type, members: '*' } }],
        }
        return client.retrieve(retrieveRequest)
      }

      const findInstance = async (instance: InstanceElement): Promise<MetadataInfo | undefined> => {
        const type = metadataType(instance)
        const retrieveResult = await retrieve(type)
        const instanceInfos = (await fromRetrieveResult(retrieveResult, [type]))[type]
        return instanceInfos.find(info => info.fullName === apiName(instance))
      }

      const removeIfAlreadyExists = async (instance: InstanceElement): Promise<void> => {
        if (await findInstance(instance)) {
          await client.deploy(await toMetadataPackageZip(apiName(instance),
            metadataType(instance), instance.value, true) as Buffer)
        }
      }

      const verifyCreateInstance = async (instance: InstanceElement): Promise<void> => {
        await adapter.add(instance)
        const instanceInfo = await findInstance(instance)
        expect(instanceInfo).toBeDefined()
        expect(_.get(instanceInfo, 'content').includes('Created')).toBeTruthy()
      }

      const verifyUpdateInstance = async (instance: InstanceElement): Promise<void> => {
        const after = instance.clone()
        after.value.content = after.value.content.replace('Created', 'Updated')
        await adapter.update(instance, after, [])
        const instanceInfo = await findInstance(instance)
        expect(instanceInfo).toBeDefined()
        expect(_.get(instanceInfo, 'content').includes('Updated')).toBeTruthy()
      }

      const verifyRemoveInstance = async (instance: InstanceElement): Promise<void> => {
        await adapter.remove(instance)
        const instanceInfo = await findInstance(instance)
        expect(instanceInfo).toBeUndefined()
      }

      const createInstanceElement = (fullName: string, typeName: string, content: string):
        InstanceElement => {
        const objectType = new ObjectType({
          elemID: new ElemID(constants.SALESFORCE, _.snakeCase(typeName)),
          annotations: {
            [constants.METADATA_TYPE]: typeName,
          },
        })
        return new InstanceElement(
          _.snakeCase(fullName),
          objectType,
          {
            [constants.INSTANCE_FULL_NAME_FIELD]: fullName,
            // eslint-disable-next-line @typescript-eslint/camelcase
            api_version: API_VERSION,
            content,
          }
        )
      }

      describe('apex class manipulation', () => {
        const apexClassInstance = createInstanceElement('MyApexClass', 'ApexClass',
          'public class MyApexClass {\n    public void printLog() {\n        System.debug(\'Created\');\n    }\n}')

        beforeAll(async () => {
          await removeIfAlreadyExists(apexClassInstance)
        })

        describe('create apex class instance', () => {
          it('should create apex class instance', async () => {
            await verifyCreateInstance(apexClassInstance)
          })
        })

        describe('update apex class instance', () => {
          it('should update apex class instance', async () => {
            await verifyUpdateInstance(apexClassInstance)
          })
        })

        describe('remove apex class instance', () => {
          it('should remove apex class instance', async () => {
            await verifyRemoveInstance(apexClassInstance)
          })
        })
      })

      describe('apex trigger manipulation', () => {
        const apexTriggerInstance = createInstanceElement('MyApexTrigger', 'ApexTrigger',
          'trigger MyApexTrigger on Account (before insert) {\n    System.debug(\'Created\');\n}')

        beforeAll(async () => {
          await removeIfAlreadyExists(apexTriggerInstance)
        })

        describe('create apex trigger instance', () => {
          it('should create apex trigger instance', async () => {
            await verifyCreateInstance(apexTriggerInstance)
          })
        })

        describe('update apex trigger instance', () => {
          it('should update apex trigger instance', async () => {
            await verifyUpdateInstance(apexTriggerInstance)
          })
        })

        describe('remove apex trigger instance', () => {
          it('should remove apex trigger instance', async () => {
            await verifyRemoveInstance(apexTriggerInstance)
          })
        })
      })

      describe('apex page manipulation', () => {
        const apexPageInstance = createInstanceElement('MyApexPage', 'ApexPage',
          '<apex:page >Created by e2e test!</apex:page>')
        apexPageInstance.value.label = 'MyApexPage'

        beforeAll(async () => {
          await removeIfAlreadyExists(apexPageInstance)
        })

        describe('create apex page instance', () => {
          it('should create apex page instance', async () => {
            await verifyCreateInstance(apexPageInstance)
          })
        })

        describe('update apex page instance', () => {
          it('should update apex page instance', async () => {
            await verifyUpdateInstance(apexPageInstance)
          })
        })

        describe('remove apex page instance', () => {
          it('should remove apex page instance', async () => {
            await verifyRemoveInstance(apexPageInstance)
          })
        })
      })

      describe('apex component manipulation', () => {
        const apexComponentInstance = createInstanceElement('MyApexComponent', 'ApexComponent',
          '<apex:component >Created by e2e test!</apex:component>')
        apexComponentInstance.value.label = 'MyApexComponent'

        beforeAll(async () => {
          await removeIfAlreadyExists(apexComponentInstance)
        })

        describe('create apex component instance', () => {
          it('should create apex component instance', async () => {
            await verifyCreateInstance(apexComponentInstance)
          })
        })

        describe('update apex component instance', () => {
          it('should update apex component instance', async () => {
            await verifyUpdateInstance(apexComponentInstance)
          })
        })

        describe('remove apex component instance', () => {
          it('should remove apex component instance', async () => {
            await verifyRemoveInstance(apexComponentInstance)
          })
        })
      })
    })
  })
})
