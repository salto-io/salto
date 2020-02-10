import _ from 'lodash'
import {
  ElemID, ObjectType, ServiceIds, BuiltinTypes, Element,
  InstanceElement, isObjectType, CORE_ANNOTATIONS, Value, FieldMap, Field, isInstanceElement,
} from 'adapter-api'
import SalesforceClient from '../../src/client/client'
import Connection from '../../src/client/jsforce'
import {
  FIELD_ANNOTATIONS, FILTER_ITEM_FIELDS, SALESFORCE, METADATA_TYPE,
  CUSTOM_OBJECT, INSTANCE_FULL_NAME_FIELD, LABEL, NAMESPACE_SEPARATOR,
  SALESFORCE_CUSTOM_SUFFIX, API_NAME, FORMULA, LOOKUP_FILTER_FIELDS,
  FIELD_DEPENDENCY_FIELDS, VALUE_SETTINGS_FIELDS, VALUE_SET_FIELDS,
  CUSTOM_VALUE, VALUE_SET_DEFINITION_FIELDS,
  OBJECTS_PATH, INSTALLED_PACKAGES_PATH, TYPES_PATH,
} from '../../src/constants'
import mockAdapter from '../adapter'
import { findElements, createValueSetEntry } from '../utils'
import filterCreator, {
  INSTANCE_REQUIRED_FIELD, INSTANCE_TYPE_FIELD, NESTED_INSTANCE_VALUE_TO_TYPE_NAME,
  CUSTOM_OBJECT_TYPE_ID, NESTED_INSTANCE_VALUE_NAME, NESTED_INSTANCE_TYPE_NAME,
} from '../../src/filters/custom_objects'
import { FilterWith } from '../../src/filter'

describe('Custom Objects filter', () => {
  let connection: Connection
  let client: SalesforceClient

  const mockGetElemIdFunc = (adapterName: string, _serviceIds: ServiceIds, name: string):
    ElemID => new ElemID(adapterName, name)

  type FilterType = FilterWith<'onFetch'>
  const filter = (): FilterType => filterCreator({ client }) as FilterType
  let result: Element[]

  const generateCustomObjectType = (): ObjectType => {
    const generateInnerMetadataTypeFields = (name: string, elemID: ElemID): FieldMap => {
      if (name === NESTED_INSTANCE_VALUE_NAME.LIST_VIEWS) {
        const listViewFilterElemId = new ElemID(SALESFORCE, 'ListViewFilter')
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
      if (name === NESTED_INSTANCE_VALUE_NAME.FIELD_SETS) {
        return {
          availableFields: new Field(elemID, 'availableFields', BuiltinTypes.STRING),
          displayedFields: new Field(elemID, 'displayedFields', BuiltinTypes.STRING),
          [INSTANCE_FULL_NAME_FIELD]: new Field(elemID, INSTANCE_FULL_NAME_FIELD,
            BuiltinTypes.STRING),

        }
      }
      if (name === NESTED_INSTANCE_VALUE_NAME.COMPACT_LAYOUTS) {
        return {
          fields: new Field(elemID, 'fields', BuiltinTypes.STRING),
          [INSTANCE_FULL_NAME_FIELD]: new Field(elemID, INSTANCE_FULL_NAME_FIELD,
            BuiltinTypes.STRING),
        }
      }
      return {}
    }

    const innerMetadataTypesFromInstance = _(NESTED_INSTANCE_VALUE_TO_TYPE_NAME)
      .entries()
      .map(([annotationName, typeName]) => {
        const elemID = new ElemID(SALESFORCE, typeName)
        return [annotationName, new Field(CUSTOM_OBJECT_TYPE_ID, annotationName, new ObjectType({
          elemID, fields: generateInnerMetadataTypeFields(annotationName, elemID),
        }))]
      })
      .fromPairs()
      .value()

    return new ObjectType({ elemID: CUSTOM_OBJECT_TYPE_ID,
      fields: {
        ...innerMetadataTypesFromInstance,
        [INSTANCE_FULL_NAME_FIELD]: new Field(CUSTOM_OBJECT_TYPE_ID, INSTANCE_FULL_NAME_FIELD,
          BuiltinTypes.STRING),
        pluralLabel: new Field(CUSTOM_OBJECT_TYPE_ID, 'pluralLabel', BuiltinTypes.STRING),
        enableFeeds: new Field(CUSTOM_OBJECT_TYPE_ID, 'enableFeeds', BuiltinTypes.BOOLEAN),
      } })
  }

  const origCustomObjectType = generateCustomObjectType()
  let customObjectType: ObjectType
  beforeEach(() => {
    ({ connection, client } = mockAdapter({
      adapterParams: {
        getElemIdFunc: mockGetElemIdFunc,
      },
    }))
    customObjectType = origCustomObjectType.clone()
    result = [customObjectType]
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

    const findLeadAnnotationsObject = (): ObjectType =>
      result.find(o => o.elemID.name === 'Lead' && o.annotations[API_NAME]) as ObjectType

    it('should fetch sobject with primitive types, validate type, label, required and default annotations', async () => {
      mockSingleSObject('Lead', [
        {
          name: 'LastName',
          type: 'string',
          label: 'Last Name',
          nillable: false,
          defaultValue: {
            $: { 'xsi:type': 'xsd:string' },
            _: 'BLABLA',
          },
        },
        {
          name: 'FirstName',
          type: 'string',
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
          custom: true,
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
          custom: true,
          type: 'string',
          label: 'Dummy formula',
          calculated: true,
          calculatedFormula: 'my formula',
        },
      ])
      await filter().onFetch(result)
      const leadElements = findElements(result, 'Lead')
      expect(leadElements).toHaveLength(3)
      // Standard fields
      const leadStandardFieldsObj = leadElements
        .find(elem => elem.path?.slice(-1)[0] === 'LeadStandardFields') as ObjectType
      expect(leadStandardFieldsObj).toBeDefined()
      expect(leadStandardFieldsObj.fields.LastName.type.elemID.name).toBe('Text')
      expect(leadStandardFieldsObj.fields.LastName.annotations.label).toBe('Last Name')
      // Test Required true and false
      expect(leadStandardFieldsObj.fields.LastName.annotations[CORE_ANNOTATIONS.REQUIRED])
        .toBe(true)
      expect(leadStandardFieldsObj.fields.FirstName.annotations[CORE_ANNOTATIONS.REQUIRED])
        .toBe(false)
      // Default string and boolean
      expect(leadStandardFieldsObj.fields.LastName.annotations[FIELD_ANNOTATIONS.DEFAULT_VALUE])
        .toBe('BLABLA')
      expect(leadStandardFieldsObj.fields.IsDeleted.annotations[FIELD_ANNOTATIONS.DEFAULT_VALUE])
        .toBe(false)

      // Custom fields
      const leadCustomFieldsObj = leadElements
        .find(elem => elem.path?.slice(-1)[0] === 'LeadCustomFields') as ObjectType
      expect(leadCustomFieldsObj).toBeDefined()
      // Custom type
      expect(leadCustomFieldsObj.fields.Custom__c).not.toBeUndefined()
      expect(leadCustomFieldsObj.fields.Custom__c.annotations[API_NAME]).toBe('Lead.Custom__c')
      expect(leadCustomFieldsObj.fields.Custom__c.annotations[FIELD_ANNOTATIONS.DEFAULT_VALUE])
        .toBe(false)
      // Formula field
      expect(leadCustomFieldsObj.fields.Formula__c).toBeDefined()
      expect(leadCustomFieldsObj.fields.Formula__c.type.elemID.name).toBe('FormulaText')
      expect(leadCustomFieldsObj.fields.Formula__c.annotations[FORMULA]).toBe('my formula')
    })

    it('should fetch sobject with picklist field', async () => {
      mockSingleSObject('Lead', [
        {
          name: 'primary',
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

      const lead = findElements(result, 'Lead').pop() as ObjectType
      expect(lead.fields.primary.type.elemID.name).toBe('Picklist')
      expect(lead.fields.primary.annotations[FIELD_ANNOTATIONS.VALUE_SET])
        .toEqual([
          createValueSetEntry('No'),
          createValueSetEntry('Yes', true),
        ])
      expect(lead.fields.primary.annotations[FIELD_ANNOTATIONS.RESTRICTED]).toBe(true)
    })

    it('should fetch sobject with combobox field', async () => {
      mockSingleSObject('Lead', [
        {
          name: 'primary',
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

      const lead = findElements(result, 'Lead').pop() as ObjectType
      expect(lead.fields.primary.type.elemID.name).toBe('Picklist')
      expect(lead.fields.primary.annotations[FIELD_ANNOTATIONS.VALUE_SET])
        .toEqual([
          createValueSetEntry('No'),
          createValueSetEntry('Yes', true),
        ])
    })

    it('should fetch sobject with number field', async () => {
      mockSingleSObject('Lead', [
        {
          name: 'NumberField',
          type: 'double',
          label: 'Numero',
          nillable: true,
        },
      ])
      await filter().onFetch(result)

      const lead = findElements(result, 'Lead').pop() as ObjectType
      expect(lead.fields.NumberField.type.elemID.name).toBe('Number')
    })

    it('should fetch sobject with api_name and metadata_type service ids', async () => {
      mockSingleSObject('Lead', [])
      await filter().onFetch(result)

      const leadAnnotationsObj = findLeadAnnotationsObject()
      expect(leadAnnotationsObj.annotationTypes[API_NAME]).toEqual(BuiltinTypes.SERVICE_ID)
      expect(leadAnnotationsObj.annotationTypes[METADATA_TYPE]).toEqual(BuiltinTypes.SERVICE_ID)
      expect(leadAnnotationsObj.annotations[API_NAME]).toEqual('Lead')
      expect(leadAnnotationsObj.annotations[METADATA_TYPE]).toEqual(CUSTOM_OBJECT)
    })

    it('should fetch sobject with label', async () => {
      mockSingleSObject('Lead', [], false, true, false, 'Lead Label')
      await filter().onFetch(result)
      const leadAnnotationsObj = findLeadAnnotationsObject()
      expect(leadAnnotationsObj.annotations[LABEL]).toEqual('Lead Label')
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

      const custom = result.filter(o => o.elemID.name === 'Custom').pop() as ObjectType
      expect(custom.fields.StringField.annotations[API_NAME]).toEqual('Custom__c.StringField__c')
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
          name: 'string',
          type: 'string',
          label: 'Stringo',
        },
        {
          name: 'number',
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

      const lead = findElements(result, 'Lead').pop() as ObjectType
      expect(lead.fields.MyAutoNumber.type.elemID.name).toBe('AutoNumber')
      expect(lead.fields.string.type.elemID.name).toBe('Text')
      expect(lead.fields.number.type.elemID.name).toBe('Number')
      expect(lead.fields.MyTextArea.type.elemID.name).toBe('TextArea')
      expect(lead.fields.MyLongTextArea.type.elemID.name).toBe('LongTextArea')
      expect(lead.fields.MyRichTextArea.type.elemID.name).toBe('Html')
      expect(lead.fields.MyEncryptedString.type.elemID.name).toBe('EncryptedText')
      expect(lead.fields.MyMultiPickList.type.elemID.name).toBe('MultiselectPicklist')
      expect(lead.fields.MyMultiPickList
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

      const testElements = findElements(result, 'Test') as ObjectType[]
      expect(testElements).toHaveLength(3)
      const annotationsObj = testElements.find(obj =>
        _.isEqual(obj.path, [SALESFORCE, OBJECTS_PATH, 'Test', 'TestAnnotations'])) as ObjectType
      expect(annotationsObj).toBeDefined()
      expect(annotationsObj.annotations[API_NAME]).toBeDefined()
      expect(annotationsObj.fields.dummy).toBeUndefined()
      expect(annotationsObj.fields.CustomField__c).toBeUndefined()

      const standardFieldsObj = testElements.find(obj =>
        _.isEqual(obj.path, [SALESFORCE, OBJECTS_PATH, 'Test', 'TestStandardFields'])) as ObjectType
      expect(standardFieldsObj).toBeDefined()
      expect(standardFieldsObj.fields.dummy).toBeDefined()
      expect(standardFieldsObj.fields.CustomField__c).toBeUndefined()
      expect(standardFieldsObj.annotations[API_NAME]).toBeUndefined()

      const customFieldsObj = testElements.find(obj =>
        _.isEqual(obj.path, [SALESFORCE, OBJECTS_PATH, 'Test', 'TestCustomFields'])) as ObjectType
      expect(customFieldsObj).toBeDefined()
      expect(customFieldsObj.fields.dummy).toBeUndefined()
      expect(customFieldsObj.fields.CustomField__c).toBeDefined()
      expect(customFieldsObj.annotations[API_NAME]).toBeUndefined()
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

      const testElements = findElements(result, 'Test') as ObjectType[]
      expect(testElements).toHaveLength(0)
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

      const testElements = findElements(result, 'namespaceName__Test__c') as ObjectType[]
      expect(testElements).toHaveLength(3)
      const annotationsObj = testElements.find(obj =>
        _.isEqual(obj.path, [SALESFORCE, INSTALLED_PACKAGES_PATH, namespaceName, OBJECTS_PATH,
          'namespaceName__Test__c', 'namespaceName__Test__cAnnotations'])) as ObjectType
      expect(annotationsObj).toBeDefined()
      expect(annotationsObj.annotations[API_NAME]).toBeDefined()
      expect(annotationsObj.fields.dummy).toBeUndefined()
      expect(annotationsObj.fields.CustomField__c).toBeUndefined()

      const standardFieldsObj = testElements.find(obj =>
        _.isEqual(obj.path, [SALESFORCE, INSTALLED_PACKAGES_PATH, namespaceName, OBJECTS_PATH,
          'namespaceName__Test__c', 'namespaceName__Test__cStandardFields'])) as ObjectType
      expect(standardFieldsObj).toBeDefined()
      expect(standardFieldsObj.fields.dummy).toBeDefined()
      expect(standardFieldsObj.fields.CustomField__c).toBeUndefined()
      expect(standardFieldsObj.annotations[API_NAME]).toBeUndefined()

      const customFieldsObj = testElements.find(obj =>
        _.isEqual(obj.path, [SALESFORCE, INSTALLED_PACKAGES_PATH, namespaceName, OBJECTS_PATH,
          'namespaceName__Test__c', 'namespaceName__Test__cCustomFields'])) as ObjectType
      expect(customFieldsObj).toBeDefined()
      expect(customFieldsObj.fields.dummy).toBeUndefined()
      expect(customFieldsObj.fields.CustomField__c).toBeDefined()
      expect(customFieldsObj.annotations[API_NAME]).toBeUndefined()
    })

    it('should fetch standard sobject with packaged and not packaged custom field', async () => {
      const namespaceName = 'namespaceName'
      mockSingleSObject('Lead', [
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

      const leadElements = findElements(result, 'Lead') as ObjectType[]
      expect(leadElements).toHaveLength(4)
      const annotationsObj = leadElements.find(obj =>
        _.isEqual(obj.path, [SALESFORCE, OBJECTS_PATH, 'Lead', 'LeadAnnotations'])) as ObjectType
      expect(annotationsObj).toBeDefined()
      expect(annotationsObj.annotations[API_NAME]).toBeDefined()
      expect(annotationsObj.fields.dummy).toBeUndefined()
      expect(annotationsObj.fields.CustomField__c).toBeUndefined()
      expect(annotationsObj.fields.namespaceName__PackagedField__c).toBeUndefined()

      const standardFieldsObj = leadElements.find(obj =>
        _.isEqual(obj.path, [SALESFORCE, OBJECTS_PATH, 'Lead', 'LeadStandardFields'])) as ObjectType
      expect(standardFieldsObj).toBeDefined()
      expect(standardFieldsObj.fields.dummy).toBeDefined()
      expect(standardFieldsObj.fields.CustomField__c).toBeUndefined()
      expect(standardFieldsObj.fields.namespaceName__PackagedField__c).toBeUndefined()
      expect(standardFieldsObj.annotations[API_NAME]).toBeUndefined()

      const customFieldsObj = leadElements.find(obj =>
        _.isEqual(obj.path, [SALESFORCE, OBJECTS_PATH, 'Lead', 'LeadCustomFields'])) as ObjectType
      expect(customFieldsObj).toBeDefined()
      expect(customFieldsObj.fields.dummy).toBeUndefined()
      expect(customFieldsObj.fields.namespaceName__PackagedField__c).toBeUndefined()
      expect(customFieldsObj.fields.CustomField__c).toBeDefined()
      expect(customFieldsObj.annotations[API_NAME]).toBeUndefined()

      const packagedCustomFieldsObj = leadElements.find(obj =>
        _.isEqual(obj.path, [SALESFORCE, INSTALLED_PACKAGES_PATH, namespaceName, OBJECTS_PATH,
          'Lead', 'LeadCustomFields'])) as ObjectType
      expect(packagedCustomFieldsObj).toBeDefined()
      expect(packagedCustomFieldsObj.fields.dummy).toBeUndefined()
      expect(packagedCustomFieldsObj.fields.CustomField__c).toBeUndefined()
      expect(packagedCustomFieldsObj.fields.namespaceName__PackagedField__c).toBeDefined()
      expect(packagedCustomFieldsObj.annotations[API_NAME]).toBeUndefined()
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
        path: [SALESFORCE, TYPES_PATH, 'flow'] })
      result.push(flowMetadataType)

      await filter().onFetch(result)

      const flow = findElements(result, 'flow').pop() as ObjectType
      expect(flow).toBeDefined() // We do expect to get the metadata type here
      expect(Object.keys(flow.fields)).toHaveLength(0)
      expect(flow.path).toEqual([SALESFORCE, TYPES_PATH, 'flow'])
    })

    describe('Merge elements', () => {
      const testInstanceElement = new InstanceElement('Lead', new ObjectType(
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
          [FIELD_ANNOTATIONS.DEFAULT_VALUE]: 'YES',
          [FIELD_ANNOTATIONS.VALUE_SET]: {
            [VALUE_SET_FIELDS.RESTRICTED]: 'true',
            [VALUE_SET_FIELDS.VALUE_SET_DEFINITION]: {
              [VALUE_SET_DEFINITION_FIELDS.VALUE]:
              [
                {
                  [CUSTOM_VALUE.FULL_NAME]: 'YES',
                  [CUSTOM_VALUE.LABEL]: 'YES',
                  [CUSTOM_VALUE.DEFAULT]: 'true',
                },
                {
                  [CUSTOM_VALUE.FULL_NAME]: 'NO',
                  [CUSTOM_VALUE.LABEL]: 'NO',
                  [CUSTOM_VALUE.DEFAULT]: 'false',
                  [CUSTOM_VALUE.IS_ACTIVE]: 'true',
                  [CUSTOM_VALUE.COLOR]: '#FF0000',
                },
                {
                  [CUSTOM_VALUE.FULL_NAME]: 'MAYBE',
                  [CUSTOM_VALUE.DEFAULT]: 'false',
                  [CUSTOM_VALUE.LABEL]: 'MAYBE',
                  [CUSTOM_VALUE.IS_ACTIVE]: 'false',
                },
              ],
            },
          },
        },
        {
          [INSTANCE_FULL_NAME_FIELD]: 'MyCheckbox',
          [INSTANCE_TYPE_FIELD]: 'Checkbox',
          [INSTANCE_REQUIRED_FIELD]: 'false',
          [FIELD_ANNOTATIONS.DEFAULT_VALUE]: 'true',
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
          [FIELD_ANNOTATIONS.REFERENCE_TO]: 'Account',
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
              [VALUE_SET_DEFINITION_FIELDS.SORTED]: false,
              [VALUE_SET_DEFINITION_FIELDS.VALUE]: [
                {
                  [CUSTOM_VALUE.FULL_NAME]: 'Val1',
                  [CUSTOM_VALUE.DEFAULT]: 'false',
                  [CUSTOM_VALUE.LABEL]: 'Val1',
                },
                {
                  [CUSTOM_VALUE.FULL_NAME]: 'Val2',
                  [CUSTOM_VALUE.DEFAULT]: 'false',
                  [CUSTOM_VALUE.LABEL]: 'Val2',
                },
              ],
            },
          },
          [INSTANCE_TYPE_FIELD]: 'Picklist',
        },
      ],
      [INSTANCE_FULL_NAME_FIELD]: 'Lead' })

      describe('when instance exist but no object returned from soap API', () => {
        it('should merge sobject fields with a custom object instance element', async () => {
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
            name: 'MyCheckbox',
            type: 'checkbox',
            label: 'My Checkbox',
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

          const lead = result.filter(o => o.elemID.name === 'Lead').pop()
          expect(lead).toBeDefined()
          expect(isObjectType(lead)).toBeTruthy()
          const leadObjectType = lead as ObjectType
          expect(leadObjectType.fields.MyAutoNumber
            .annotations[FIELD_ANNOTATIONS.DISPLAY_FORMAT]).toBe('A-{0000}')
          expect(leadObjectType.fields.MyAutoNumber
            .annotations.label).toBe('AutoNumero')
          expect(leadObjectType.fields.MyAutoNumber
            .annotations[CORE_ANNOTATIONS.REQUIRED]).toBe(false)
          expect(leadObjectType.fields.MyPicklist.annotations[FIELD_ANNOTATIONS.VALUE_SET])
            .toEqual([
              createValueSetEntry('YES', true),
              createValueSetEntry('NO', false, 'NO', true, '#FF0000'),
              createValueSetEntry('MAYBE', false, 'MAYBE', false),
            ])
          expect(leadObjectType.fields.MyPicklist.annotations[FIELD_ANNOTATIONS.RESTRICTED])
            .toBe(true)
          expect(leadObjectType.fields.MyPicklist.annotations[VALUE_SET_DEFINITION_FIELDS.SORTED])
            .toBe(false)
          expect(leadObjectType.fields.MyPicklist
            .annotations[CORE_ANNOTATIONS.REQUIRED]).toBe(true)

          // Verify checkbox field
          expect(leadObjectType.fields.MyCheckbox
            .annotations[FIELD_ANNOTATIONS.DEFAULT_VALUE]).toBe(true)
          expect(leadObjectType.fields.MyCheckbox
            .annotations[CORE_ANNOTATIONS.REQUIRED]).toBe(false)

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
          const lookupField = leadObjectType.fields.lookup_field
          expect(lookupField.annotations[FIELD_ANNOTATIONS.REFERENCE_TO]).toEqual(['Account'])
          const lookupFilterAnnotation = lookupField.annotations[FIELD_ANNOTATIONS.LOOKUP_FILTER]
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

        describe('when instance exist but no object returned from soap API', () => {
          it('should create custom fields from a custom object instance', async () => {
            const leadInstanceWithCustomFields = testInstanceElement.clone()
            leadInstanceWithCustomFields.value.fields = {
              [INSTANCE_FULL_NAME_FIELD]: 'MyAutoNumber__c',
              [INSTANCE_TYPE_FIELD]: 'AutoNumber',
              [FIELD_ANNOTATIONS.DISPLAY_FORMAT]: 'A-{0000}',
              [INSTANCE_REQUIRED_FIELD]: 'false',
            }
            result.push(leadInstanceWithCustomFields)
            await filter().onFetch(result)

            const leadElements = result.filter(o => o.elemID.name === 'Lead')
            expect(leadElements).toHaveLength(2)
            const leadCustomFieldsObj = leadElements.find(obj =>
              _.isEqual(obj.path, [SALESFORCE, OBJECTS_PATH, 'Lead', 'LeadCustomFields'])) as ObjectType
            expect(leadCustomFieldsObj).toBeDefined()
            expect(leadCustomFieldsObj.fields.MyAutoNumber__c
              .annotations[FIELD_ANNOTATIONS.DISPLAY_FORMAT]).toBe('A-{0000}')
          })

          it('should create standard fields from a custom object instance', async () => {
            result.push(testInstanceElement)
            await filter().onFetch(result)

            const leadElements = result.filter(o => o.elemID.name === 'Lead')
            expect(leadElements).toHaveLength(2)
            const leadStandardFieldsObj = leadElements.find(obj =>
              _.isEqual(obj.path, [SALESFORCE, OBJECTS_PATH, 'Lead', 'LeadStandardFields'])) as ObjectType
            expect(leadStandardFieldsObj).toBeDefined()
            expect(leadStandardFieldsObj.fields.MyAutoNumber
              .annotations[FIELD_ANNOTATIONS.DISPLAY_FORMAT]).toBe('A-{0000}')
          })

          it('should create packaged custom fields from a custom object instance', async () => {
            const leadInstanceWithCustomFields = testInstanceElement.clone()
            leadInstanceWithCustomFields.value.fields = {
              [INSTANCE_FULL_NAME_FIELD]: 'myNamespace__MyAutoNumber__c',
              [INSTANCE_TYPE_FIELD]: 'AutoNumber',
              [FIELD_ANNOTATIONS.DISPLAY_FORMAT]: 'A-{0000}',
              [INSTANCE_REQUIRED_FIELD]: 'false',
            }
            result.push(leadInstanceWithCustomFields)
            await filter().onFetch(result)

            const leadElements = result.filter(o => o.elemID.name === 'Lead')
            expect(leadElements).toHaveLength(2)
            const leadCustomFieldsObj = leadElements.find(obj =>
              _.isEqual(obj.path, [SALESFORCE, INSTALLED_PACKAGES_PATH, 'myNamespace', OBJECTS_PATH,
                'Lead', 'LeadCustomFields'])) as ObjectType
            expect(leadCustomFieldsObj).toBeDefined()
            expect(leadCustomFieldsObj.fields.myNamespace__MyAutoNumber__c
              .annotations[FIELD_ANNOTATIONS.DISPLAY_FORMAT]).toBe('A-{0000}')
          })

          it('should create standard fields from a packaged custom object instance', async () => {
            const leadInstanceWithCustomFields = testInstanceElement.clone()
            leadInstanceWithCustomFields.value[INSTANCE_FULL_NAME_FIELD] = 'myNamespace__Lead__c'
            result.push(leadInstanceWithCustomFields)
            await filter().onFetch(result)

            const leadElements = result.filter(o => o.elemID.name === 'myNamespace__Lead__c')
            expect(leadElements).toHaveLength(2)
            const leadStandardFieldsObj = leadElements.find(obj =>
              _.isEqual(obj.path, [SALESFORCE, INSTALLED_PACKAGES_PATH, 'myNamespace', OBJECTS_PATH,
                'myNamespace__Lead__c', 'myNamespace__Lead__cStandardFields'])) as ObjectType
            expect(leadStandardFieldsObj).toBeDefined()
            expect(leadStandardFieldsObj.fields.MyAutoNumber
              .annotations[FIELD_ANNOTATIONS.DISPLAY_FORMAT]).toBe('A-{0000}')
          })
        })
      })

      describe('merge annotation types from custom object instance', () => {
        let customObjectInstance: InstanceElement
        beforeEach(() => {
          customObjectInstance = new InstanceElement('Lead',
            customObjectType, {
              [INSTANCE_FULL_NAME_FIELD]: 'Lead',
              [NESTED_INSTANCE_VALUE_NAME.LIST_VIEWS]: {
                [INSTANCE_FULL_NAME_FIELD]: 'PartialListViewFullName',
                columns: 'ListViewName',
              },
              pluralLabel: 'Leads',
              enableFeeds: 'True',
            })
        })

        it('should modify the customObjectType', async () => {
          await filter().onFetch(result)

          const listViewType = customObjectType
            .fields[NESTED_INSTANCE_VALUE_NAME.LIST_VIEWS].type as ObjectType
          expect(listViewType.fields.columns.isList).toBeTruthy()
          expect(listViewType.fields.filters.isList).toBeTruthy()

          const fieldSetType = customObjectType
            .fields[NESTED_INSTANCE_VALUE_NAME.FIELD_SETS].type as ObjectType
          expect(fieldSetType.fields.availableFields.isList).toBeTruthy()
          expect(fieldSetType.fields.displayedFields.isList).toBeTruthy()

          const compactLayoutType = customObjectType
            .fields[NESTED_INSTANCE_VALUE_NAME.COMPACT_LAYOUTS].type as
            ObjectType
          expect(compactLayoutType.fields.fields.isList).toBeTruthy()
        })

        it('should remove the custom object type and its instances from the fetch result', async () => {
          mockSingleSObject('Lead', [], false, true, false, 'Instance Label')
          result.push(customObjectInstance)
          await filter().onFetch(result)
          expect(result).toHaveLength(3)
          const resultFullNames = result.map(elem => elem.elemID.getFullName())
          expect(resultFullNames).not.toContain(customObjectInstance.elemID.getFullName())
          expect(resultFullNames).not.toContain(customObjectType.elemID.getFullName())
        })

        it('should remove platform event and article type related elements', async () => {
          mockSingleSObject('Lead', [], false, true, false, 'Instance Label')
          const articleTypeObj = new ObjectType({ elemID: new ElemID(SALESFORCE, 'ArticleType'),
            annotations: {
              [API_NAME]: 'ArticleType__kav',
            } })
          const platformEventObj = new ObjectType({ elemID: new ElemID(SALESFORCE, 'PlatformEvent'),
            annotations: {
              [API_NAME]: 'PlatformEvent__e',
            } })
          const articleTypeChannelDisplayTypeObj = new ObjectType(
            {
              elemID: new ElemID(SALESFORCE, 'ArticleTypeChannelDisplay'),
              annotations: {
                [METADATA_TYPE]: 'ArticleTypeChannelDisplay',
              },
            }
          )
          const articleTypeTemplateTypeObj = new ObjectType(
            {
              elemID: new ElemID(SALESFORCE, 'ArticleTypeTemplate'),
              annotations: {
                [METADATA_TYPE]: 'ArticleTypeTemplate',
              },
            }
          )
          result.push(customObjectInstance, articleTypeObj, platformEventObj,
            articleTypeChannelDisplayTypeObj, articleTypeTemplateTypeObj)
          await filter().onFetch(result)
          const resultFullNames = result.map(elem => elem.elemID.getFullName())
          expect(resultFullNames).not.toContain(articleTypeObj.elemID.getFullName())
          expect(resultFullNames).not.toContain(platformEventObj.elemID.getFullName())
          expect(resultFullNames)
            .not.toContain(articleTypeChannelDisplayTypeObj.elemID.getFullName())
          expect(resultFullNames).not.toContain(articleTypeTemplateTypeObj.elemID.getFullName())
        })

        it('should filter out ignored annotations and not set them on the custom object', async () => {
          mockSingleSObject('Lead', [], false, true, false, 'Instance Label')
          result.push(customObjectInstance)
          await filter().onFetch(result)
          const lead = result.filter(o => o.elemID.name === 'Lead').pop()
          expect(lead).toBeDefined()
          expect(isObjectType(lead)).toBeTruthy()
          const leadObjectType = lead as ObjectType
          expect(leadObjectType.annotationTypes[INSTANCE_FULL_NAME_FIELD]).toBeUndefined()
        })

        it('should merge regular instance element annotations into the standard-custom object type', async () => {
          mockSingleSObject('Lead', [], false, true, false, 'Instance Label')
          result.push(customObjectInstance)
          await filter().onFetch(result)
          const leadAnnotationsObj = findLeadAnnotationsObject()
          expect(leadAnnotationsObj.annotationTypes.enableFeeds).toBeDefined()
          expect(leadAnnotationsObj.annotations.enableFeeds).toBeTruthy()
          expect(leadAnnotationsObj.annotationTypes.pluralLabel).toBeUndefined()
          expect(leadAnnotationsObj.annotations.pluralLabel).toBeUndefined()
        })

        it('should merge regular instance element annotations into the custom-custom object type', async () => {
          mockSingleSObject('Lead', [], false, true, true, 'Instance Label')
          result.push(customObjectInstance)
          await filter().onFetch(result)
          const leadAnnotationsObj = findLeadAnnotationsObject()
          expect(leadAnnotationsObj.annotationTypes.enableFeeds).toBeDefined()
          expect(leadAnnotationsObj.annotations.enableFeeds).toBeTruthy()
          expect(leadAnnotationsObj.annotationTypes.pluralLabel).toBeDefined()
          expect(leadAnnotationsObj.annotations.pluralLabel).toEqual('Leads')
        })

        it('should not merge nested instances into lead objects', async () => {
          mockSingleSObject('Lead', [], false, true, false, 'Instance Label')
          result.push(customObjectInstance)
          await filter().onFetch(result)
          const leadAnnotationsObj = findLeadAnnotationsObject()
          expect(leadAnnotationsObj.annotationTypes.listViews).toBeUndefined()
          expect(leadAnnotationsObj.annotations.listViews).toBeUndefined()
        })

        it('should create instance element for nested instances of custom object', async () => {
          mockSingleSObject('Lead', [], false, true, false, 'Instance Label')
          result.push(customObjectInstance)
          await filter().onFetch(result)
          const [leadListView] = result.filter(o => o.elemID.name === 'Lead_PartialListViewFullName')
          expect(isInstanceElement(leadListView)).toBeTruthy()
          const leadListViewsInstance = leadListView as InstanceElement
          expect(leadListViewsInstance.path)
            .toEqual([SALESFORCE, OBJECTS_PATH, 'Lead', 'ListView', leadListViewsInstance.elemID.name])
          expect(leadListViewsInstance.value.columns).toEqual('ListViewName')
          expect(leadListViewsInstance.value[INSTANCE_FULL_NAME_FIELD]).toEqual('Lead.PartialListViewFullName')
        })

        it('should create multiple instance elements for nested instances of custom object', async () => {
          mockSingleSObject('Lead', [], false, true, false, 'Instance Label')
          const instanceWithMultipleListViews = customObjectInstance.clone()
          instanceWithMultipleListViews
            .value[NESTED_INSTANCE_VALUE_NAME.LIST_VIEWS] = [{
              columns: 'ListViewName1',
              [INSTANCE_FULL_NAME_FIELD]: 'PartialName1',
            },
            {
              [INSTANCE_FULL_NAME_FIELD]: 'PartialName2',
              columns: 'ListViewName2',
            }]
          result.push(instanceWithMultipleListViews)
          await filter().onFetch(result)

          const listViews = result.filter(elem => elem.path?.slice(-2)[0]
            === NESTED_INSTANCE_VALUE_TO_TYPE_NAME[NESTED_INSTANCE_VALUE_NAME.LIST_VIEWS])
          expect(listViews).toHaveLength(2)
          listViews.forEach(listView => expect(isInstanceElement(listView)).toBeTruthy())
          const listViewInstances = listViews as InstanceElement[]
          expect(listViewInstances.map(inst => inst.value))
            .toContainEqual({ columns: 'ListViewName1', [INSTANCE_FULL_NAME_FIELD]: 'Lead.PartialName1' })
          expect(listViewInstances.map(inst => inst.value))
            .toContainEqual({ columns: 'ListViewName2', [INSTANCE_FULL_NAME_FIELD]: 'Lead.PartialName2' })
        })

        it('custom object nested instances should be defined correctly', async () => {
          expect(_.size(NESTED_INSTANCE_VALUE_TO_TYPE_NAME))
            .toBe(_.size(NESTED_INSTANCE_TYPE_NAME))
          expect(Object.keys(NESTED_INSTANCE_VALUE_TO_TYPE_NAME))
            .toEqual(Object.values(NESTED_INSTANCE_VALUE_NAME))
        })

        describe('when instance exist but no object returned from soap API', () => {
          it('should merge regular instance element annotations into the object type', async () => {
            result.push(customObjectInstance)
            await filter().onFetch(result)
            const leadAnnotationsObj = findLeadAnnotationsObject()
            expect(leadAnnotationsObj.annotationTypes.enableFeeds).toBeDefined()
            expect(leadAnnotationsObj.annotations.enableFeeds).toBeTruthy()
            expect(leadAnnotationsObj.annotationTypes.pluralLabel).toBeUndefined()
            expect(leadAnnotationsObj.annotations.pluralLabel).toBeUndefined()
          })

          it('should not merge nested instances into lead object', async () => {
            result.push(customObjectInstance)
            await filter().onFetch(result)
            const leadAnnotationsObj = findLeadAnnotationsObject()
            expect(leadAnnotationsObj.annotationTypes.listViews).toBeUndefined()
            expect(leadAnnotationsObj.annotations.listViews).toBeUndefined()
          })

          it('should create instance element for nested instances of custom object', async () => {
            result.push(customObjectInstance)
            await filter().onFetch(result)
            const leadElements = result.filter(o => o.elemID.name === 'Lead')
            leadElements.forEach(lead => {
              expect(lead.annotations[NESTED_INSTANCE_VALUE_NAME.LIST_VIEWS])
                .toBeUndefined()
              expect(lead.annotationTypes[NESTED_INSTANCE_VALUE_NAME.LIST_VIEWS])
                .toBeUndefined()
            })
            const [leadListView] = result.filter(o => o.elemID.name === 'Lead_PartialListViewFullName')
            expect(isInstanceElement(leadListView)).toBeTruthy()
            const leadListViewsInstance = leadListView as InstanceElement
            expect(leadListViewsInstance.path)
              .toEqual([SALESFORCE, OBJECTS_PATH, 'Lead', 'ListView', leadListViewsInstance.elemID.name])
            expect(leadListViewsInstance.value.columns).toEqual('ListViewName')
            expect(leadListViewsInstance.value[INSTANCE_FULL_NAME_FIELD]).toEqual('Lead.PartialListViewFullName')
          })
        })
      })
    })
  })
})
