import _ from 'lodash'
import {
  ObjectType, Type, InstanceElement, ServiceIds, ElemID, BuiltinTypes, Element,
} from 'adapter-api'
import SalesforceAdapter from '../src/adapter'
import Connection from '../src/client/jsforce'
import * as constants from '../src/constants'
import { Types } from '../src/transformers/transformer'
import { findElements } from './utils'
import mockAdapter from './adapter'
import { id } from '../src/filters/utils'

describe('SalesforceAdapter fetch', () => {
  let connection: Connection
  let adapter: SalesforceAdapter

  const mockGetElemIdFunc = (adapterName: string, _serviceIds: ServiceIds, name: string):
    ElemID => new ElemID(adapterName, name)

  beforeEach(() => {
    ({ connection, adapter } = mockAdapter({
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
      const result = await adapter.fetch()

      const lead = findElements(result, 'lead').pop() as ObjectType
      expect(lead.fields.last_name.type.elemID.name).toBe('text')
      expect(lead.fields.last_name.annotations.label).toBe('Last Name')
      // Test Required true and false
      expect(lead.fields.last_name.annotations[Type.REQUIRED]).toBe(false)
      expect(lead.fields.first_name.annotations[Type.REQUIRED]).toBe(false)
      // Default string and boolean
      expect(lead.fields.last_name.annotations[Type.DEFAULT]).toBe('BLABLA')
      expect(lead.fields.is_deleted.annotations[Type.DEFAULT]).toBe(false)
      // Custom type
      expect(lead.fields.custom__c).not.toBeUndefined()
      expect(lead.fields.custom__c.annotations[constants.API_NAME]).toBe('Custom__c')
      expect(lead.fields.custom__c.annotations[Type.DEFAULT]).toBe(false)
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
      const result = await adapter.fetch()

      const lead = findElements(result, 'lead').pop() as ObjectType
      expect(lead.fields.primary_c.type.elemID.name).toBe('picklist')
      expect((lead.fields.primary_c.annotations[Type.VALUES] as string[]).join(';')).toBe('No;Yes')
      expect(lead.fields.primary_c.annotations[Type.DEFAULT]).toBe('Yes')
      expect(lead.fields.primary_c.annotations[Type.RESTRICTION][Type.ENFORCE_VALUE]).toBe(true)
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
      const result = await adapter.fetch()

      const lead = findElements(result, 'lead').pop() as ObjectType
      expect(lead.fields.primary_c.type.elemID.name).toBe('combobox')
      expect((lead.fields.primary_c.annotations[Type.VALUES] as string[]).join(';'))
        .toBe('No;Yes')
      expect(lead.fields.primary_c.annotations[Type.DEFAULT].length).toBe(1)
      expect(lead.fields.primary_c.annotations[Type.DEFAULT].pop()).toBe('Yes')
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
      const result = await adapter.fetch()

      const lead = findElements(result, 'lead').pop() as ObjectType
      expect(lead.fields.number_field.type.elemID.name).toBe('number')
    })

    it('should fetch sobject with api_name and metadata_type service ids', async () => {
      mockSingleSObject('Lead', [])
      const result = await adapter.fetch()

      const lead = result.filter(o => o.elemID.name === 'lead').pop() as ObjectType
      expect(lead.annotationTypes[constants.API_NAME]).toEqual(BuiltinTypes.SERVICE_ID)
      expect(lead.annotationTypes[constants.METADATA_TYPE]).toEqual(BuiltinTypes.SERVICE_ID)
      expect(lead.annotations[constants.API_NAME]).toEqual('Lead')
      expect(lead.annotations[constants.METADATA_TYPE]).toEqual(constants.CUSTOM_OBJECT)
    })

    it('should fetch sobject with label', async () => {
      mockSingleSObject('Lead', [], false, true, false, 'Lead Label')
      const result = await adapter.fetch()

      const lead = result.filter(o => o.elemID.name === 'lead').pop() as ObjectType
      expect(lead.annotations[constants.LABEL]).toEqual('Lead Label')
    })

    it('should use existing elemID when fetching custom object', async () => {
      ({ connection, adapter } = mockAdapter({
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

      const result = await adapter.fetch()

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
      const result = await adapter.fetch()

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

      const result = await adapter.fetch()

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

      const result = await adapter.fetch()

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

      const result = await adapter.fetch()

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

      const result = await adapter.fetch()

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

      const result = await adapter.fetch()

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

      const result = await adapter.fetch()

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

      const result = await adapter.fetch()

      const flow = findElements(result, 'flow').pop() as ObjectType
      expect(flow).toBeDefined() // We do expect to get the metadata type here
      expect(Object.keys(flow.fields)).toHaveLength(0)
      expect(flow.path).toEqual(['types', 'flow'])
    })
  })

  describe('should fetch metadata types', () => {
    const mockSingleMetadataType = (
      xmlName: string,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fields: Record<string, any>[],
      asChild = false,
    ): void => {
      connection.describeGlobal = jest.fn()
        .mockImplementation(async () => ({ sobjects: [] }))

      connection.metadata.describe = jest.fn()
        .mockImplementation(async () => ({
          metadataObjects: [asChild ? { xmlName: 'Base', childXmlNames: [xmlName] } : { xmlName }],
        }))

      connection.metadata.describeValueType = jest.fn()
        .mockImplementation(async () => ({ valueTypeFields: fields }))

      connection.metadata.list = jest.fn()
        .mockImplementation(async () => [])
    }

    const mockSingleMetadataInstance = (
      name: string,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: Record<string, any>,
      namespace?: string,
      retrievedZipFile?: string
    ): void => {
      connection.metadata.list = jest.fn()
        .mockImplementation(async () => [{ fullName: name, namespacePrefix: namespace }])

      connection.metadata.read = jest.fn()
        .mockImplementation(async () => data)

      if (retrievedZipFile) {
        connection.metadata.retrieve = jest.fn().mockImplementation(() =>
          ({ complete: async () => ({ zipFile: retrievedZipFile }) }))
      }
    }

    it('should fetch basic metadata type', async () => {
      mockSingleMetadataType('Flow', [
        {
          name: 'fullName',
          soapType: 'string',
          valueRequired: true,
        },
        {
          name: 'Description',
          soapType: 'string',
          valueRequired: true,
        },
        {
          name: 'IsTemplate',
          soapType: 'boolean',
          valueRequired: false,
        },
        {
          name: 'Enum',
          soapType: 'SomeEnumType',
          picklistValues: [
            { value: 'yes', defaultValue: true },
            { value: 'no', defaultValue: false },
          ],
        },
      ])
      const result = await adapter.fetch()

      const describeMock = connection.metadata.describeValueType as jest.Mock<unknown>
      expect(describeMock).toHaveBeenCalled()
      expect(describeMock.mock.calls[0][0]).toBe('{http://soap.sforce.com/2006/04/metadata}Flow')
      const flow = findElements(result, 'flow').pop() as ObjectType
      expect(flow.fields.description.type.elemID.name).toBe('string')
      // TODO: remove comment when SALTO-45 will be resolved
      // expect(flow.fields.description.annotations[Type.REQUIRED]).toBe(true)
      expect(flow.fields.is_template.type.elemID.name).toBe('boolean')
      expect(flow.fields.is_template.annotations[Type.REQUIRED]).toBe(false)
      expect(flow.fields.enum.type.elemID.name).toBe('string')
      expect(flow.fields.enum.annotations[Type.DEFAULT]).toBe('yes')
      // Note the order here is important because we expect restriction values to be sorted
      expect(flow.fields.enum.annotations[Type.VALUES]).toEqual(['no', 'yes'])
      expect(flow.path).toEqual(['types', 'flow'])
      expect(flow.fields.full_name.type).toEqual(BuiltinTypes.SERVICE_ID)
      expect(flow.annotationTypes[constants.METADATA_TYPE]).toEqual(BuiltinTypes.SERVICE_ID)
      expect(flow.annotations[constants.METADATA_TYPE]).toEqual('Flow')
    })
    it('should fetch nested metadata types', async () => {
      mockSingleMetadataType('NestingType', [
        { // Nested field with multiple subfields returns fields as array
          name: 'field',
          soapType: 'NestedType',
          fields: [
            {
              name: 'nestedStr',
              soapType: 'string',
            },
            {
              name: 'nestedNum',
              soapType: 'double',
            },
            {
              name: 'doubleNested',
              soapType: 'SingleFieldType',
              fields: {
                name: 'str',
                soapType: 'string',
              },
            },
          ],
        },
        { // Nested field with a single subfield returns fields as an object
          name: 'otherField',
          soapType: 'SingleFieldType',
          fields: {
            name: 'str',
            soapType: 'string',
          },
        },
      ])

      const result = await adapter.fetch()

      expect(result).toHaveLength(_.concat(
        Object.keys(Types.primitiveDataTypes),
        Object.keys(Types.compoundDataTypes)
      ).length
        + 1 /* LookupFilter */
        + 1 /* rollup summary operation */
        + 3
        + 1 /* field permissions */
        + 1 /* object permissions */
        + 1 /* user permissions */
        + 2 /* field dependency & value settings */)

      const types = _.assign({}, ...result.map(t => ({ [id(t)]: t })))
      const nestingType = types['salesforce.nesting_type']
      const nestedType = types['salesforce.nested_type']
      const singleField = types['salesforce.single_field_type']
      expect(nestingType).toBeDefined()
      expect(nestingType.fields.field.type.elemID).toEqual(nestedType.elemID)
      expect(nestingType.fields.other_field.type.elemID).toEqual(singleField.elemID)
      expect(nestedType).toBeDefined()
      expect(nestedType.fields.nested_str.type.elemID).toEqual(BuiltinTypes.STRING.elemID)
      expect(nestedType.fields.nested_num.type.elemID).toEqual(BuiltinTypes.NUMBER.elemID)
      expect(nestedType.fields.double_nested.type.elemID).toEqual(singleField.elemID)
      expect(singleField).toBeDefined()
      expect(singleField.fields.str.type.elemID).toEqual(BuiltinTypes.STRING.elemID)
    })

    it('should fetch metadata instance', async () => {
      mockSingleMetadataType('Flow', [
        {
          name: 'bla',
          soapType: 'Bla',
          fields: [
            {
              name: 'bla',
              soapType: 'double',
            },
            {
              name: 'bla2',
              soapType: 'boolean',
            },
            {
              name: 'bla3',
              soapType: 'boolean',
            },
          ],
        },
        {
          name: 'fullName',
          soapType: 'string',
        },
      ])

      mockSingleMetadataInstance('FlowInstance', {
        fullName: 'FlowInstance',
        bla: { bla: '55', bla2: 'false', bla3: 'true' },
      })

      const result = await adapter.fetch()
      const flow = findElements(result, 'flow', 'flow_instance').pop() as InstanceElement
      expect(flow.type.elemID).toEqual(new ElemID(constants.SALESFORCE, 'flow'))
      expect(flow.value.bla.bla).toBe(55)
      expect(flow.value.bla.bla_2).toBe(false)
      expect(flow.value.bla.bla_3).toBe(true)
    })

    it('should use existing elemID when fetching metadata instance', async () => {
      ({ connection, adapter } = mockAdapter({
        adapterParams: {
          getElemIdFunc: (adapterName: string, serviceIds: ServiceIds, name: string):
            ElemID => new ElemID(adapterName, name === 'flow_instance'
            && serviceIds[constants.INSTANCE_FULL_NAME_FIELD] === 'FlowInstance'
            ? 'my_flow_instance' : name),
        },
      }))

      mockSingleMetadataType('Flow', [
        {
          name: 'bla',
          soapType: 'Bla',
          fields: [
            {
              name: 'bla',
              soapType: 'double',
            },
            {
              name: 'bla2',
              soapType: 'boolean',
            },
            {
              name: 'bla3',
              soapType: 'boolean',
            },
          ],
        },
        {
          name: 'fullName',
          soapType: 'string',
        },
      ])

      mockSingleMetadataInstance('FlowInstance', {
        fullName: 'FlowInstance',
        bla: { bla: '55', bla2: 'false', bla3: 'true' },
      })

      const result = await adapter.fetch()
      const flow = findElements(result, 'flow', 'my_flow_instance').pop() as InstanceElement
      expect(flow.type.elemID).toEqual(new ElemID(constants.SALESFORCE, 'flow'))
      expect(flow.value.full_name).toEqual('FlowInstance')
    })

    it('should fetch complicated metadata instance', async () => {
      mockSingleMetadataType('Layout', [
        {
          name: 'fullName', soapType: 'string', valueRequired: true,
        },
        {
          fields: [
            {
              name: 'label', soapType: 'string', valueRequired: true,
            },
            {
              name: 'style', soapType: 'string', valueRequired: false,
            },
            {
              fields: [{
                fields: [
                  {
                    name: 'field', soapType: 'string', valueRequired: 'true',
                  }, {
                    name: 'behavior', soapType: 'string', valueRequired: 'true',
                  },
                ],
                name: 'layoutItems',
                soapType: 'LayoutItem',
                valueRequired: 'true',
              }, {
                name: 'reserved', soapType: 'string', valueRequired: 'true',
              }],
              name: 'layoutColumns',
              soapType: 'LayoutColumn',
              valueRequired: true,
            }],
          name: 'layoutSections',
          soapType: 'LayoutSection',
        },
        {
          fields: [
            {
              // This use her 'String' and not 'string' on purpose, we saw similar response.
              name: 'name', soapType: 'String', valueRequired: true,
            },
            {
              fields: [
                {
                  name: 'stringValue', soapType: 'string', valueRequired: 'true',
                }],
              name: 'value',
              soapType: 'Value',
              valueRequired: true,
            }],
          name: 'processMetadataValues',
          soapType: 'ProcessMetadataValue',
        },
      ])

      mockSingleMetadataInstance('OrderLayout', {
        fullName: 'Order-Order Layout',
        layoutSections: [{
          label: 'Description Information',
          layoutColumns: [{ layoutItems: { behavior: 'Edit', field: 'Description' } },
            { layoutItems: { behavior: 'Edit2', field: 'Description2' } }],
        }, {
          label: 'Additional Information',
          layoutColumns: ['', ''],
        }, {
          layoutColumns: ['', '', ''],
          style: 'CustomLinks',
        },
        {
          layoutColumns: '',
        }],
        processMetadataValues: [{ name: 'dataType', value: { stringValue: 'Boolean' } },
          { name: 'leftHandSideReferenceTo', value: '' },
          { name: 'leftHandSideReferenceTo2', value: { stringValue: '' } },
          {
            name: 'leftHandSideReferenceTo3',
            value: { stringValue: { $: { 'xsi:nil': 'true' } } },
          }],
      })

      const result = await adapter.fetch()
      const layout = findElements(result, 'layout', 'order').pop() as InstanceElement
      expect(layout.type.elemID).toEqual(new ElemID(constants.SALESFORCE, 'layout'))
      expect(layout.value.full_name).toBe('Order-Order Layout')
      expect(layout.value.layout_sections.length).toBe(3)
      expect(layout.value.layout_sections[0].label).toBe('Description Information')
      expect(layout.value.layout_sections[0].layout_columns[0].layout_items.behavior).toBe('Edit')
      expect(layout.value.layout_sections[0].layout_columns[1].layout_items.field).toBe('Description2')
      expect(layout.value.layout_sections[1].layout_columns).toBeUndefined()
      expect(layout.value.layout_sections[1].label).toBe('Additional Information')
      expect(layout.value.layout_sections[2].style).toBe('CustomLinks')
      expect(((layout.type as ObjectType).fields.process_metadata_values.type as ObjectType)
        .fields.name.type.elemID.name).toBe('string')
      expect(layout.value.process_metadata_values[1].name).toBe('leftHandSideReferenceTo')
      expect(layout.value.process_metadata_values[1].value).toBeUndefined()
      expect(layout.value.process_metadata_values[2].name).toBe('leftHandSideReferenceTo2')
      expect(layout.value.process_metadata_values[2].value).toBeUndefined()
      expect(layout.value.process_metadata_values[3].name).toBe('leftHandSideReferenceTo3')
      expect(layout.value.process_metadata_values[3].value).toBeUndefined()
    })

    it('should fetch metadata types lists', async () => {
      mockSingleMetadataType('Flow', [
        {
          name: 'fullName',
          soapType: 'string',
        },
        {
          name: 'listTest',
          soapType: 'ListTest',
          fields: [{
            name: 'editable',
            soapType: 'boolean',
          },
          {
            name: 'field',
            soapType: 'string',
          }],
        },
      ])

      connection.metadata.list = jest.fn()
        .mockImplementation(async () => [{ fullName: 'FlowInstance' }, { fullName: 'FlowInstance2' }])

      connection.metadata.read = jest.fn()
        .mockImplementation(async () => ([
          {
            fullName: 'FlowInstance',
            listTest: [
              { field: 'Field1', editable: 'true' },
              { field: 'Field2', editable: 'false' },
            ],
          },
          {
            fullName: 'FlowInstance2',
            listTest: { field: 'Field11', editable: 'true' },
          },
        ]))

      const result = await adapter.fetch()
      const flow = findElements(result, 'flow', 'flow_instance').pop() as InstanceElement
      expect(flow.type.elemID).toEqual(new ElemID(constants.SALESFORCE, 'flow'))
      expect((flow.type as ObjectType).fields.list_test.isList).toBe(true)

      expect(flow.elemID).toEqual(new ElemID(constants.SALESFORCE, 'flow', 'instance', 'flow_instance'))
      expect(flow.value.list_test[0].field).toEqual('Field1')
      expect(flow.value.list_test[0].editable).toBe(true)
      expect(flow.value.list_test[1].field).toEqual('Field2')
      expect(flow.value.list_test[1].editable).toBe(false)

      const flow2 = findElements(result, 'flow', 'flow_instance_2').pop() as InstanceElement
      expect(flow2.value.list_test[0].field).toEqual('Field11')
      expect(flow2.value.list_test[0].editable).toBe(true)
    })

    it('should fetch settings instance', async () => {
      mockSingleMetadataType('Settings', [])
      mockSingleMetadataInstance('Quote', { fullName: 'QuoteSettings' })

      await adapter.fetch()

      expect(connection.metadata.read).toHaveBeenCalledWith('QuoteSettings', ['Quote'])
    })

    it('should fetch child metadata type', async () => {
      mockSingleMetadataType('Child', [
        {
          name: 'Description',
          soapType: 'string',
          valueRequired: true,
        },
      ], true)
      const result = await adapter.fetch()

      const describeMock = connection.metadata.describeValueType as jest.Mock<unknown>
      expect(describeMock).toHaveBeenCalled()
      expect(describeMock.mock.calls[1][0]).toBe('{http://soap.sforce.com/2006/04/metadata}Child')
      const child = findElements(result, 'child').pop() as ObjectType
      expect(child.fields.description.type.elemID.name).toBe('string')
    })

    it('should fetch metadata instances with namespace using retrieve', async () => {
      mockSingleMetadataType('ApexPage', [])
      const namespaceName = 'th_con_app'
      mockSingleMetadataInstance('th_con_app__ThHomepage', { fullName: 'th_con_app__ThHomepage' }, namespaceName,
        // encoded zip with a package.xml and an packaged ApexPage named th_con_app__ThHomepage
        'UEsDBBQACAgIANNsjE8AAAAAAAAAAAAAAAAsAAAAdW5wYWNrYWdlZC9wYWdlcy90aF9jb25fYXBwX19UaEhvbWVwYWdlLnBhZ2WtV/9u2zYQ/n9PwTgrkhSWZSdN0jiKV3RZsALFNiQZiv1lUORZIiyRAkklcYsAfY293p5kR9lWrV+OO4wFDJVH8r777rsjE9AMnsYZjYAYwSGk+qo3o4mBHjGWSk41v7OLBEwMYM3aNvmB4Ch+AuPMywk33s2UtN6MMiBfyklCVrOpSBZjcnCvqUhioPy9SvjB5cY6o9mY5Do5PPiy9+ftx5vfbw9/vAWjcs1gYOMpU3JKs2w6tbHbq+zs6Png6JL89yPs8ggHUafUHh5YnYNdZFA59rn8Kj9imyZ9Eiq+qESKBhBRbMdkNBy+utx2wsBtvhYPtf2Pgtu4vr37YDdSIb1ua0jZPNIql3xM9m9O3L9dCSp3FhxpyIBaksDMEqsysifSTGnUia06zCjnQkZeqKxV6ZgMt9NgYw99Wiok6BoXm9AfY2Gh5kgZYYWSY4SWUCse6vYlkDE5Oc2eLttYPm1QSXUk8MAhoblVbTYPQ3cb6yeGSnPQnqZc5Mblob5gd2HY+KOK1Ic06pJW0/sqniZoLkyWUCy7MFFs/n381cjYWg/rNIK07YI+P331P3l3w8KT9WgiIlzA0CfonUTm0MWjGsBdu9NqpRGfASXVSMFL8RS6GVWU+ALSrAZ0Fw+jhtQ3QNe9l5/+axLmWK2ShJHk5LVfwbMyddfm/tnF++Ev1/WCePJMTLl6dDk8zp7wd0j2T24uTq9vttbOm++ldlvVdlV62RxeTAmSc49ya2fFc0rsV9K2QRnttoxj9dBoeBUp3lG8efFeYnBHpfFuIcoTqruTe1anjalEadf0i1G1Jdhuy0vjuMH4tvoq7RyY0nSZGKkkdEnrN2Whzp50c1sUNZvNGOddKdOQ7q6gZUoDf+OtUtoCjhcwS6jB183mRdSbVI4PioeSSN1LCe/Oq96Ld6fr4EfP7h2FTn9eO1j19R7xq+dXnTUxYQZqiIqF8WjyCRKmUsDaJwvEQcr2Rf7Atr+kM/BxYXN31pxz4xMQpvGiB05sLMyGDInSEQGTARM0SRbuzeSc7pG/VE4YlYQrgoYlkBjfj8ZDpbMY50BGYIoN3wBqJz681DQMmuD8FnStcINsgyunqhaiinXhJMgnTorjwM8ngR9OyJ2QGNVihZ4yBsYsg3aRcqGBWRenVuk33P1iA1fyn69/I3z6UJD/qLReEBqqHF9IKsJ2FBEhB+TDrFgOrtaRHgmOVuWWoJkcwiAa9N2EkPjiRu4oqpzNUWdH/Y54KYk1zK56sbWZGft+kZoBBzMfoBJ8lht8dYH2i7dZ4lNtBcMM+sdnpxfnJ2+9WD3iG8aLAAvcy5A5hM49PMVLF55dR+llpXx+CqeCX41O3py/7U0KdlZnBj5t59qgD1PEjR8uupnAW6WQRW5AS4qCRXlgNzdgl/NrIE0pdMqhVRJdqkaJYr40FHpzkDD+UqN9YjCDgAswAwm4lDrwLi12EITanxQ/u6m0MFRLeNnzO4RZrK8ntczDwJTl59LbIxbvOrBXvWmYUDnfcmYnjuLKemGjG/d0DgQz5fqy46KsgL3tPn10uiXULtF07OtKaNDW09bjV+zCC1KQaPZIV+dob4v1nNZwrf6LYaz/dp78C1BLBwiHZRAiuAQAAEcPAABQSwMEFAAICAgA02yMTwAAAAAAAAAAAAAAADUAAAB1bnBhY2thZ2VkL3BhZ2VzL3RoX2Nvbl9hcHBfX1RoSG9tZXBhZ2UucGFnZS1tZXRhLnhtbHWPwWrDMBBE7/4Ko3ssJQ0lFFmml9DcQnB638prW1TSKpYS/PkVOIZS6B4fb2YZ2czOlg+coiFfs20lWIleU2f8ULNre9wcWKMK+R5wPsOAZdZ9rNmYUnjjPBKEKvY0aaw0Ob4T4pWLPXeYoIMETBVlPgnBfC4/1MuhEpL/Ak/jAcbCl8WTb+muR9WDjZjFv3zRNfneTA5SbmjpG/0Fb3czYbfm/heWgtyJVrXjBzkMeZjkCykkX7eq4gdQSwcI4/t3oLsAAAAeAQAAUEsDBBQACAgIANNsjE8AAAAAAAAAAAAAAAAWAAAAdW5wYWNrYWdlZC9wYWNrYWdlLnhtbE2Pyw6CMBBF93xF071MNYQYU0rcGJcscN3UMgLRPkIbg38v4RGd1ZzMnXtneDmaF3njEHpnC7pPGSVotWt62xb0Vl92R1qKhFdKP1WLZFLbUNAuRn8CCE75NDzcoDHVzsCBsRxYBgajalRUVCRkKh4/HsPSz2zQ3KdIETupnZXKeynr7uoM+imEwzb/bVhlUJw9jtUsmHHxhj9zvj4isjxlHDZKOKz3i+QLUEsHCJYMNSyqAAAA8QAAAFBLAQIUABQACAgIANNsjE+HZRAiuAQAAEcPAAAsAAAAAAAAAAAAAAAAAAAAAAB1bnBhY2thZ2VkL3BhZ2VzL3RoX2Nvbl9hcHBfX1RoSG9tZXBhZ2UucGFnZVBLAQIUABQACAgIANNsjE/j+3eguwAAAB4BAAA1AAAAAAAAAAAAAAAAABIFAAB1bnBhY2thZ2VkL3BhZ2VzL3RoX2Nvbl9hcHBfX1RoSG9tZXBhZ2UucGFnZS1tZXRhLnhtbFBLAQIUABQACAgIANNsjE+WDDUsqgAAAPEAAAAWAAAAAAAAAAAAAAAAADAGAAB1bnBhY2thZ2VkL3BhY2thZ2UueG1sUEsFBgAAAAADAAMAAQEAAB4HAAAAAA==')

      const result = await adapter.fetch()
      const [testInst] = findElements(result, 'apex_page', 'th_con_app___th_homepage')
      expect(testInst).toBeDefined()
      expect(testInst.path).toEqual(['installed_packages', namespaceName, 'records', 'apex_page', 'th_con_app___th_homepage'])
    })

    it('should fetch metadata instances with namespace', async () => {
      mockSingleMetadataType('Test', [])
      const namespaceName = 'asd'
      mockSingleMetadataInstance('Test', { fullName: 'asd__Test' }, namespaceName)

      const result = await adapter.fetch()
      const [testInst] = findElements(result, 'test', 'asd___test')
      expect(testInst).toBeDefined()
      expect(testInst.path).toEqual(['installed_packages', namespaceName, 'records', 'test', 'asd___test'])
    })

    it('should fetch metadata instances with namespace when fullname already includes the namespace', async () => {
      const namespaceName = 'asd'
      mockSingleMetadataType('Test', [])
      mockSingleMetadataInstance('asd__Test', { fullName: 'asd__Test' }, namespaceName)

      const result = await adapter.fetch()
      const [testInst] = findElements(result, 'test', 'asd___test')
      expect(testInst).toBeDefined()
      expect(testInst.path).toEqual(['installed_packages', namespaceName, 'records', 'test', 'asd___test'])
    })

    describe('should fetch when there are errors', () => {
      let result: Element[] = []
      beforeEach(async () => {
        connection.describeGlobal = jest.fn().mockImplementation(async () => ({ sobjects: [] }))
        connection.metadata.describe = jest.fn().mockImplementation(async () => ({
          metadataObjects: [{ xmlName: 'Test1' }, { xmlName: 'Test2' }, { xmlName: 'Test3' }],
        }))
        connection.metadata.describeValueType = jest.fn().mockImplementation(
          async (typeName: string) => {
            if (typeName.endsWith('Test1')) {
              throw new Error('fake error')
            }
            return { valueTypeFields: [] }
          }
        )
        connection.metadata.list = jest.fn().mockImplementation(
          async () => [{ fullName: 'instance1' }]
        )
        connection.metadata.read = jest.fn().mockImplementation(
          async (typeName: string, fullNames: string | string[]) => {
            if (typeName === 'Test2') {
              throw new Error('fake error')
            }
            return { fullName: Array.isArray(fullNames) ? fullNames[0] : fullNames }
          }
        )
        result = await adapter.fetch()
      })

      it('should fetch types when there is failure in a type', () => {
        expect(findElements(result, 'test_1')).toHaveLength(0)
        expect(findElements(result, 'test_2')).toHaveLength(1)
        expect(findElements(result, 'test_3')).toHaveLength(1)
      })

      it('should fetch instances when there is failure in an instance', () => {
        expect(findElements(result, 'test_2', 'instance_1')).toHaveLength(0)
        expect(findElements(result, 'test_3', 'instance_1')).toHaveLength(1)
      })
    })
  })
})
