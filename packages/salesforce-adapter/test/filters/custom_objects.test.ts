import _ from 'lodash'
import {
  ElemID, ObjectType, ServiceIds, BuiltinTypes, Element,
  InstanceElement, isObjectType, CORE_ANNOTATIONS, Value, FieldMap, Field,
} from 'adapter-api'
import SalesforceClient from '../../src/client/client'
import Connection from '../../src/client/jsforce'
import { FIELD_ANNOTATIONS, FILTER_ITEM_FIELDS, SALESFORCE, METADATA_TYPE,
  CUSTOM_OBJECT, INSTANCE_FULL_NAME_FIELD, LABEL, NAMESPACE_SEPARATOR,
  SALESFORCE_CUSTOM_SUFFIX, API_NAME, FORMULA, LOOKUP_FILTER_FIELDS,
  FIELD_DEPENDENCY_FIELDS, VALUE_SETTINGS_FIELDS, VALUE_SET_FIELDS,
  VALUE_SET_DEFINITION_VALUE_FIELDS, VALUE_SET_DEFINITION_FIELDS,
  DESCRIPTION } from '../../src/constants'
import mockAdapter from '../adapter'
import { findElements, createValueSetEntry } from '../utils'
import filterCreator, { INSTANCE_REQUIRED_FIELD, INSTANCE_TYPE_FIELD,
  customObjectAnnotationTypeIds } from '../../src/filters/custom_objects'
import { FilterWith } from '../../src/filter'

describe('Custom Objects filter', () => {
  let connection: Connection
  let client: SalesforceClient

  const mockGetElemIdFunc = (adapterName: string, _serviceIds: ServiceIds, name: string):
    ElemID => new ElemID(adapterName, name)

  type FilterType = FilterWith<'onFetch' | 'onAdd' | 'onUpdate'>
  const filter = (): FilterType => filterCreator({ client }) as FilterType
  let result: Element[]

  const generateFetchedAnnotationTypes = (): ObjectType[] => {
    const generateAnnotationTypeFields = (elemID: ElemID): FieldMap => {
      if (elemID.name === 'list_view') {
        const listViewFilterElemId = new ElemID(SALESFORCE, 'list_view_filter')
        return {
          [INSTANCE_FULL_NAME_FIELD]: new Field(elemID, INSTANCE_FULL_NAME_FIELD,
            BuiltinTypes.STRING),
          columns: new Field(elemID, 'columns', BuiltinTypes.STRING),
          filters: new Field(elemID, 'filters', new ObjectType({
            elemID: listViewFilterElemId,
            fields: {
              field: new Field(listViewFilterElemId, 'field', BuiltinTypes.STRING),
              value: new Field(listViewFilterElemId, 'value', BuiltinTypes.STRING),
            },
          })),
        }
      }
      if (elemID.name === 'field_set') {
        return {
          // eslint-disable-next-line @typescript-eslint/camelcase
          available_fields: new Field(elemID, 'available_fields', BuiltinTypes.STRING),
          // eslint-disable-next-line @typescript-eslint/camelcase
          displayed_fields: new Field(elemID, 'displayed_fields', BuiltinTypes.STRING),
          [INSTANCE_FULL_NAME_FIELD]: new Field(elemID, INSTANCE_FULL_NAME_FIELD,
            BuiltinTypes.STRING),

        }
      }
      if (elemID.name === 'compact_layout') {
        return {
          fields: new Field(elemID, 'fields', BuiltinTypes.STRING),
          [INSTANCE_FULL_NAME_FIELD]: new Field(elemID, INSTANCE_FULL_NAME_FIELD,
            BuiltinTypes.STRING),

        }
      }
      return {}
    }

    const annotationTypesFromInstance = Object.values(customObjectAnnotationTypeIds)
      .map(elemID => new ObjectType({ elemID, fields: generateAnnotationTypeFields(elemID) }))
    return annotationTypesFromInstance
  }

  const annotationTypesFromInstance = generateFetchedAnnotationTypes()
  beforeEach(() => {
    ({ connection, client } = mockAdapter({
      adapterParams: {
        getElemIdFunc: mockGetElemIdFunc,
      },
    }))
    result = _.cloneDeep(annotationTypesFromInstance)
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
            CUSTOM_OBJECT, ...(isMetadataType ? [name] : []),
          ].map(xmlName => ({ xmlName })),
        }))

      connection.metadata.describeValueType = jest.fn()
        .mockImplementation(async () => ({ valueTypeFields: [] }))

      connection.metadata.list = jest.fn()
        .mockImplementation(async ([{ type }]) => (
          (type === CUSTOM_OBJECT && isInCustomObjectList) ? [{ fullName: name }] : []
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
      await filter().onFetch(result)

      const lead = findElements(result, 'lead').pop() as ObjectType
      expect(lead.fields.last_name.type.elemID.name).toBe('text')
      expect(lead.fields.last_name.annotations.label).toBe('Last Name')
      // Test Required true and false
      expect(lead.fields.last_name.annotations[CORE_ANNOTATIONS.REQUIRED]).toBe(true)
      expect(lead.fields.first_name.annotations[CORE_ANNOTATIONS.REQUIRED]).toBe(false)
      // Default string and boolean
      expect(lead.fields.last_name.annotations[INSTANCE_DEFAULT_VALUE_FIELD]).toBe('BLABLA')
      expect(lead.fields.is_deleted.annotations[INSTANCE_DEFAULT_VALUE_FIELD]).toBe(false)
      // Custom type
      expect(lead.fields.custom__c).not.toBeUndefined()
      expect(lead.fields.custom__c.annotations[API_NAME]).toBe('Lead.Custom__c')
      expect(lead.fields.custom__c.annotations[INSTANCE_DEFAULT_VALUE_FIELD]).toBe(false)
      // Formula field
      expect(lead.fields.formula__c).toBeDefined()
      expect(lead.fields.formula__c.type.elemID.name).toBe('formula_text')
      expect(lead.fields.formula__c.annotations[FORMULA]).toBe('my formula')
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
      await filter().onFetch(result)

      const lead = findElements(result, 'lead').pop() as ObjectType
      expect(lead.fields.primary_c.type.elemID.name).toBe('picklist')
      expect(lead.fields.primary_c
        .annotations[FIELD_ANNOTATIONS.VALUE_SET])
        .toEqual([
          createValueSetEntry('No'),
          createValueSetEntry('Yes', true),
        ])
      expect(lead.fields.primary_c.annotations[FIELD_ANNOTATIONS.RESTRICTED]).toBe(true)
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
      await filter().onFetch(result)

      const lead = findElements(result, 'lead').pop() as ObjectType
      expect(lead.fields.primary_c.type.elemID.name).toBe('combobox')
      expect(lead.fields.primary_c.annotations[FIELD_ANNOTATIONS.VALUE_SET])
        .toEqual([
          createValueSetEntry('No'),
          createValueSetEntry('Yes', true),
        ])
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
      await filter().onFetch(result)

      const lead = findElements(result, 'lead').pop() as ObjectType
      expect(lead.fields.number_field.type.elemID.name).toBe('number')
    })

    it('should fetch sobject with api_name and metadata_type service ids', async () => {
      mockSingleSObject('Lead', [])
      await filter().onFetch(result)

      const lead = result.filter(o => o.elemID.name === 'lead').pop() as ObjectType
      expect(lead.annotationTypes[API_NAME]).toEqual(BuiltinTypes.SERVICE_ID)
      expect(lead.annotationTypes[METADATA_TYPE]).toEqual(BuiltinTypes.SERVICE_ID)
      expect(lead.annotations[API_NAME]).toEqual('Lead')
      expect(lead.annotations[METADATA_TYPE]).toEqual(CUSTOM_OBJECT)
    })

    it('should fetch sobject with label', async () => {
      mockSingleSObject('Lead', [], false, true, false, 'Lead Label')
      await filter().onFetch(result)

      const lead = result.filter(o => o.elemID.name === 'lead').pop() as ObjectType
      expect(lead.annotations[LABEL]).toEqual('Lead Label')
    })

    it('should use existing elemID when fetching custom object', async () => {
      ({ connection, client } = mockAdapter({
        adapterParams: {
          getElemIdFunc: (adapterName: string, _serviceIds: ServiceIds, name: string):
            ElemID => new ElemID(adapterName, name.endsWith(SALESFORCE_CUSTOM_SUFFIX)
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

      const newFilter = (): FilterType => filterCreator({ client }) as FilterType
      await newFilter().onFetch(result)

      const custom = result.filter(o => o.elemID.name === 'custom').pop() as ObjectType
      expect(custom.fields.string_field.annotations[API_NAME]).toEqual('Custom__c.StringField__c')
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
        .annotations[FIELD_ANNOTATIONS.VISIBLE_LINES]).toBe(5)
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

      await filter().onFetch(result)

      const testElements = findElements(result, 'test') as ObjectType[]
      expect(testElements).toHaveLength(2)
      const [test, testCustomizations] = testElements
      expect(test.path).toEqual([SALESFORCE, 'objects', 'standard', 'test'])
      expect(test.fields.dummy).toBeDefined()
      expect(test.fields.custom_field__c).toBeUndefined()
      expect(testCustomizations.path).toEqual([SALESFORCE, 'objects', 'custom', 'test'])
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

      await filter().onFetch(result)

      const testElements = findElements(result, 'test__c') as ObjectType[]
      // custom objects should not be split
      expect(testElements).toHaveLength(1)
      const [test] = testElements
      expect(test.path).toEqual(
        [SALESFORCE, 'objects', 'custom', 'test__c']
      )
      expect(test.fields.dummy).toBeDefined()
      expect(test.fields.custom_field__c).toBeDefined()
    })

    it('should fetch packaged custom SObjects', async () => {
      const namespaceName = 'namespaceName'
      mockSingleSObject(`${namespaceName}${NAMESPACE_SEPARATOR}Test__c`, [
        {
          name: 'dummy', label: 'dummy', type: 'string',
        },
        {
          name: 'CustomField__c', label: 'custom field', type: 'string', custom: true,
        },
      ], false, true, true)

      await filter().onFetch(result)

      const testElements = findElements(result, 'namespace_name___test__c') as ObjectType[]
      // custom objects should not be split
      expect(testElements).toHaveLength(1)
      const [test] = testElements
      expect(test.path)
        .toEqual([SALESFORCE, 'installed_packages',
          namespaceName, 'objects', 'namespace_name___test__c'])
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
          name: `${namespaceName}${NAMESPACE_SEPARATOR}PackagedField__c`, label: 'custom field', type: 'string', custom: true,
        },
      ], false, true, false)

      await filter().onFetch(result)

      const testElements = findElements(result, 'test__c') as ObjectType[]
      // custom objects should not be split
      expect(testElements).toHaveLength(2)
      const [[obj], [packagedObj]] = _.partition(testElements, elem => elem.fields.dummy)
      expect(obj.path).toEqual([SALESFORCE, 'objects', 'standard', 'test__c'])
      expect(obj.fields.dummy).toBeDefined()
      expect(obj.fields.namespace_name___packaged_field__c).toBeUndefined()
      expect(packagedObj.path)
        .toEqual([SALESFORCE, 'installed_packages', namespaceName, 'objects', 'test__c'])
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
          name: `${namespaceName}${NAMESPACE_SEPARATOR}PackagedField__c`, label: 'custom field', type: 'string', custom: true,
        },
      ], false, true, false)

      await filter().onFetch(result)

      const testElements = findElements(result, 'test__c') as ObjectType[]
      // custom objects should not be split
      expect(testElements).toHaveLength(3)
      const [[packagedObj], objs] = _.partition(testElements,
        elem => elem.fields.namespace_name___packaged_field__c)
      const [[obj], [customObj]] = _.partition(objs, elem => elem.fields.dummy)

      expect(obj.path).toEqual([SALESFORCE, 'objects', 'standard', 'test__c'])
      expect(obj.fields.dummy).toBeDefined()
      expect(obj.fields.custom_field__c).toBeUndefined()
      expect(obj.fields.namespace_name___packaged_field__c).toBeUndefined()
      expect(customObj.path)
        .toEqual([SALESFORCE, 'objects', 'custom', 'test__c'])
      expect(customObj.fields.dummy).toBeUndefined()
      expect(customObj.fields.custom_field__c).toBeDefined()
      expect(customObj.fields.namespace_name___packaged_field__c).toBeUndefined()
      expect(packagedObj.path)
        .toEqual([SALESFORCE, 'installed_packages', namespaceName, 'objects', 'test__c'])
      expect(packagedObj.fields.dummy).toBeUndefined()
      expect(packagedObj.fields.custom_field__c).toBeUndefined()
      expect(packagedObj.fields.namespace_name___packaged_field__c).toBeDefined()
    })

    it('should not fetch SObjects that conflict with metadata types', async () => {
      mockSingleSObject('Flow', [
        { name: 'dummy', label: 'dummy', type: 'string' },
      ], true)

      // result of fetch (before filters) includes the metadata type
      const flowElemID = mockGetElemIdFunc(SALESFORCE, {}, 'flow')
      const flowMetadataType = new ObjectType({ elemID: flowElemID,
        annotations: { [METADATA_TYPE]: 'Flow' },
        annotationTypes: { [METADATA_TYPE]: BuiltinTypes.SERVICE_ID },
        path: [SALESFORCE, 'types', 'flow'] })
      result.push(flowMetadataType)

      await filter().onFetch(result)

      const flow = findElements(result, 'flow').pop() as ObjectType
      expect(flow).toBeDefined() // We do expect to get the metadata type here
      expect(Object.keys(flow.fields)).toHaveLength(0)
      expect(flow.path).toEqual([SALESFORCE, 'types', 'flow'])
    })
    describe('Merge elements', () => {
      const testInstanceElement = new InstanceElement('lead', new ObjectType(
        { elemID: mockGetElemIdFunc(SALESFORCE, {}, CUSTOM_OBJECT) }
      ),
      { fields: [
        {
          [INSTANCE_FULL_NAME_FIELD]: 'MyAutoNumber',
          [INSTANCE_TYPE_FIELD]: 'AutoNumber',
          [FIELD_ANNOTATIONS.DISPLAY_FORMAT]: 'A-{0000}',
          [INSTANCE_REQUIRED_FIELD]: 'false',
        },
        {
          [INSTANCE_FULL_NAME_FIELD]: 'MyPicklist',
          [INSTANCE_TYPE_FIELD]: 'Picklist',
          [INSTANCE_REQUIRED_FIELD]: 'true',
          [INSTANCE_DEFAULT_VALUE_FIELD]: 'YES',
          [FIELD_ANNOTATIONS.VALUE_SET]:
          { [VALUE_SET_FIELDS.RESTRICTED]: 'true',
            [VALUE_SET_FIELDS.VALUE_SET_DEFINITION]:
            { [VALUE_SET_DEFINITION_FIELDS.VALUE]: [
              { [VALUE_SET_DEFINITION_VALUE_FIELDS.FULL_NAME]: 'YES',
                [VALUE_SET_DEFINITION_VALUE_FIELDS.LABEL]: 'YES',
                [VALUE_SET_DEFINITION_VALUE_FIELDS.DEFAULT]: 'true' },
              { [VALUE_SET_DEFINITION_VALUE_FIELDS.FULL_NAME]: 'NO',
                [VALUE_SET_DEFINITION_VALUE_FIELDS.LABEL]: 'NO',
                [VALUE_SET_DEFINITION_VALUE_FIELDS.DEFAULT]: 'false' }] } },
        },
        {
          [INSTANCE_FULL_NAME_FIELD]: 'rollup',
          [LABEL]: 'My Summary',
          [FIELD_ANNOTATIONS.SUMMARIZED_FIELD]: 'Opportunity.Amount',
          [FIELD_ANNOTATIONS.SUMMARY_FILTER_ITEMS]: {
            [FILTER_ITEM_FIELDS.FIELD]: 'Opportunity.Amount',
            [FILTER_ITEM_FIELDS.OPERATION]: 'greaterThan',
            [FILTER_ITEM_FIELDS.VALUE]: '1',
          },
          [FIELD_ANNOTATIONS.SUMMARY_FOREIGN_KEY]: 'Opportunity.AccountId',
          [FIELD_ANNOTATIONS.SUMMARY_OPERATION]: 'sum',
          [INSTANCE_TYPE_FIELD]: 'Summary',
        },
        {
          [INSTANCE_FULL_NAME_FIELD]: 'lookup_field',
          [LABEL]: 'My Lookup',
          [FIELD_ANNOTATIONS.LOOKUP_FILTER]: {
            [LOOKUP_FILTER_FIELDS.ACTIVE]: 'true',
            [LOOKUP_FILTER_FIELDS.BOOLEAN_FILTER]: 'myBooleanFilter',
            [LOOKUP_FILTER_FIELDS.ERROR_MESSAGE]: 'myErrorMessage',
            [LOOKUP_FILTER_FIELDS.INFO_MESSAGE]: 'myInfoMessage',
            [LOOKUP_FILTER_FIELDS.IS_OPTIONAL]: 'false',
            [LOOKUP_FILTER_FIELDS.FILTER_ITEMS]: {
              [FILTER_ITEM_FIELDS.FIELD]: 'myField1',
              [FILTER_ITEM_FIELDS.OPERATION]: 'myOperation1',
              [FILTER_ITEM_FIELDS.VALUE_FIELD]: 'myValueField1',
            },
          },
          [INSTANCE_TYPE_FIELD]: 'Lookup',
        },
        {
          [INSTANCE_FULL_NAME_FIELD]: 'lookup_field_optional',
          [LABEL]: 'My Lookup',
          [FIELD_ANNOTATIONS.LOOKUP_FILTER]: {
            [LOOKUP_FILTER_FIELDS.ACTIVE]: 'true',
            [LOOKUP_FILTER_FIELDS.ERROR_MESSAGE]: 'myErrorMessage',
            [LOOKUP_FILTER_FIELDS.IS_OPTIONAL]: 'true',
          },
          [INSTANCE_TYPE_FIELD]: 'Lookup',
        },
        {
          [INSTANCE_FULL_NAME_FIELD]: 'picklist_field',
          [LABEL]: 'My Field Dependency',
          [FIELD_ANNOTATIONS.VALUE_SET]: {
            [FIELD_DEPENDENCY_FIELDS.CONTROLLING_FIELD]: 'ControllingFieldName',
            [FIELD_DEPENDENCY_FIELDS.VALUE_SETTINGS]: [
              {
                [VALUE_SETTINGS_FIELDS.CONTROLLING_FIELD_VALUE]: ['Controlling1', 'Controlling2'],
                [VALUE_SETTINGS_FIELDS.VALUE_NAME]: 'Val1',
              },
              {
                [VALUE_SETTINGS_FIELDS.CONTROLLING_FIELD_VALUE]: ['Controlling1'],
                [VALUE_SETTINGS_FIELDS.VALUE_NAME]: 'Val2',
              },
            ],
            [VALUE_SET_FIELDS.VALUE_SET_DEFINITION]: {
              [VALUE_SET_DEFINITION_FIELDS.VALUE]: [
                {
                  [VALUE_SET_DEFINITION_VALUE_FIELDS.FULL_NAME]: 'Val1',
                  [VALUE_SET_DEFINITION_VALUE_FIELDS.DEFAULT]: 'false',
                  [VALUE_SET_DEFINITION_VALUE_FIELDS.LABEL]: 'Val1',
                },
                {
                  [VALUE_SET_DEFINITION_VALUE_FIELDS.FULL_NAME]: 'Val2',
                  [VALUE_SET_DEFINITION_VALUE_FIELDS.DEFAULT]: 'false',
                  [VALUE_SET_DEFINITION_VALUE_FIELDS.LABEL]: 'Val2',
                },
              ],
            },
          },
          [INSTANCE_TYPE_FIELD]: 'Picklist',
        },
      ],
      [INSTANCE_FULL_NAME_FIELD]: 'Lead' })
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
        },
        {
          name: 'rollup',
          type: 'rollupsummary',
        },
        {
          name: 'lookup_field',
          type: 'lookup',
        },
        {
          name: 'lookup_field_optional',
          type: 'lookup',
        },
        {
          name: 'picklist_field',
          type: 'picklist',
          picklistValues: [],
        },
        ], false, true, false, 'Picklist Label')
        result.push(testInstanceElement)
        await filter().onFetch(result)

        const lead = result.filter(o => o.elemID.name === 'lead').pop()
        expect(lead).toBeDefined()
        expect(isObjectType(lead)).toBeTruthy()
        const leadObjectType = lead as ObjectType
        expect(leadObjectType.fields.my_auto_number
          .annotations[FIELD_ANNOTATIONS.DISPLAY_FORMAT]).toBe('A-{0000}')
        expect(leadObjectType.fields.my_auto_number
          .annotations.label).toBe('AutoNumero')
        expect(leadObjectType.fields.my_auto_number
          .annotations[CORE_ANNOTATIONS.REQUIRED]).toBe(false)
        expect(leadObjectType.fields.my_picklist.annotations[FIELD_ANNOTATIONS.VALUE_SET])
          .toEqual([
            createValueSetEntry('YES', true),
            createValueSetEntry('NO'),
          ])
        expect(leadObjectType.fields.my_picklist.annotations[FIELD_ANNOTATIONS.RESTRICTED])
          .toBeTruthy()
        expect(leadObjectType.fields.my_picklist
          .annotations[CORE_ANNOTATIONS.REQUIRED]).toBe(true)

        // Verify rollup field
        const expectedRollupSummaryField = testInstanceElement.value.fields
          .find((e: Value) => e[INSTANCE_FULL_NAME_FIELD] === 'rollup')
        const rollupSummaryField = leadObjectType.fields.rollup
        expect(rollupSummaryField).toBeDefined()
        expect(rollupSummaryField.annotations[FIELD_ANNOTATIONS.SUMMARIZED_FIELD])
          .toEqual(expectedRollupSummaryField[FIELD_ANNOTATIONS.SUMMARIZED_FIELD])
        expect(rollupSummaryField.annotations[FIELD_ANNOTATIONS.SUMMARY_FOREIGN_KEY])
          .toEqual(expectedRollupSummaryField[FIELD_ANNOTATIONS.SUMMARY_FOREIGN_KEY])
        expect(rollupSummaryField.annotations[FIELD_ANNOTATIONS.SUMMARY_OPERATION])
          .toEqual(expectedRollupSummaryField[FIELD_ANNOTATIONS.SUMMARY_OPERATION])
        const filterItemsRollup = rollupSummaryField
          .annotations[FIELD_ANNOTATIONS.SUMMARY_FILTER_ITEMS]
        expect(filterItemsRollup).toBeDefined()
        expect(filterItemsRollup).toHaveLength(1)
        expect(filterItemsRollup[0][FILTER_ITEM_FIELDS.FIELD])
          .toEqual(expectedRollupSummaryField[FIELD_ANNOTATIONS.SUMMARY_FILTER_ITEMS].field)
        expect(filterItemsRollup[0][FILTER_ITEM_FIELDS.OPERATION])
          .toEqual(expectedRollupSummaryField[FIELD_ANNOTATIONS.SUMMARY_FILTER_ITEMS].operation)
        expect(filterItemsRollup[0][FILTER_ITEM_FIELDS.VALUE])
          .toEqual(expectedRollupSummaryField[FIELD_ANNOTATIONS.SUMMARY_FILTER_ITEMS].value)
        expect(filterItemsRollup[0][FILTER_ITEM_FIELDS.VALUE_FIELD]).toBeUndefined()

        // Verify field dependency field
        const fieldDependencyAnnotation = leadObjectType.fields.picklist_field
          .annotations[FIELD_ANNOTATIONS.FIELD_DEPENDENCY]
        expect(fieldDependencyAnnotation).toBeDefined()
        expect(fieldDependencyAnnotation[FIELD_DEPENDENCY_FIELDS.CONTROLLING_FIELD])
          .toEqual('ControllingFieldName')
        const valuesSettings = fieldDependencyAnnotation[FIELD_DEPENDENCY_FIELDS.VALUE_SETTINGS]
        expect(valuesSettings).toBeDefined()
        expect(valuesSettings).toHaveLength(2)
        expect(valuesSettings[0][VALUE_SETTINGS_FIELDS.VALUE_NAME]).toEqual('Val1')
        expect(valuesSettings[0][VALUE_SETTINGS_FIELDS.CONTROLLING_FIELD_VALUE])
          .toEqual(['Controlling1', 'Controlling2'])
        expect(valuesSettings[1][VALUE_SETTINGS_FIELDS.VALUE_NAME]).toEqual('Val2')
        expect(valuesSettings[1][VALUE_SETTINGS_FIELDS.CONTROLLING_FIELD_VALUE])
          .toEqual(['Controlling1'])

        // Verify lookup field
        const lookupFilterAnnotation = leadObjectType.fields.lookup_field
          .annotations[FIELD_ANNOTATIONS.LOOKUP_FILTER]
        expect(lookupFilterAnnotation).toBeDefined()
        expect(lookupFilterAnnotation[LOOKUP_FILTER_FIELDS.ACTIVE]).toBe(true)
        expect(lookupFilterAnnotation[LOOKUP_FILTER_FIELDS.BOOLEAN_FILTER])
          .toEqual('myBooleanFilter')
        expect(lookupFilterAnnotation[LOOKUP_FILTER_FIELDS.ERROR_MESSAGE])
          .toEqual('myErrorMessage')
        expect(lookupFilterAnnotation[LOOKUP_FILTER_FIELDS.INFO_MESSAGE]).toEqual('myInfoMessage')
        expect(lookupFilterAnnotation[LOOKUP_FILTER_FIELDS.IS_OPTIONAL]).toBe(false)
        expect(lookupFilterAnnotation[LOOKUP_FILTER_FIELDS.FILTER_ITEMS]).toBeDefined()
        expect(lookupFilterAnnotation[LOOKUP_FILTER_FIELDS.FILTER_ITEMS]).toHaveLength(1)
        expect(lookupFilterAnnotation[LOOKUP_FILTER_FIELDS
          .FILTER_ITEMS][0][FILTER_ITEM_FIELDS.FIELD])
          .toEqual('myField1')
        expect(lookupFilterAnnotation[LOOKUP_FILTER_FIELDS
          .FILTER_ITEMS][0][FILTER_ITEM_FIELDS.OPERATION])
          .toEqual('myOperation1')
        expect(lookupFilterAnnotation[LOOKUP_FILTER_FIELDS
          .FILTER_ITEMS][0][FILTER_ITEM_FIELDS.VALUE_FIELD])
          .toEqual('myValueField1')
        expect(lookupFilterAnnotation[LOOKUP_FILTER_FIELDS
          .FILTER_ITEMS][0][FILTER_ITEM_FIELDS.VALUE])
          .toBeUndefined()
        const lookupFilterOptinalAnnotation = leadObjectType.fields.lookup_field_optional
          .annotations[FIELD_ANNOTATIONS.LOOKUP_FILTER]
        expect(lookupFilterOptinalAnnotation).toBeDefined()
        expect(lookupFilterOptinalAnnotation[LOOKUP_FILTER_FIELDS.ACTIVE]).toBe(true)
        expect(lookupFilterOptinalAnnotation[LOOKUP_FILTER_FIELDS.IS_OPTIONAL]).toBe(true)
        expect(lookupFilterOptinalAnnotation[LOOKUP_FILTER_FIELDS.ERROR_MESSAGE]).toBeUndefined()
      })

      it('should change instance element to object type if we do not get it from the soap api', async () => {
        result.push(testInstanceElement)
        await filter().onFetch(result)

        const lead = result.filter(o => o.elemID.name === 'lead').pop()
        expect(lead).toBeDefined()
        expect(isObjectType(lead)).toBeTruthy()
        const leadObjectType = lead as ObjectType
        expect(leadObjectType.fields.my_auto_number
          .annotations[FIELD_ANNOTATIONS.DISPLAY_FORMAT]).toBe('A-{0000}')
      })

      describe('merge annotation types from custom object instance', () => {
        let customObjectInstance: InstanceElement
        beforeEach(() => {
          customObjectInstance = new InstanceElement('lead',
            new ObjectType({ elemID: mockGetElemIdFunc(SALESFORCE, {}, CUSTOM_OBJECT) }), {
              [INSTANCE_FULL_NAME_FIELD]: 'Lead',
              // eslint-disable-next-line @typescript-eslint/camelcase
              list_views: {
                [INSTANCE_FULL_NAME_FIELD]: 'PartialFullName',
                columns: 'ListViewName',
              },
            })
        })

        it('should modify the annotationTypesFromInstance', async () => {
          await filter().onFetch(result)

          const listViewAnnoType = result.filter(o => o.elemID.name === 'list_view').pop() as ObjectType
          expect(listViewAnnoType.fields.columns.isList).toBeTruthy()
          expect(listViewAnnoType.fields.filter_scope).toBeDefined()
          expect(listViewAnnoType.fields.filters.isList).toBeTruthy()
          expect((listViewAnnoType.fields.filters.type as ObjectType).fields.operation)
            .toBeDefined()

          const fieldSetAnnoType = result.filter(o => o.elemID.name === 'field_set').pop() as ObjectType
          expect(fieldSetAnnoType.fields.available_fields.isList).toBeTruthy()
          expect(fieldSetAnnoType.fields.displayed_fields.isList).toBeTruthy()

          const compactLayoutAnnoType = result.filter(o => o.elemID.name === 'compact_layout').pop() as ObjectType
          expect(compactLayoutAnnoType.fields.fields.isList).toBeTruthy()

          const webLinkAnnoType = result.filter(o => o.elemID.name === 'web_link').pop() as ObjectType
          expect(webLinkAnnoType.fields.display_type).toBeDefined()
        })

        it('should merge instance element annotation values into the object type', async () => {
          mockSingleSObject('Lead', [], false, true, false, 'Instance Label')
          result.push(customObjectInstance)
          await filter().onFetch(result)
          const lead = result.filter(o => o.elemID.name === 'lead').pop()
          expect(lead).toBeDefined()
          expect(isObjectType(lead)).toBeTruthy()
          const leadObjectType = lead as ObjectType
          expect(leadObjectType.annotationTypes.list_views).toBeDefined()
          expect(leadObjectType.annotations.list_views).toBeDefined()
          expect(leadObjectType.annotations.list_views.columns)
            .toEqual('ListViewName')
          expect(leadObjectType.annotations.list_views[INSTANCE_FULL_NAME_FIELD])
            .toEqual('Lead.PartialFullName')
        })

        it('should merge instance element annotation values into the object type when annotation value is an array', async () => {
          mockSingleSObject('Lead', [], false, true, false, 'Instance Label')
          const instanceWithAnnotationArray = _.cloneDeep(customObjectInstance)
          // eslint-disable-next-line @typescript-eslint/camelcase
          instanceWithAnnotationArray.value.list_views = [{
            columns: 'ListViewName1',
            [INSTANCE_FULL_NAME_FIELD]: 'PartialName1',
          },
          {
            [INSTANCE_FULL_NAME_FIELD]: 'PartialName2',
            columns: 'ListViewName2',
          }]
          result.push(instanceWithAnnotationArray)
          await filter().onFetch(result)
          const lead = result.filter(o => o.elemID.name === 'lead').pop()
          expect(lead).toBeDefined()
          expect(isObjectType(lead)).toBeTruthy()
          const leadObjectType = lead as ObjectType
          expect(leadObjectType.annotationTypes.list_views).toBeDefined()
          expect(leadObjectType.annotations.list_views).toBeDefined()
          expect(leadObjectType.annotations.list_views).toHaveLength(2)
          expect(leadObjectType.annotations.list_views[0].columns)
            .toEqual('ListViewName1')
          expect(leadObjectType.annotations.list_views[0][INSTANCE_FULL_NAME_FIELD])
            .toEqual('Lead.PartialName1')
          expect(leadObjectType.annotations.list_views[1].columns)
            .toEqual('ListViewName2')
          expect(leadObjectType.annotations.list_views[1][INSTANCE_FULL_NAME_FIELD])
            .toEqual('Lead.PartialName2')
        })

        it('should merge instance element annotation values only into the object type that has API_NAME annotation', async () => {
          mockSingleSObject('Lead', [{
            name: 'CustomField__c',
            type: 'text',
            label: 'Custom Field so the object will be split to 2 elements',
            nillable: false,
            custom: true,
          }], false, true, false, 'Instance Label')
          result.push(customObjectInstance)
          await filter().onFetch(result)
          const leadElements = result.filter(o => o.elemID.name === 'lead')
          expect(leadElements).toBeDefined()
          expect(leadElements).toHaveLength(2)
          const [leadsWithApiName, leadsWithoutApiName] = _.partition(leadElements,
            elem => elem.annotations.api_name)

          expect(leadsWithApiName).toHaveLength(1)
          const leadWithApiName = leadsWithApiName[0] as ObjectType
          expect(leadWithApiName.annotationTypes.list_views).toBeDefined()
          expect(leadWithApiName.annotations.list_views).toBeDefined()
          expect(leadWithApiName.annotations.list_views.columns)
            .toEqual('ListViewName')
          expect(leadWithApiName.annotations.list_views[INSTANCE_FULL_NAME_FIELD])
            .toEqual('Lead.PartialFullName')

          expect(leadsWithoutApiName).toHaveLength(1)
          const leadWithoutApiName = leadsWithoutApiName[0] as ObjectType
          expect(leadWithoutApiName.annotationTypes.list_views).toBeUndefined()
          expect(leadWithoutApiName.annotations.list_views).toBeUndefined()
        })
      })
    })
  })

  describe('onUpdate', () => {
    let mockUpdate: jest.Mock
    let mockUpsert: jest.Mock
    let mockDelete: jest.Mock

    beforeEach(() => {
      mockUpdate = jest.fn().mockImplementationOnce(() => ([{ success: true }]))
      mockUpsert = jest.fn().mockImplementationOnce(() => ([{ success: true }]))
      mockDelete = jest.fn().mockImplementationOnce(() => ([{ success: true }]))
      client.upsert = mockUpsert
      client.update = mockUpdate
      client.delete = mockDelete
    })
    describe('when the annotation values from the CustomObject instance are changed', () => {
      const mockElemID = new ElemID(SALESFORCE, 'test')
      const oldElement = new ObjectType({
        elemID: mockElemID,
        annotations: {
          label: 'test label',
          [API_NAME]: 'Test__c',
          // eslint-disable-next-line @typescript-eslint/camelcase
          validation_rules: [{
            [INSTANCE_FULL_NAME_FIELD]: 'Test__c.val1',
            [DESCRIPTION]: 'to be edited',
          },
          {
            [INSTANCE_FULL_NAME_FIELD]: 'Test__c.val2',
            [DESCRIPTION]: 'to be deleted',
          }],
        },
      })

      const newElement = new ObjectType({
        elemID: mockElemID,
        annotations: {
          label: 'test label',
          [API_NAME]: 'Test__c',
          // eslint-disable-next-line @typescript-eslint/camelcase
          validation_rules: [{
            [INSTANCE_FULL_NAME_FIELD]: 'Test__c.val1',
            [DESCRIPTION]: 'edited description',
          },
          {
            [INSTANCE_FULL_NAME_FIELD]: 'Test__c.val3',
            [DESCRIPTION]: 'created',
          }],
          // eslint-disable-next-line @typescript-eslint/camelcase
          record_types: {
            [INSTANCE_FULL_NAME_FIELD]: 'Test__c.record',
            [DESCRIPTION]: 'created description',
          },
        },
      })

      beforeEach(async () => {
        await filter().onUpdate(oldElement, newElement, [
          { action: 'modify', data: { before: oldElement, after: newElement } },
        ])
      })

      it('should call update validation rule', () => {
        expect(mockUpdate).toHaveBeenCalledTimes(2)
        expect(mockUpdate).toHaveBeenCalledWith('ValidationRule', [{
          fullName: 'Test__c.val1',
          description: 'edited description',
        }])
        expect(mockUpdate).toHaveBeenCalledWith('RecordType', [])
      })

      it('should call upsert validation rule & record type', () => {
        expect(mockUpsert).toHaveBeenCalledTimes(2)
        expect(mockUpsert).toHaveBeenCalledWith('ValidationRule', [{
          fullName: 'Test__c.val3',
          description: 'created',
        }])
        expect(mockUpsert).toHaveBeenCalledWith('RecordType', [{
          fullName: 'Test__c.record',
          description: 'created description',
        }])
      })

      it('should call delete validation rule', () => {
        expect(mockDelete).toHaveBeenCalledTimes(2)
        expect(mockDelete).toHaveBeenCalledWith('ValidationRule', ['Test__c.val2'])
        expect(mockDelete).toHaveBeenCalledWith('RecordType', [])
      })
    })
  })

  describe('onAdd', () => {
    let mockUpsert: jest.Mock

    beforeEach(() => {
      mockUpsert = jest.fn().mockImplementationOnce(() => ([{ success: true }]))
      client.upsert = mockUpsert
    })
    describe('when creating an object with inner types', () => {
      const mockElemID = new ElemID(SALESFORCE, 'test')

      const newElement = new ObjectType({
        elemID: mockElemID,
        annotations: {
          label: 'test label',
          [API_NAME]: 'Test__c',
          // eslint-disable-next-line @typescript-eslint/camelcase
          validation_rules: [{
            [INSTANCE_FULL_NAME_FIELD]: 'Test__c.val1',
            [DESCRIPTION]: 'created1',
          },
          {
            [INSTANCE_FULL_NAME_FIELD]: 'Test__c.val2',
            [DESCRIPTION]: 'created2',
          }],
          // eslint-disable-next-line @typescript-eslint/camelcase
          record_types: {
            [INSTANCE_FULL_NAME_FIELD]: 'Test__c.record',
            [DESCRIPTION]: 'created',
          },
        },
      })

      beforeEach(async () => {
        await filter().onAdd(newElement)
      })

      it('should call upsert validation rules & record type', () => {
        expect(mockUpsert).toHaveBeenCalledWith('ValidationRule', [{
          fullName: 'Test__c.val1',
          description: 'created1',
        },
        {
          fullName: 'Test__c.val2',
          description: 'created2',
        }])
        expect(mockUpsert).toHaveBeenCalledWith('RecordType', [{
          fullName: 'Test__c.record',
          description: 'created',
        }])
      })
    })
  })
})
