/*
*                      Copyright 2021 Salto Labs Ltd.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with
* the License.  You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
import _ from 'lodash'
import {
  ElemID, ObjectType, ServiceIds, BuiltinTypes, Element, InstanceElement, isObjectType,
  CORE_ANNOTATIONS, Value, isInstanceElement,
  ReferenceExpression, isListType, FieldDefinition, toChange, Change, ModificationChange,
  getChangeElement,
} from '@salto-io/adapter-api'
import SalesforceClient from '../../src/client/client'
import Connection from '../../src/client/jsforce'
import {
  FIELD_ANNOTATIONS, FILTER_ITEM_FIELDS, SALESFORCE, METADATA_TYPE,
  CUSTOM_OBJECT, INSTANCE_FULL_NAME_FIELD, LABEL, NAMESPACE_SEPARATOR,
  API_NAME, FORMULA, LOOKUP_FILTER_FIELDS, CUSTOM_SETTINGS_TYPE,
  FIELD_DEPENDENCY_FIELDS, VALUE_SETTINGS_FIELDS, VALUE_SET_FIELDS,
  CUSTOM_VALUE, VALUE_SET_DEFINITION_FIELDS,
  OBJECTS_PATH, INSTALLED_PACKAGES_PATH, TYPES_PATH, RECORDS_PATH, WORKFLOW_METADATA_TYPE,
  ASSIGNMENT_RULES_METADATA_TYPE, LEAD_CONVERT_SETTINGS_METADATA_TYPE, QUICK_ACTION_METADATA_TYPE,
  CUSTOM_TAB_METADATA_TYPE, CUSTOM_OBJECT_TRANSLATION_METADATA_TYPE, SHARING_RULES_TYPE,
} from '../../src/constants'
import mockAdapter from '../adapter'
import { findElements, createValueSetEntry } from '../utils'
import { mockTypes } from '../mock_elements'
import filterCreator, {
  INSTANCE_REQUIRED_FIELD, INSTANCE_TYPE_FIELD, NESTED_INSTANCE_VALUE_TO_TYPE_NAME,
  CUSTOM_OBJECT_TYPE_ID, NESTED_INSTANCE_VALUE_NAME, NESTED_INSTANCE_TYPE_NAME,
} from '../../src/filters/custom_objects'
import { FilterWith } from '../../src/filter'
import { isCustom, Types, createInstanceElement, MetadataTypeAnnotations, metadataType } from '../../src/transformers/transformer'
import { DEPLOY_WRAPPER_INSTANCE_MARKER } from '../../src/metadata_deploy'
import { WORKFLOW_DIR_NAME } from '../../src/filters/workflow'
import { buildFetchProfile } from '../../src/fetch_profile/fetch_profile'

describe('Custom Objects filter', () => {
  let connection: Connection
  let client: SalesforceClient

  const mockGetElemIdFunc = (adapterName: string, _serviceIds: ServiceIds, name: string):
    ElemID => new ElemID(adapterName, name)

  let filter: FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>
  let result: Element[]

  const generateCustomObjectType = (): ObjectType => {
    const generateInnerMetadataTypeFields = (name: string): Record<string, FieldDefinition> => {
      if (name === NESTED_INSTANCE_VALUE_NAME.LIST_VIEWS) {
        const listViewFilterElemId = new ElemID(SALESFORCE, 'ListViewFilter')
        return {
          [INSTANCE_FULL_NAME_FIELD]: { type: BuiltinTypes.STRING },
          columns: { type: BuiltinTypes.STRING },
          filters: {
            type: new ObjectType({
              elemID: listViewFilterElemId,
              fields: {
                field: { type: BuiltinTypes.STRING },
                value: { type: BuiltinTypes.STRING },
              },
            }),
          },
        }
      }
      if (name === NESTED_INSTANCE_VALUE_NAME.FIELD_SETS) {
        return {
          availableFields: { type: BuiltinTypes.STRING },
          displayedFields: { type: BuiltinTypes.STRING },
          [INSTANCE_FULL_NAME_FIELD]: { type: BuiltinTypes.STRING },
        }
      }
      if (name === NESTED_INSTANCE_VALUE_NAME.COMPACT_LAYOUTS) {
        return {
          fields: { type: BuiltinTypes.STRING },
          [INSTANCE_FULL_NAME_FIELD]: { type: BuiltinTypes.STRING },
        }
      }
      return {}
    }

    const innerMetadataTypesFromInstance = Object.fromEntries(
      Object.entries(NESTED_INSTANCE_VALUE_TO_TYPE_NAME)
        .map(([annotationName, typeName]) => ([
          annotationName,
          {
            type: new ObjectType({
              elemID: new ElemID(SALESFORCE, typeName),
              fields: generateInnerMetadataTypeFields(annotationName),
              annotations: { metadataType: typeName } as MetadataTypeAnnotations,
            }),
          },
        ]))
    )

    return new ObjectType({
      elemID: CUSTOM_OBJECT_TYPE_ID,
      fields: {
        ...innerMetadataTypesFromInstance,
        [INSTANCE_FULL_NAME_FIELD]: { type: BuiltinTypes.STRING },
        pluralLabel: { type: BuiltinTypes.STRING },
        enableFeeds: { type: BuiltinTypes.BOOLEAN },
        [CUSTOM_SETTINGS_TYPE]: { type: BuiltinTypes.STRING },
      },
      annotations: {
        [METADATA_TYPE]: CUSTOM_OBJECT,
      },
    })
  }

  let customObjectType: ObjectType
  describe('onFetch', () => {
    beforeEach(() => {
      ({ connection, client } = mockAdapter({
        adapterParams: {
          getElemIdFunc: mockGetElemIdFunc,
        },
      }))
      filter = filterCreator({
        client,
        config: {
          unsupportedSystemFields: ['UnsupportedField'],
          systemFields: ['SystemField', 'NameSystemField'],
          fetchProfile: buildFetchProfile({}),
        },
      }) as typeof filter
      customObjectType = generateCustomObjectType()

      const leadInstance = new InstanceElement(
        CUSTOM_OBJECT,
        new ObjectType(
          {
            elemID: mockGetElemIdFunc(SALESFORCE, {}, CUSTOM_OBJECT),
            annotations: { [METADATA_TYPE]: CUSTOM_OBJECT },
          },
        ),
        {
          [INSTANCE_FULL_NAME_FIELD]: 'Lead',
          fields: [
            {
              [INSTANCE_FULL_NAME_FIELD]: 'ExtraSalt',
              [INSTANCE_TYPE_FIELD]: 'Checkbox',
              [INSTANCE_REQUIRED_FIELD]: 'false',
            },
            {
              [INSTANCE_FULL_NAME_FIELD]: 'WhoKnows',
            },
            {
              [INSTANCE_FULL_NAME_FIELD]: 'Pepper',
              [INSTANCE_TYPE_FIELD]: 'Location',
              [INSTANCE_REQUIRED_FIELD]: 'false',
            },
          ],
        },
      )
      result = [customObjectType, leadInstance]
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
        await filter.onFetch(result)
        const leadElements = findElements(result, 'Lead')
        expect(leadElements).toHaveLength(1)
        // Standard fields
        const leadObj = leadElements
          .find(elem => elem.path?.slice(-1)[0] === 'Lead') as ObjectType
        expect(leadObj).toBeDefined()
        expect(leadObj.fields.LastName.type.elemID.name).toBe('Text')
        expect(leadObj.fields.LastName.annotations.label).toBe('Last Name')
        // Test Required true and false
        expect(leadObj.fields.LastName.annotations[CORE_ANNOTATIONS.REQUIRED])
          .toBe(true)
        expect(leadObj.fields.FirstName.annotations[CORE_ANNOTATIONS.REQUIRED])
          .toBe(false)
        // Default string and boolean
        expect(leadObj.fields.LastName.annotations[FIELD_ANNOTATIONS.DEFAULT_VALUE])
          .toBe('BLABLA')
        expect(leadObj.fields.IsDeleted.annotations[FIELD_ANNOTATIONS.DEFAULT_VALUE])
          .toBe(false)

        // Custom type
        expect(leadObj.fields.Custom__c).not.toBeUndefined()
        expect(leadObj.fields.Custom__c.annotations[API_NAME]).toBe('Lead.Custom__c')
        expect(leadObj.fields.Custom__c.annotations[FIELD_ANNOTATIONS.DEFAULT_VALUE])
          .toBe(false)
        // Formula field
        expect(leadObj.fields.Formula__c).toBeDefined()
        expect(leadObj.fields.Formula__c.type.elemID.name).toBe('FormulaText')
        expect(leadObj.fields.Formula__c.annotations[FORMULA]).toBe('my formula')
      })

      it('should not fetch sobject if they are not in the received elements', async () => {
        mockSingleSObject('Lead', [])
        const elements = [customObjectType]
        await filter.onFetch(elements)
        expect(findElements(elements, 'Lead')).toHaveLength(0)
      })

      it('should fetch sobject with Name compound field', async () => {
        mockSingleSObject('Lead', [
          {
            name: 'Name',
            type: 'string',
            label: 'Full Name',
            nillable: false,
            nameField: true,
          },
          {
            name: 'LastName',
            type: 'string',
            label: 'Last Name',
            nillable: false,
            defaultValue: {
              $: { 'xsi:type': 'xsd:string' },
              _: 'BLABLA',
            },
            compoundFieldName: 'Name',
          },
          {
            name: 'FirstName',
            type: 'string',
            label: 'First Name',
            nillable: true,
            compoundFieldName: 'Name',
          },
          {
            name: 'Salutation',
            type: 'picklist',
            label: 'Salutation',
            nillable: false,
            picklistValues: [
              { value: 'Mrs.', defaultValue: false },
            ],
            restrictedPicklist: true,
            compoundFieldName: 'Name',
          },
        ])

        await filter.onFetch(result)
        const lead = findElements(result, 'Lead').pop() as ObjectType
        expect(lead).toBeDefined()
        expect(lead.fields.Name.type.elemID.name).toBe('Name')
        expect(lead.fields.Name.annotations.label).toBe('Full Name')
        expect(lead.fields.FirstName).toBe(undefined)
        expect(lead.fields.LastName).toBe(undefined)
      })

      it('should fetch sobject with Address compound field', async () => {
        mockSingleSObject('Lead', [
          {
            name: 'Address',
            type: 'string',
            label: 'Full Name',
            nillable: false,
            nameField: true,
          },
          {
            name: 'City',
            type: 'string',
            label: 'City',
            nillable: false,
            compoundFieldName: 'Address',
          },
          {
            name: 'Country',
            type: 'string',
            label: 'Country',
            nillable: true,
            compoundFieldName: 'Address',
          },
        ])

        await filter.onFetch(result)
        const lead = findElements(result, 'Lead').pop() as ObjectType
        expect(lead).toBeDefined()
        expect(lead.fields.Address.type.elemID.name).toBe('Address')
        expect(lead.fields.Address.annotations.label).toBe('Full Name')
        expect(lead.fields.City).toBe(undefined)
        expect(lead.fields.Country).toBe(undefined)
      })
      it('should fetch sobject with Name compound field without salutation', async () => {
        mockSingleSObject('Lead', [
          {
            name: 'Name',
            type: 'string',
            label: 'Full Name',
            nillable: false,
            nameField: true,
          },
          {
            name: 'LastName',
            type: 'string',
            label: 'Last Name',
            nillable: false,
            defaultValue: {
              $: { 'xsi:type': 'xsd:string' },
              _: 'BLABLA',
            },
            compoundFieldName: 'Name',
          },
          {
            name: 'FirstName',
            type: 'string',
            label: 'First Name',
            nillable: true,
            compoundFieldName: 'Name',
          },
        ])

        await filter.onFetch(result)
        const lead = findElements(result, 'Lead').pop() as ObjectType
        expect(lead).toBeDefined()
        expect(lead.fields.Name.type.elemID.name).toBe('Name2')
        expect(lead.fields.Name.annotations.label).toBe('Full Name')
        expect(lead.fields.FirstName).toBe(undefined)
        expect(lead.fields.LastName).toBe(undefined)
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
        await filter.onFetch(result)

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
        await filter.onFetch(result)

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
        await filter.onFetch(result)

        const lead = findElements(result, 'Lead').pop() as ObjectType
        expect(lead.fields.NumberField.type.elemID.name).toBe('Number')
      })

      it('should add fields from metadata if they are missing in the sobject', async () => {
        mockSingleSObject('Lead', [
          {
            name: 'NumberField',
            type: 'double',
            label: 'Numero',
            nillable: true,
          },
        ])

        await filter.onFetch(result)

        const lead = findElements(result, 'Lead').pop() as ObjectType
        expect(lead.fields.NumberField.type.elemID.name).toBe('Number')
        expect(lead.fields.ExtraSalt.type.elemID.name).toBe('Checkbox')
        expect(lead.fields.Pepper.type.elemID.name).toBe('Geolocation')
        expect(lead.fields.WhoKnows.type.elemID.name).toBe('Unknown')
      })

      it('should fetch sobject with apiName and metadataType service ids', async () => {
        mockSingleSObject('Lead', [])
        await filter.onFetch(result)
        const lead = findElements(result, 'Lead').pop() as ObjectType
        expect(lead.annotationTypes[API_NAME]).toEqual(BuiltinTypes.SERVICE_ID)
        expect(lead.annotationTypes[METADATA_TYPE]).toEqual(BuiltinTypes.SERVICE_ID)
        expect(lead.annotations[API_NAME]).toEqual('Lead')
        expect(lead.annotations[METADATA_TYPE]).toEqual(CUSTOM_OBJECT)
      })

      it('should fetch sobject with label', async () => {
        mockSingleSObject('Lead', [], false, true, false, 'Lead Label')
        await filter.onFetch(result)
        const lead = findElements(result, 'Lead').pop() as ObjectType
        expect(lead.annotations[LABEL]).toEqual('Lead Label')
      })

      it('should use existing elemID when fetching custom object', async () => {
        ({ connection, client } = mockAdapter({
          adapterParams: {
            getElemIdFunc: (adapterName: string, _serviceIds: ServiceIds, name: string):
              ElemID => new ElemID(adapterName, isCustom(name) ? name.slice(0, -3) : name),
          },
        }))
        mockSingleSObject('Custom__c', [
          {
            name: 'StringField__c',
            type: 'string',
            label: 'Stringo',
          },
        ])

        const instance = new InstanceElement(
          'Custom__c',
          new ObjectType({
            elemID: new ElemID(SALESFORCE, CUSTOM_OBJECT),
            annotations: { [METADATA_TYPE]: CUSTOM_OBJECT },
          }),
          { [INSTANCE_FULL_NAME_FIELD]: 'Custom__c' },
        )
        const elements: Element[] = [instance]

        const newFilter = filterCreator({
          client,
          config: { fetchProfile: buildFetchProfile({}) },
        }) as typeof filter
        await newFilter.onFetch(elements)

        const custom = elements.filter(o => o.elemID.name === 'Custom').pop() as ObjectType
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
        await filter.onFetch(result)

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

      it('should fetch sobject with system fields as hidden and not required, creatable and updateable', async () => {
        mockSingleSObject('Lead', [
          {
            name: 'SystemField',
            type: 'encryptedstring',
            label: 'Encrypto Stringo',
            createable: true,
            updateable: true,
            required: true,
          },
        ])
        await filter.onFetch(result)

        const lead = findElements(result, 'Lead').pop() as ObjectType
        expect(lead.fields.SystemField.annotations[CORE_ANNOTATIONS.REQUIRED]).toBeFalsy()
        expect(lead.fields.SystemField.annotations[FIELD_ANNOTATIONS.CREATABLE]).toBeFalsy()
        expect(lead.fields.SystemField.annotations[FIELD_ANNOTATIONS.UPDATEABLE]).toBeFalsy()
        expect(lead.fields.SystemField.annotations[CORE_ANNOTATIONS.HIDDEN_VALUE]).toBeTruthy()
      })

      it('should fetch sobject with nameField system fields with original required/createable/updateable values', async () => {
        mockSingleSObject('Lead', [
          {
            name: 'NameSystemField',
            type: 'encryptedstring',
            label: 'Encrypto Stringo',
            createable: true,
            updateable: true,
            required: true,
            nameField: true,
          },
        ])
        await filter.onFetch(result)

        const lead = findElements(result, 'Lead').pop() as ObjectType
        expect(lead.fields.NameSystemField.annotations[CORE_ANNOTATIONS.REQUIRED]).toBeTruthy()
        expect(lead.fields.NameSystemField.annotations[FIELD_ANNOTATIONS.CREATABLE]).toBeTruthy()
        expect(lead.fields.NameSystemField.annotations[FIELD_ANNOTATIONS.UPDATEABLE]).toBeTruthy()
        expect(
          lead.fields.NameSystemField.annotations[CORE_ANNOTATIONS.HIDDEN_VALUE]
        ).toBeUndefined()
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

        await filter.onFetch(result)

        const testElements = findElements(result, 'Test') as ObjectType[]
        expect(testElements).toHaveLength(0)
      })

      it('should fetch packaged custom SObjects', async () => {
        const namespaceName = 'namespaceName'
        const fieldWithNamespaceName = `${namespaceName}${NAMESPACE_SEPARATOR}WithNamespace__c`
        const objectName = `${namespaceName}${NAMESPACE_SEPARATOR}Test__c`
        mockSingleSObject(objectName, [
          {
            name: 'dummy', label: 'dummy', type: 'string',
          },
          {
            name: 'CustomField__c', label: 'custom field', type: 'string', custom: true,
          },
          {
            name: fieldWithNamespaceName, label: 'custom field', type: 'string', custom: true,
          },
        ], false, true, true)

        const instance = new InstanceElement(
          objectName,
          new ObjectType({
            elemID: new ElemID(SALESFORCE, CUSTOM_OBJECT),
            annotations: { [METADATA_TYPE]: CUSTOM_OBJECT },
          }),
          { [INSTANCE_FULL_NAME_FIELD]: objectName },
        )
        const elements = [instance]

        await filter.onFetch(elements)

        const testElements = findElements(elements, 'namespaceName__Test__c') as ObjectType[]
        expect(testElements).toHaveLength(1)
        const object = testElements.find(obj =>
          _.isEqual(obj.path, [SALESFORCE, INSTALLED_PACKAGES_PATH, namespaceName, OBJECTS_PATH,
            'namespaceName__Test__c', 'namespaceName__Test__c'])) as ObjectType
        expect(object).toBeDefined()
        expect(object.annotations[API_NAME]).toBeDefined()
        expect(object.fields.dummy).toBeDefined()
        expect(object.fields[fieldWithNamespaceName]).toBeDefined()
      })

      it('should fetch sobject with packaged and not packaged custom field', async () => {
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

        await filter.onFetch(result)

        const leadElements = findElements(result, 'Lead') as ObjectType[]
        expect(leadElements).toHaveLength(1)
        const object = leadElements.find(obj =>
          _.isEqual(obj.path, [SALESFORCE, OBJECTS_PATH, 'Lead', 'Lead'])) as ObjectType
        expect(object).toBeDefined()
        expect(object.annotations[API_NAME]).toBeDefined()
        expect(object.fields.CustomField__c).toBeDefined()
        expect(object.fields.namespaceName__PackagedField__c).toBeDefined()
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

        await filter.onFetch(result)

        const flow = findElements(result, 'flow').pop() as ObjectType
        expect(flow).toBeDefined() // We do expect to get the metadata type here
        expect(Object.keys(flow.fields)).toHaveLength(0)
        expect(flow.path).toEqual([SALESFORCE, TYPES_PATH, 'flow'])
      })

      describe('Merge elements', () => {
        const testInstanceElement = new InstanceElement('Lead', new ObjectType(
          {
            elemID: mockGetElemIdFunc(SALESFORCE, {}, CUSTOM_OBJECT),
            annotations: { [METADATA_TYPE]: CUSTOM_OBJECT },
          }
        ),
        { fields: [
          {
            [INSTANCE_FULL_NAME_FIELD]: 'MyAutoNumber',
            [INSTANCE_TYPE_FIELD]: 'AutoNumber',
            [FIELD_ANNOTATIONS.DISPLAY_FORMAT]: 'A-{0000}',
            [INSTANCE_REQUIRED_FIELD]: 'false',
          },
          {
            [INSTANCE_FULL_NAME_FIELD]: 'UnsupportedField',
            [INSTANCE_TYPE_FIELD]: 'DateTime',
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
            await filter.onFetch(result)

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
            expect(
              lookupFilterOptinalAnnotation[LOOKUP_FILTER_FIELDS.ERROR_MESSAGE]
            ).toBeUndefined()
          })

          describe('when instance exist but no object returned from soap API', () => {
            it('should create custom object from a custom object instance with custom fields', async () => {
              const leadInstanceWithCustomFields = testInstanceElement.clone()
              leadInstanceWithCustomFields.value.fields = {
                [INSTANCE_FULL_NAME_FIELD]: 'MyAutoNumber__c',
                [INSTANCE_TYPE_FIELD]: 'AutoNumber',
                [FIELD_ANNOTATIONS.DISPLAY_FORMAT]: 'A-{0000}',
                [INSTANCE_REQUIRED_FIELD]: 'false',
              }
              result.push(leadInstanceWithCustomFields)
              await filter.onFetch(result)

              const leadElements = result.filter(o => o.elemID.name === 'Lead')
              expect(leadElements).toHaveLength(1)
              const leadObj = leadElements.find(obj =>
                _.isEqual(obj.path, [SALESFORCE, OBJECTS_PATH, 'Lead', 'Lead'])) as ObjectType
              expect(leadObj).toBeDefined()
              expect(leadObj.fields.MyAutoNumber__c
                .annotations[FIELD_ANNOTATIONS.DISPLAY_FORMAT]).toBe('A-{0000}')
            })

            it('should create custom object from a custom object instance with standard fields', async () => {
              result.push(testInstanceElement)
              await filter.onFetch(result)

              const leadElements = result.filter(o => o.elemID.name === 'Lead')
              expect(leadElements).toHaveLength(1)
              const leadStandardFieldsObj = leadElements.find(obj =>
                _.isEqual(obj.path, [SALESFORCE, OBJECTS_PATH, 'Lead', 'Lead'])) as ObjectType
              expect(leadStandardFieldsObj).toBeDefined()
              expect(leadStandardFieldsObj.fields.MyAutoNumber
                .annotations[FIELD_ANNOTATIONS.DISPLAY_FORMAT]).toBe('A-{0000}')
            })

            it('should create custom object from a custom object instance without unsupported fields', async () => {
              result.push(testInstanceElement)
              await filter.onFetch(result)

              const leadElements = result.filter(o => o.elemID.name === 'Lead')
              expect(leadElements).toHaveLength(1)
              const leadStandardFieldsObj = leadElements.find(obj =>
                _.isEqual(obj.path, [SALESFORCE, OBJECTS_PATH, 'Lead', 'Lead'])) as ObjectType
              expect(leadStandardFieldsObj).toBeDefined()
              expect(leadStandardFieldsObj.fields.UnsupportedField).toBeUndefined()
            })

            it('should create custom object from a packaged custom object instance', async () => {
              const leadInstanceWithCustomFields = testInstanceElement.clone()
              leadInstanceWithCustomFields.value[INSTANCE_FULL_NAME_FIELD] = 'myNamespace__Lead__c'
              result.push(leadInstanceWithCustomFields)
              await filter.onFetch(result)

              const leadElements = result.filter(o => o.elemID.name === 'myNamespace__Lead__c')
              expect(leadElements).toHaveLength(1)
              const leadObj = leadElements.find(obj =>
                _.isEqual(obj.path, [SALESFORCE, INSTALLED_PACKAGES_PATH, 'myNamespace', OBJECTS_PATH,
                  'myNamespace__Lead__c', 'myNamespace__Lead__c'])) as ObjectType
              expect(leadObj).toBeDefined()
              expect(leadObj.fields.MyAutoNumber
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
                [NESTED_INSTANCE_VALUE_NAME.WEB_LINKS]: {
                  [INSTANCE_FULL_NAME_FIELD]: 'WebLinkFullName',
                  linkType: 'javascript',
                  url: '',
                },
                pluralLabel: 'Leads',
                enableFeeds: 'True',
              })
          })

          it('should modify the customObjectType', async () => {
            await filter.onFetch(result)

            const listViewType = customObjectType
              .fields[NESTED_INSTANCE_VALUE_NAME.LIST_VIEWS].type as ObjectType
            expect(isListType(listViewType.fields.columns.type)).toBeTruthy()
            expect(isListType(listViewType.fields.filters.type)).toBeTruthy()

            const fieldSetType = customObjectType
              .fields[NESTED_INSTANCE_VALUE_NAME.FIELD_SETS].type as ObjectType
            expect(isListType(fieldSetType.fields.availableFields.type)).toBeTruthy()
            expect(isListType(fieldSetType.fields.displayedFields.type)).toBeTruthy()

            const compactLayoutType = customObjectType
              .fields[NESTED_INSTANCE_VALUE_NAME.COMPACT_LAYOUTS].type as
              ObjectType
            expect(isListType(compactLayoutType.fields.fields.type)).toBeTruthy()
          })

          it('should remove the custom object type and its instances from the fetch result', async () => {
            mockSingleSObject('Lead', [], false, true, false, 'Instance Label')
            result.push(customObjectInstance)
            await filter.onFetch(result)
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
                [METADATA_TYPE]: CUSTOM_OBJECT,
              } })
            const platformEventObj = new ObjectType({ elemID: new ElemID(SALESFORCE, 'PlatformEvent'),
              annotations: {
                [API_NAME]: 'PlatformEvent__e',
                [METADATA_TYPE]: CUSTOM_OBJECT,
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
            await filter.onFetch(result)
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
            await filter.onFetch(result)
            const lead = result.filter(o => o.elemID.name === 'Lead').pop()
            expect(lead).toBeDefined()
            expect(isObjectType(lead)).toBeTruthy()
            const leadObjectType = lead as ObjectType
            expect(leadObjectType.annotationTypes[INSTANCE_FULL_NAME_FIELD]).toBeUndefined()
          })

          it('should merge regular instance element annotations into the standard-custom object type', async () => {
            mockSingleSObject('Lead', [], false, true, false, 'Instance Label')
            result.push(customObjectInstance)
            await filter.onFetch(result)
            const lead = findElements(result, 'Lead').pop() as ObjectType
            expect(lead.annotationTypes.enableFeeds).toBeDefined()
            expect(lead.annotations.enableFeeds).toBeTruthy()
            expect(lead.annotationTypes.pluralLabel).toBeUndefined()
            expect(lead.annotations.pluralLabel).toBeUndefined()
          })

          it('should merge regular instance element annotations into the custom settings-custom object type', async () => {
            const customSettingsInstance = customObjectInstance.clone()
            customSettingsInstance.value[CUSTOM_SETTINGS_TYPE] = 'Hierarchical'
            result.push(customSettingsInstance)
            await filter.onFetch(result)
            const lead = findElements(result, 'Lead').pop() as ObjectType
            expect(lead.annotationTypes.enableFeeds).toBeDefined()
            expect(lead.annotations.enableFeeds).toBeTruthy()
            expect(lead.annotationTypes.pluralLabel).toBeUndefined()
            expect(lead.annotations.customSettingsType).toBeDefined()
            expect(lead.annotations.customSettingsType).toEqual('Hierarchical')
          })

          it('should merge regular instance element annotations into the custom-custom object type', async () => {
            mockSingleSObject('Lead', [], false, true, true, 'Instance Label')
            result.push(customObjectInstance)
            await filter.onFetch(result)
            const lead = findElements(result, 'Lead').pop() as ObjectType
            expect(lead.annotationTypes.enableFeeds).toBeDefined()
            expect(lead.annotations.enableFeeds).toBeTruthy()
            expect(lead.annotationTypes.pluralLabel).toBeDefined()
            expect(lead.annotations.pluralLabel).toEqual('Leads')
          })

          it('should not merge nested instances into lead objects', async () => {
            mockSingleSObject('Lead', [], false, true, false, 'Instance Label')
            result.push(customObjectInstance)
            await filter.onFetch(result)
            const lead = findElements(result, 'Lead').pop() as ObjectType
            expect(lead.annotationTypes.listViews).toBeUndefined()
            expect(lead.annotations.listViews).toBeUndefined()
          })

          it('should create instance element for nested instances of custom object', async () => {
            mockSingleSObject('Lead', [], false, true, false, 'Instance Label')
            result.push(customObjectInstance)
            await filter.onFetch(result)
            const [leadListView] = result.filter(o => o.elemID.name === 'Lead_PartialListViewFullName')
            expect(isInstanceElement(leadListView)).toBeTruthy()
            const leadListViewsInstance = leadListView as InstanceElement
            expect(leadListViewsInstance.path)
              .toEqual([SALESFORCE, OBJECTS_PATH, 'Lead', 'ListView', leadListViewsInstance.elemID.name])
            expect(leadListViewsInstance.value.columns).toEqual('ListViewName')
            expect(leadListViewsInstance.value[INSTANCE_FULL_NAME_FIELD]).toEqual('Lead.PartialListViewFullName')
          })

          it('should change path of nested instances listed in nestedMetadatatypeToReplaceDirName', async () => {
            mockSingleSObject('Lead', [], false, true, false, 'Instance Label')
            result.push(customObjectInstance)
            await filter.onFetch(result)
            const [leadWebLink] = result.filter(o => o.elemID.name === 'Lead_WebLinkFullName')
            const leadWebLinkInstance = (leadWebLink as InstanceElement)
            expect(leadWebLinkInstance.path).toEqual([SALESFORCE, OBJECTS_PATH, 'Lead', 'ButtonsLinksAndActions',
              leadWebLinkInstance.elemID.name])
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
            await filter.onFetch(result)

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
              const customSettingsObjectInstance = customObjectInstance.clone()
              customSettingsObjectInstance.value.customSettingsType = 'Hierarchical'
              result.push(customSettingsObjectInstance)
              await filter.onFetch(result)
              const lead = findElements(result, 'Lead').pop() as ObjectType
              expect(lead.annotationTypes.enableFeeds).toBeDefined()
              expect(lead.annotations.enableFeeds).toBeTruthy()
              expect(lead.annotationTypes.apiName).toBeDefined()
              expect(lead.annotationTypes.pluralLabel).toBeUndefined()
              expect(lead.annotations.pluralLabel).toBeUndefined()
            })

            it('Should create proper custom settings object', async () => {
              const customSettingsObjectInstance = customObjectInstance.clone()
              customSettingsObjectInstance.value.customSettingsType = 'Hierarchical'
              result.push(customSettingsObjectInstance)
              await filter.onFetch(result)
              const lead = findElements(result, 'Lead').pop() as ObjectType
              expect(lead.annotationTypes.enableFeeds).toBeDefined()
              expect(lead.annotations.enableFeeds).toBeTruthy()
              expect(lead.annotationTypes.apiName).toBeDefined()
              expect(lead.annotationTypes.pluralLabel).toBeUndefined()
              expect(lead.annotations.pluralLabel).toBeUndefined()
            })

            it('should not merge nested instances into lead object', async () => {
              result.push(customObjectInstance)
              await filter.onFetch(result)
              const lead = findElements(result, 'Lead').pop() as ObjectType
              expect(lead.annotationTypes.listViews).toBeUndefined()
              expect(lead.annotations.listViews).toBeUndefined()
            })

            it('should create instance element for nested instances of custom object', async () => {
              result.push(customObjectInstance)
              await filter.onFetch(result)
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

    describe('fixDependentInstancesPathAndSetParent', () => {
      const leadType = new ObjectType({
        elemID: new ElemID(SALESFORCE, 'Lead'),
        annotations: {
          [API_NAME]: 'Lead',
          [METADATA_TYPE]: CUSTOM_OBJECT,
        },
        path: [SALESFORCE, OBJECTS_PATH, 'Lead', 'BLA'],
      })

      describe('Workflow', () => {
        const workflowType = new ObjectType({
          elemID: new ElemID(SALESFORCE, WORKFLOW_METADATA_TYPE),
          annotations: { [METADATA_TYPE]: WORKFLOW_METADATA_TYPE },
        })
        const workflowInstance = new InstanceElement('Lead',
          workflowType, { [INSTANCE_FULL_NAME_FIELD]: 'Lead' })

        beforeEach(async () => {
          await filter.onFetch([workflowInstance, workflowType, leadType])
        })

        it('should set workflow instance path correctly', async () => {
          expect(workflowInstance.path)
            .toEqual([SALESFORCE, OBJECTS_PATH, 'Lead', WORKFLOW_DIR_NAME, WORKFLOW_METADATA_TYPE])
        })

        it('should add PARENT annotation to workflow instance', async () => {
          expect(workflowInstance.annotations[CORE_ANNOTATIONS.PARENT])
            .toContainEqual(new ReferenceExpression(leadType.elemID))
        })
      })

      describe('AssignmentRules', () => {
        const assignmentRulesType = new ObjectType({
          elemID: new ElemID(SALESFORCE, ASSIGNMENT_RULES_METADATA_TYPE),
          annotations: { [METADATA_TYPE]: ASSIGNMENT_RULES_METADATA_TYPE },
        })
        const assignmentRulesInstance = new InstanceElement('LeadAssignmentRules',
          assignmentRulesType, { [INSTANCE_FULL_NAME_FIELD]: 'Lead' })

        beforeEach(async () => {
          await filter.onFetch([assignmentRulesInstance, assignmentRulesType, leadType])
        })

        it('should set assignmentRules instance path correctly', async () => {
          expect(assignmentRulesInstance.path)
            .toEqual([SALESFORCE, OBJECTS_PATH, 'Lead', ASSIGNMENT_RULES_METADATA_TYPE])
        })

        it('should add PARENT annotation to assignmentRules instance', async () => {
          expect(assignmentRulesInstance.annotations[CORE_ANNOTATIONS.PARENT])
            .toContainEqual(new ReferenceExpression(leadType.elemID))
        })
      })

      describe('LeadConvertSettings', () => {
        const leadConvertSettingsType = new ObjectType({
          elemID: new ElemID(SALESFORCE, LEAD_CONVERT_SETTINGS_METADATA_TYPE),
          annotations: { [METADATA_TYPE]: LEAD_CONVERT_SETTINGS_METADATA_TYPE },
        })
        const leadConvertSettingsInstance = new InstanceElement(LEAD_CONVERT_SETTINGS_METADATA_TYPE,
          leadConvertSettingsType,
          { [INSTANCE_FULL_NAME_FIELD]: LEAD_CONVERT_SETTINGS_METADATA_TYPE })

        beforeEach(async () => {
          await filter.onFetch([leadConvertSettingsInstance, leadConvertSettingsType, leadType])
        })

        it('should set leadConvertSettings instance path correctly', async () => {
          expect(leadConvertSettingsInstance.path)
            .toEqual([SALESFORCE, OBJECTS_PATH, 'Lead', LEAD_CONVERT_SETTINGS_METADATA_TYPE])
        })

        it('should add PARENT annotation to leadConvertSettings instance', async () => {
          expect(leadConvertSettingsInstance.annotations[CORE_ANNOTATIONS.PARENT])
            .toContainEqual(new ReferenceExpression(leadType.elemID))
        })
      })

      describe('QuickAction', () => {
        const createQuickActionInstance = (instanceName: string, instanceFullName: string):
          InstanceElement => {
          const quickActionType = new ObjectType({
            elemID: new ElemID(SALESFORCE, QUICK_ACTION_METADATA_TYPE),
            annotations: { [METADATA_TYPE]: QUICK_ACTION_METADATA_TYPE },
          })
          const quickActionInstance = new InstanceElement(instanceName,
            quickActionType,
            { [INSTANCE_FULL_NAME_FIELD]: instanceFullName },
            [SALESFORCE, RECORDS_PATH, QUICK_ACTION_METADATA_TYPE, instanceName])
          return quickActionInstance
        }

        describe('Related to a CustomObject', () => {
          const instanceName = 'Lead_DoSomething'
          const quickActionInstance = createQuickActionInstance(instanceName, 'Lead.DoSomething')
          beforeEach(async () => {
            await filter.onFetch([quickActionInstance, quickActionInstance.type, leadType])
          })

          it('should set quickAction instance path correctly', async () => {
            expect(quickActionInstance.path)
              .toEqual([SALESFORCE, OBJECTS_PATH, 'Lead', QUICK_ACTION_METADATA_TYPE, instanceName])
          })

          it('should add PARENT annotation to quickAction instance', async () => {
            expect(quickActionInstance.annotations[CORE_ANNOTATIONS.PARENT])
              .toContainEqual(new ReferenceExpression(leadType.elemID))
          })
        })

        describe('Not related to a CustomObject', () => {
          const instanceName = 'DoSomething'
          const quickActionInstance = createQuickActionInstance(instanceName, 'DoSomething')
          beforeEach(async () => {
            await filter.onFetch([quickActionInstance, quickActionInstance.type, leadType])
          })

          it('should not edit quickAction instance path', async () => {
            expect(quickActionInstance.path)
              .toEqual([SALESFORCE, RECORDS_PATH, QUICK_ACTION_METADATA_TYPE, instanceName])
          })

          it('should not add PARENT annotation to quickAction instance', async () => {
            expect(quickActionInstance.annotations).not.toHaveProperty(CORE_ANNOTATIONS.PARENT)
          })
        })
      })

      describe('CustomTab', () => {
        const customTabType = new ObjectType({
          elemID: new ElemID(SALESFORCE, CUSTOM_TAB_METADATA_TYPE),
          annotations: { [METADATA_TYPE]: CUSTOM_TAB_METADATA_TYPE },
        })
        const customTabInstance = new InstanceElement('Lead',
          customTabType, { [INSTANCE_FULL_NAME_FIELD]: 'Lead' })

        beforeEach(async () => {
          await filter.onFetch([customTabInstance, customTabType, leadType])
        })

        it('should set customTab instance path correctly', async () => {
          expect(customTabInstance.path)
            .toEqual([SALESFORCE, OBJECTS_PATH, 'Lead', CUSTOM_TAB_METADATA_TYPE])
        })

        it('should add PARENT annotation to customTab instance', async () => {
          expect(customTabInstance.annotations[CORE_ANNOTATIONS.PARENT])
            .toContainEqual(new ReferenceExpression(leadType.elemID))
        })
      })

      describe('CustomObjectTranslation', () => {
        const customObjectTranslationType = new ObjectType({
          elemID: new ElemID(SALESFORCE, CUSTOM_OBJECT_TRANSLATION_METADATA_TYPE),
          annotations: { [METADATA_TYPE]: CUSTOM_OBJECT_TRANSLATION_METADATA_TYPE },
        })
        const customObjectTranslationInstance = new InstanceElement('Lead_en_US',
          customObjectTranslationType, { [INSTANCE_FULL_NAME_FIELD]: 'Lead-en_US' })

        beforeEach(async () => {
          await filter.onFetch(
            [customObjectTranslationInstance, customObjectTranslationType, leadType]
          )
        })

        it('should set customObjectTranslation instance path correctly', async () => {
          expect(customObjectTranslationInstance.path)
            .toEqual([SALESFORCE, OBJECTS_PATH, 'Lead', CUSTOM_OBJECT_TRANSLATION_METADATA_TYPE,
              'Lead_en_US'])
        })

        it('should add PARENT annotation to customObjectTranslation instance', async () => {
          expect(customObjectTranslationInstance.annotations[CORE_ANNOTATIONS.PARENT])
            .toContainEqual(new ReferenceExpression(leadType.elemID))
        })
      })

      describe('SharingRules', () => {
        const sharingRulesType = new ObjectType({
          elemID: new ElemID(SALESFORCE, SHARING_RULES_TYPE),
          annotations: { [METADATA_TYPE]: SHARING_RULES_TYPE },
        })
        const sharingRulesInstance = new InstanceElement('Lead',
          sharingRulesType, { [INSTANCE_FULL_NAME_FIELD]: 'Lead' })

        beforeEach(async () => {
          await filter.onFetch([sharingRulesInstance, sharingRulesInstance, leadType])
        })

        it('should set instance path correctly', () => {
          expect(sharingRulesInstance.path)
            .toEqual([SALESFORCE, OBJECTS_PATH, 'Lead', SHARING_RULES_TYPE])
        })

        it('should add PARENT annotation to instance', () => {
          expect(sharingRulesInstance.annotations[CORE_ANNOTATIONS.PARENT])
            .toContainEqual(new ReferenceExpression(leadType.elemID))
        })
      })
    })
  })

  describe('preDeploy and onDeploy', () => {
    let testObject: ObjectType
    let parentAnnotation: Record<string, Element[]>
    beforeAll(() => {
      customObjectType = generateCustomObjectType()
      testObject = new ObjectType({
        elemID: new ElemID(SALESFORCE, 'Test'),
        fields: {
          MyField: {
            type: Types.primitiveDataTypes.Text,
            annotations: { [API_NAME]: 'Test__c.MyField__c' },
          },
          Master: {
            type: Types.primitiveDataTypes.MasterDetail,
            annotations: { [API_NAME]: 'Test__c.Master__c' },
          },
          SysField: {
            type: Types.primitiveDataTypes.AutoNumber,
            annotations: { [API_NAME]: 'Test__c.SysField' },
          },
        },
        annotationTypes: {
          [METADATA_TYPE]: BuiltinTypes.SERVICE_ID,
          [API_NAME]: BuiltinTypes.SERVICE_ID,
          [LABEL]: BuiltinTypes.STRING,
          sharingModel: BuiltinTypes.STRING,
        },
        annotations: {
          [METADATA_TYPE]: CUSTOM_OBJECT,
          [API_NAME]: 'Test__c',
          [LABEL]: 'TestObject',
          sharingModel: 'ControlledByParent',
        },
      })
      parentAnnotation = { [CORE_ANNOTATIONS.PARENT]: [testObject] }
    })
    describe('with inner instance addition', () => {
      let changes: Change[]
      let testFieldSet: InstanceElement
      beforeAll(async () => {
        filter = filterCreator({
          client,
          config: { fetchProfile: buildFetchProfile({}) },
        }) as typeof filter

        testFieldSet = createInstanceElement(
          { fullName: 'Test__c.MyFieldSet', description: 'my field set' },
          customObjectType.fields[NESTED_INSTANCE_VALUE_NAME.FIELD_SETS].type as ObjectType,
          undefined,
          parentAnnotation,
        )
        changes = [
          toChange({ after: testFieldSet }),
        ]
      })
      describe('preDeploy', () => {
        beforeAll(async () => {
          await filter.preDeploy(changes)
        })
        it('should create a change on the parent custom object', () => {
          expect(changes).toHaveLength(1)
          expect(changes[0].action).toEqual('modify')
          const { before, after } = ((changes[0]) as ModificationChange<InstanceElement>).data
          expect(before.value[NESTED_INSTANCE_VALUE_NAME.FIELD_SETS]).toHaveLength(0)
          expect(after.value[NESTED_INSTANCE_VALUE_NAME.FIELD_SETS]).toEqual(
            [{ ...testFieldSet.value, fullName: 'MyFieldSet' }]
          )
        })
        it('should mark the created custom object as a wrapper and not populate annotation values', () => {
          const inst = getChangeElement(changes[0]) as InstanceElement
          expect(inst.value).not.toHaveProperty(LABEL)
          expect(inst.value).toHaveProperty(DEPLOY_WRAPPER_INSTANCE_MARKER, true)
        })
      })
      describe('onDeploy', () => {
        beforeAll(async () => {
          await filter.onDeploy(changes)
        })
        it('should restore the original inner instance change', () => {
          expect(changes).toHaveLength(1)
          expect(changes).toContainEqual(toChange({ after: testFieldSet }))
        })
      })
    })
    describe('with removal side effects', () => {
      let changes: Change[]
      let sideEffectInst: InstanceElement
      beforeAll(() => {
        sideEffectInst = createInstanceElement(
          { fullName: 'SideEffect', description: 'desc' },
          mockTypes.Layout,
          undefined,
          parentAnnotation,
        )
        filter = filterCreator({
          client,
          config: { fetchProfile: buildFetchProfile({}) },
        }) as typeof filter
        changes = [
          toChange({ before: testObject }),
          toChange({ before: sideEffectInst }),
        ]
      })
      describe('preDeploy', () => {
        beforeAll(async () => {
          await filter.preDeploy(changes)
        })
        it('should omit side effect removals', () => {
          expect(changes).toHaveLength(1)
          expect(changes[0].action).toEqual('remove')
          const removedElem = getChangeElement(changes[0])
          expect(removedElem).toBeInstanceOf(InstanceElement)
          expect(metadataType(removedElem)).toEqual(CUSTOM_OBJECT)
        })
      })
      describe('onDeploy', () => {
        beforeAll(async () => {
          await filter.onDeploy(changes)
        })
        it('should return the side effect removal', () => {
          expect(changes).toHaveLength(2)
          expect(changes).toContainEqual(toChange({ before: testObject }))
          expect(changes).toContainEqual(toChange({ before: sideEffectInst }))
        })
      })
    })
    describe('with annotation value change', () => {
      let changes: Change[]
      let afterObj: ObjectType
      beforeAll(() => {
        filter = filterCreator({
          client,
          config: { fetchProfile: buildFetchProfile({}) },
        }) as typeof filter
        afterObj = testObject.clone()
        afterObj.annotations[LABEL] = 'New Label'
        changes = [
          toChange({ before: testObject, after: afterObj }),
        ]
      })
      describe('preDeploy', () => {
        beforeAll(async () => {
          await filter.preDeploy(changes)
        })
        it('should create a custom object instance change with annotations and master-detail fields', () => {
          expect(changes).toHaveLength(1)
          const { before, after } = changes[0].data as ModificationChange<InstanceElement>['data']
          expect(after.value.fields).toHaveLength(1)
          expect(after.value.fields[0].type).toEqual('MasterDetail')
          expect(after.value[LABEL]).toEqual('New Label')
          expect(before.value[LABEL]).toEqual('TestObject')
        })
      })
      describe('onDeploy', () => {
        beforeAll(async () => {
          await filter.onDeploy(changes)
        })
        it('should restore the custom object change', () => {
          expect(changes).toEqual([toChange({ before: testObject, after: afterObj })])
        })
      })
    })
  })
})
