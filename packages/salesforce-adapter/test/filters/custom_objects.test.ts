import _ from 'lodash'
import { ElemID, ObjectType, ServiceIds, Type, BuiltinTypes, Element, InstanceElement, isObjectType } from 'adapter-api'
import SalesforceClient from '../../src/client/client'
import Connection from '../../src/client/jsforce'
import * as constants from '../../src/constants'
import { } from '../../src/filters/settings_type'
import mockAdapter from '../adapter'
import { findElements } from '../utils'
import filterCreator from '../../src/filters/custom_objects'
import { FilterWith } from '../../src/filter'

describe('Custom Objects filter', () => {
  let connection: Connection
  let client: SalesforceClient

  const mockGetElemIdFunc = (adapterName: string, _serviceIds: ServiceIds, name: string):
    ElemID => new ElemID(adapterName, name)

  type FilterType = FilterWith<'onFetch'>
  const filter = (): FilterType => filterCreator({ client }) as FilterType

  beforeEach(() => {
    ({ connection, client } = mockAdapter({
      adapterParams: {
        getElemIdFunc: mockGetElemIdFunc,
      },
    }))
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('should fetch SObjects', () => {
    const mockSingleSObject = (
      name: string,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fields: Record<string, any>[],
      isMetadataType = false,
      isInCustomObjectList = true,
      custom = false,
      label = name,
    ): void => {
      connection.describeGlobal = jest.fn()
        .mockImplementation(async () => ({ sobjects: [{ name }] }))

      connection.soap.describeSObjects = jest.fn()
        .mockImplementation(async () => [{ name, label, custom, fields }])

      connection.metadata.describe = jest.fn()
        .mockImplementation(async () => ({
          metadataObjects: [
            constants.CUSTOM_OBJECT, ...(isMetadataType ? [name] : []),
          ].map(xmlName => ({ xmlName })),
        }))

      connection.metadata.describeValueType = jest.fn()
        .mockImplementation(async () => ({ valueTypeFields: [] }))

      connection.metadata.list = jest.fn()
        .mockImplementation(async ({ type }) => (
          (type === constants.CUSTOM_OBJECT && isInCustomObjectList) ? [{ fullName: name }] : []
        ))
    }

    it('should fetch sobject with primitive types, validate type, label, required and default annotations', async () => {
      mockSingleSObject('Lead', [
        {
          name: 'LastName',
          type: 'text',
          label: 'Last Name',
          nillable: false,
          defaultValue: {
            $: { 'xsi:type': 'xsd:string' },
            _: 'BLABLA',
          },
        },
        {
          name: 'FirstName',
          type: 'text',
          label: 'First Name',
          nillable: true,
        },
        {
          name: 'IsDeleted',
          type: 'boolean',
          label: 'Is Deleted',
          // Default values don't look like this in the API but we support it so we must test it
          defaultValue: false,
        },
        {
          name: 'Custom__c',
          type: 'boolean',
          label: 'Custom Field',
          nillable: true,
          defaultValue: {
            $: { 'xsi:type': 'xsd:boolean' },
            _: 'false',
          },
        },
        {
          name: 'Formula__c',
          type: 'text',
          label: 'Dummy formula',
          calculated: true,
          calculatedFormula: 'my formula',
        },
      ])
      const result: Element[] = []
      await filter().onFetch(result)

      const lead = findElements(result, 'lead').pop() as ObjectType
      expect(lead.fields.last_name.type.elemID.name).toBe('text')
      expect(lead.fields.last_name.annotations.label).toBe('Last Name')
      // Test Required true and false
      expect(lead.fields.last_name.annotations[Type.ANNOTATIONS.REQUIRED]).toBe(true)
      expect(lead.fields.first_name.annotations[Type.ANNOTATIONS.REQUIRED]).toBe(false)
      // Default string and boolean
      expect(lead.fields.last_name.annotations[Type.ANNOTATIONS.DEFAULT]).toBe('BLABLA')
      expect(lead.fields.is_deleted.annotations[Type.ANNOTATIONS.DEFAULT]).toBe(false)
      // Custom type
      expect(lead.fields.custom__c).not.toBeUndefined()
      expect(lead.fields.custom__c.annotations[constants.API_NAME]).toBe('Custom__c')
      expect(lead.fields.custom__c.annotations[Type.ANNOTATIONS.DEFAULT]).toBe(false)
      // Formula field
      expect(lead.fields.formula__c).toBeDefined()
      expect(lead.fields.formula__c.type.elemID.name).toBe('formula_text')
      expect(lead.fields.formula__c.annotations[constants.FORMULA]).toBe('my formula')
    })

    it('should fetch sobject with picklist field', async () => {
      mockSingleSObject('Lead', [
        {
          name: 'PrimaryC',
          type: 'picklist',
          label: 'Primary',
          nillable: false,
          picklistValues: [
            { value: 'No', defaultValue: false },
            { value: 'Yes', defaultValue: true },
          ],
          restrictedPicklist: true,
        },
      ])
      const result: Element[] = []
      await filter().onFetch(result)

      const lead = findElements(result, 'lead').pop() as ObjectType
      expect(lead.fields.primary_c.type.elemID.name).toBe('picklist')
      expect((lead.fields.primary_c.annotations[Type.ANNOTATIONS.VALUES] as string[]).join(';')).toBe('No;Yes')
      expect(lead.fields.primary_c.annotations[Type.ANNOTATIONS.DEFAULT]).toBe('Yes')
      expect(lead.fields.primary_c
        .annotations[Type.ANNOTATIONS.RESTRICTION][Type.ANNOTATIONS.ENFORCE_VALUE]).toBe(true)
    })

    it('should fetch sobject with combobox field', async () => {
      mockSingleSObject('Lead', [
        {
          name: 'PrimaryC',
          type: 'combobox',
          label: 'Primary',
          nillable: false,
          picklistValues: [
            { value: 'No', defaultValue: false },
            { value: 'Yes', defaultValue: true },
          ],
        },
      ])
      const result: Element[] = []
      await filter().onFetch(result)

      const lead = findElements(result, 'lead').pop() as ObjectType
      expect(lead.fields.primary_c.type.elemID.name).toBe('combobox')
      expect((lead.fields.primary_c.annotations[Type.ANNOTATIONS.VALUES] as string[]).join(';'))
        .toBe('No;Yes')
      expect(lead.fields.primary_c.annotations[Type.ANNOTATIONS.DEFAULT].length).toBe(1)
      expect(lead.fields.primary_c.annotations[Type.ANNOTATIONS.DEFAULT].pop()).toBe('Yes')
    })

    it('should fetch sobject with number field', async () => {
      mockSingleSObject('Lead', [
        {
          name: 'NumberField',
          type: 'number',
          label: 'Numero',
          nillable: true,
        },
      ])
      const result: Element[] = []
      await filter().onFetch(result)

      const lead = findElements(result, 'lead').pop() as ObjectType
      expect(lead.fields.number_field.type.elemID.name).toBe('number')
    })

    it('should fetch sobject with api_name and metadata_type service ids', async () => {
      mockSingleSObject('Lead', [])
      const result: Element[] = []
      await filter().onFetch(result)

      const lead = result.filter(o => o.elemID.name === 'lead').pop() as ObjectType
      expect(lead.annotationTypes[constants.API_NAME]).toEqual(BuiltinTypes.SERVICE_ID)
      expect(lead.annotationTypes[constants.METADATA_TYPE]).toEqual(BuiltinTypes.SERVICE_ID)
      expect(lead.annotations[constants.API_NAME]).toEqual('Lead')
      expect(lead.annotations[constants.METADATA_TYPE]).toEqual(constants.CUSTOM_OBJECT)
    })

    it('should fetch sobject with label', async () => {
      mockSingleSObject('Lead', [], false, true, false, 'Lead Label')
      const result: Element[] = []
      await filter().onFetch(result)

      const lead = result.filter(o => o.elemID.name === 'lead').pop() as ObjectType
      expect(lead.annotations[constants.LABEL]).toEqual('Lead Label')
    })

    it('should use existing elemID when fetching custom object', async () => {
      ({ connection, client } = mockAdapter({
        adapterParams: {
          getElemIdFunc: (adapterName: string, _serviceIds: ServiceIds, name: string):
            ElemID => new ElemID(adapterName, name.endsWith(constants.SALESFORCE_CUSTOM_SUFFIX)
            ? name.slice(0, -3) : name),
        },
      }))
      mockSingleSObject('Custom__c', [
        {
          name: 'StringField__c',
          type: 'string',
          label: 'Stringo',
        },
      ])

      const result: Element[] = []
      const newFilter = (): FilterType => filterCreator({ client }) as FilterType
      await newFilter().onFetch(result)

      const custom = result.filter(o => o.elemID.name === 'custom').pop() as ObjectType
      expect(custom.fields.string_field.annotations[constants.API_NAME]).toEqual('StringField__c')
    })

    it('should fetch sobject with various field types', async () => {
      mockSingleSObject('Lead', [
        {
          name: 'MyAutoNumber',
          type: 'string',
          label: 'AutoNumero',
          autoNumber: true,
        },
        {
          name: 'String',
          type: 'string',
          label: 'Stringo',
        },
        {
          name: 'Number',
          type: 'double',
          label: 'Numero',
        },
        {
          name: 'MyTextArea',
          type: 'textarea',
          label: 'Texto Areato',
          length: 255,
        },
        {
          name: 'MyLongTextArea',
          type: 'textarea',
          label: 'Longo Texto Areato',
          length: 280,
          extraTypeInfo: 'plaintextarea',
        },
        {
          name: 'MyRichTextArea',
          type: 'textarea',
          label: 'Richo Texto Areato',
          length: 280,
          extraTypeInfo: 'richtextarea',
        },
        {
          name: 'MyEncryptedString',
          type: 'encryptedstring',
          label: 'Encrypto Stringo',
        },
        {
          name: 'MyMultiPickList',
          type: 'multipicklist',
          label: 'Multo Picklisto',
          precision: 5,
          picklistValues: [
            { value: 'No', defaultValue: false },
            { value: 'Yes', defaultValue: true },
          ],
        },
      ])
      const result: Element[] = []
      await filter().onFetch(result)

      const lead = findElements(result, 'lead').pop() as ObjectType
      expect(lead.fields.my_auto_number.type.elemID.name).toBe('autonumber')
      expect(lead.fields.string.type.elemID.name).toBe('text')
      expect(lead.fields.number.type.elemID.name).toBe('number')
      expect(lead.fields.my_text_area.type.elemID.name).toBe('textarea')
      expect(lead.fields.my_long_text_area.type.elemID.name).toBe('longtextarea')
      expect(lead.fields.my_rich_text_area.type.elemID.name).toBe('richtextarea')
      expect(lead.fields.my_encrypted_string.type.elemID.name).toBe('encryptedtext')
      expect(lead.fields.my_multi_pick_list.type.elemID.name).toBe('multipicklist')
      expect(lead.fields.my_multi_pick_list
        .annotations[constants.FIELD_ANNOTATIONS.VISIBLE_LINES]).toBe(5)
    })

    it('should split customizations to different elements', async () => {
      mockSingleSObject('Test', [
        {
          name: 'dummy', label: 'dummy', type: 'string',
        },
        {
          name: 'CustomField__c', label: 'custom field', type: 'string', custom: true,
        },
      ])

      const result: Element[] = []
      await filter().onFetch(result)

      const testElements = findElements(result, 'test') as ObjectType[]
      expect(testElements).toHaveLength(2)
      const [test, testCustomizations] = testElements
      expect(test.path).toEqual(['objects', 'standard', 'test'])
      expect(test.fields.dummy).toBeDefined()
      expect(test.fields.custom_field__c).toBeUndefined()
      expect(testCustomizations.path).toEqual(['objects', 'custom', 'test'])
      expect(testCustomizations.fields.dummy).toBeUndefined()
      expect(testCustomizations.fields.custom_field__c).toBeDefined()
    })

    it('should filter (inner) SObjects that are not custom objects', async () => {
      mockSingleSObject('Test', [
        {
          name: 'dummy', label: 'dummy', type: 'string',
        },
        {
          name: 'CustomField__c', label: 'custom field', type: 'string', custom: true,
        },
      ], false, false)

      const result: Element[] = []
      await filter().onFetch(result)

      const testElements = findElements(result, 'test') as ObjectType[]
      expect(testElements).toHaveLength(0)
    })

    it('should not split custom SObjects', async () => {
      mockSingleSObject('Test__c', [
        {
          name: 'dummy', label: 'dummy', type: 'string',
        },
        {
          name: 'CustomField__c', label: 'custom field', type: 'string', custom: true,
        },
      ], false, true, true)

      const result: Element[] = []
      await filter().onFetch(result)

      const testElements = findElements(result, 'test__c') as ObjectType[]
      // custom objects should not be split
      expect(testElements).toHaveLength(1)
      const [test] = testElements
      expect(test.path).toEqual(['objects', 'custom', 'test__c'])
      expect(test.fields.dummy).toBeDefined()
      expect(test.fields.custom_field__c).toBeDefined()
    })

    it('should fetch packaged custom SObjects', async () => {
      const namespaceName = 'namespaceName'
      mockSingleSObject(`${namespaceName}${constants.NAMESPACE_SEPARATOR}Test__c`, [
        {
          name: 'dummy', label: 'dummy', type: 'string',
        },
        {
          name: 'CustomField__c', label: 'custom field', type: 'string', custom: true,
        },
      ], false, true, true)

      const result: Element[] = []
      await filter().onFetch(result)

      const testElements = findElements(result, 'namespace_name___test__c') as ObjectType[]
      // custom objects should not be split
      expect(testElements).toHaveLength(1)
      const [test] = testElements
      expect(test.path)
        .toEqual(['installed_packages', namespaceName, 'objects', 'namespace_name___test__c'])
      expect(test.fields.dummy).toBeDefined()
      expect(test.fields.custom_field__c).toBeDefined()
    })

    it('should fetch standard sobject with packaged custom field', async () => {
      const namespaceName = 'namespaceName'
      mockSingleSObject('Test__c', [
        {
          name: 'dummy', label: 'dummy', type: 'string',
        },
        {
          name: `${namespaceName}${constants.NAMESPACE_SEPARATOR}PackagedField__c`, label: 'custom field', type: 'string', custom: true,
        },
      ], false, true, false)

      const result: Element[] = []
      await filter().onFetch(result)

      const testElements = findElements(result, 'test__c') as ObjectType[]
      // custom objects should not be split
      expect(testElements).toHaveLength(2)
      const [[obj], [packagedObj]] = _.partition(testElements, elem => elem.fields.dummy)
      expect(obj.path).toEqual(['objects', 'standard', 'test__c'])
      expect(obj.fields.dummy).toBeDefined()
      expect(obj.fields.namespace_name___packaged_field__c).toBeUndefined()
      expect(packagedObj.path).toEqual(['installed_packages', namespaceName, 'objects', 'test__c'])
      expect(packagedObj.fields.dummy).toBeUndefined()
      expect(packagedObj.fields.namespace_name___packaged_field__c).toBeDefined()
    })

    it('should fetch standard sobject with packaged and not packaged custom field', async () => {
      const namespaceName = 'namespaceName'
      mockSingleSObject('Test__c', [
        {
          name: 'dummy', label: 'dummy', type: 'string',
        },
        {
          name: 'CustomField__c', label: 'custom field', type: 'string', custom: true,
        },
        {
          name: `${namespaceName}${constants.NAMESPACE_SEPARATOR}PackagedField__c`, label: 'custom field', type: 'string', custom: true,
        },
      ], false, true, false)

      const result: Element[] = []
      await filter().onFetch(result)

      const testElements = findElements(result, 'test__c') as ObjectType[]
      // custom objects should not be split
      expect(testElements).toHaveLength(3)
      const [[packagedObj], objs] = _.partition(testElements,
        elem => elem.fields.namespace_name___packaged_field__c)
      const [[obj], [customObj]] = _.partition(objs, elem => elem.fields.dummy)

      expect(obj.path).toEqual(['objects', 'standard', 'test__c'])
      expect(obj.fields.dummy).toBeDefined()
      expect(obj.fields.custom_field__c).toBeUndefined()
      expect(obj.fields.namespace_name___packaged_field__c).toBeUndefined()
      expect(customObj.path).toEqual(['objects', 'custom', 'test__c'])
      expect(customObj.fields.dummy).toBeUndefined()
      expect(customObj.fields.custom_field__c).toBeDefined()
      expect(customObj.fields.namespace_name___packaged_field__c).toBeUndefined()
      expect(packagedObj.path).toEqual(['installed_packages', namespaceName, 'objects', 'test__c'])
      expect(packagedObj.fields.dummy).toBeUndefined()
      expect(packagedObj.fields.custom_field__c).toBeUndefined()
      expect(packagedObj.fields.namespace_name___packaged_field__c).toBeDefined()
    })

    it('should not fetch SObjects that conflict with metadata types', async () => {
      mockSingleSObject('Flow', [
        { name: 'dummy', label: 'dummy', type: 'string' },
      ], true)

      // result of fetch (before filters) includes the metadata type
      const flowElemID = mockGetElemIdFunc(constants.SALESFORCE, {}, 'flow')
      const flowMetadataType = new ObjectType({ elemID: flowElemID,
        annotations: { [constants.METADATA_TYPE]: 'Flow' },
        annotationTypes: { [constants.METADATA_TYPE]: BuiltinTypes.SERVICE_ID } })
      flowMetadataType.path = ['types', 'flow']
      const result: Element[] = [flowMetadataType]

      await filter().onFetch(result)

      const flow = findElements(result, 'flow').pop() as ObjectType
      expect(flow).toBeDefined() // We do expect to get the metadata type here
      expect(Object.keys(flow.fields)).toHaveLength(0)
      expect(flow.path).toEqual(['types', 'flow'])
    })
    describe('Merge elements', () => {
      const testInstanceElement = new InstanceElement('lead', new ObjectType(
        { elemID: mockGetElemIdFunc(constants.SALESFORCE, {}, constants.CUSTOM_OBJECT) }
      ),
      { fields: [{ [constants.INSTANCE_FULL_NAME_FIELD]: 'MyAutoNumber',
        [constants.INSTANCE_TYPE_FIELD]: 'AutoNumber',
        [constants.FIELD_ANNOTATIONS.DISPLAY_FORMAT]: 'A-{0000}',
        [constants.INSTANCE_REQUIRED_FIELD]: 'false' },
      { [constants.INSTANCE_FULL_NAME_FIELD]: 'MyPicklist',
        [constants.INSTANCE_TYPE_FIELD]: 'Picklist',
        [constants.INSTANCE_REQUIRED_FIELD]: 'true',
        [constants.INSTANCE_DEFAULT_VALUE_FIELD]: 'YES',
        [constants.INSTANCE_VALUE_SET_FIELD]: { [constants.VALUE_SET_FIELDS.VALUE_SET_DEFINITION]:
          { value: [{ [constants.INSTANCE_FULL_NAME_FIELD]: 'YES' },
            { [constants.INSTANCE_FULL_NAME_FIELD]: 'NO' }] } } }],
      [constants.INSTANCE_FULL_NAME_FIELD]: 'Lead' })
      it('should merge sobject fields with a custom object instance elemenet', async () => {
        mockSingleSObject('Lead', [{
          name: 'MyAutoNumber',
          type: 'string',
          label: 'AutoNumero',
          autoNumber: true,
        },
        {
          name: 'MyPicklist',
          type: 'picklist',
          label: 'My Picklist',
          picklistValues: [],
        }], false, true, false, 'Picklist Label')
        const result: Element[] = [testInstanceElement]
        await filter().onFetch(result)

        const lead = result.filter(o => o.elemID.name === 'lead').pop()
        expect(lead).toBeDefined()
        expect(isObjectType(lead)).toBeTruthy()
        const leadObjectType = lead as ObjectType
        expect(leadObjectType.fields.my_auto_number
          .annotations[constants.FIELD_ANNOTATIONS.DISPLAY_FORMAT]).toBe('A-{0000}')
        expect(leadObjectType.fields.my_auto_number
          .annotations.label).toBe('AutoNumero')
        expect(leadObjectType.fields.my_auto_number
          .annotations[Type.ANNOTATIONS.REQUIRED]).toBe(false)
        expect(leadObjectType.fields.my_picklist
          .annotations[Type.ANNOTATIONS.VALUES]).toEqual(['YES', 'NO'])
        expect(leadObjectType.fields.my_picklist
          .annotations[Type.ANNOTATIONS.DEFAULT]).toBe('YES')
        expect(leadObjectType.fields.my_picklist
          .annotations[Type.ANNOTATIONS.REQUIRED]).toBe(true)
      })

      it('should change instance element to object type if we do not get it from the soap api', async () => {
        const result: Element[] = [testInstanceElement]
        await filter().onFetch(result)

        const lead = result.filter(o => o.elemID.name === 'lead').pop()
        expect(lead).toBeDefined()
        expect(isObjectType(lead)).toBeTruthy()
        const leadObjectType = lead as ObjectType
        expect(leadObjectType.fields.my_auto_number
          .annotations[constants.FIELD_ANNOTATIONS.DISPLAY_FORMAT]).toBe('A-{0000}')
      })
    })
  })
})
