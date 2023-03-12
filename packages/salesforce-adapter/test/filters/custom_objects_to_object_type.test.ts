/*
*                      Copyright 2023 Salto Labs Ltd.
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
  ElemID, ObjectType, BuiltinTypes, Element, InstanceElement, isObjectType,
  CORE_ANNOTATIONS, isInstanceElement,
  ReferenceExpression, isListType, FieldDefinition, toChange, Change, ModificationChange,
  getChangeData,
  isServiceId,
} from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import {
  FIELD_ANNOTATIONS, SALESFORCE, METADATA_TYPE,
  CUSTOM_OBJECT, INSTANCE_FULL_NAME_FIELD, LABEL, NAMESPACE_SEPARATOR,
  API_NAME, FORMULA, CUSTOM_SETTINGS_TYPE,
  VALUE_SET_FIELDS,
  VALUE_SET_DEFINITION_FIELDS, LIGHTNING_PAGE_TYPE,
  OBJECTS_PATH, INSTALLED_PACKAGES_PATH, RECORDS_PATH,
  ASSIGNMENT_RULES_METADATA_TYPE, LEAD_CONVERT_SETTINGS_METADATA_TYPE, QUICK_ACTION_METADATA_TYPE,
  CUSTOM_TAB_METADATA_TYPE, CUSTOM_OBJECT_TRANSLATION_METADATA_TYPE, SHARING_RULES_TYPE,
  FLEXI_PAGE_TYPE,
  DEFAULT_VALUE_FORMULA,
  FIELD_TYPE_NAMES,
  FIELD_DEPENDENCY_FIELDS,
  VALUE_SETTINGS_FIELDS,
  LOOKUP_FILTER_FIELDS,
  FILTER_ITEM_FIELDS,
} from '../../src/constants'
import { findElements, createValueSetEntry, defaultFilterContext } from '../utils'
import { mockTypes } from '../mock_elements'
import filterCreator, {
  INSTANCE_REQUIRED_FIELD, INSTANCE_TYPE_FIELD, NESTED_INSTANCE_VALUE_TO_TYPE_NAME,
  CUSTOM_OBJECT_TYPE_ID, NESTED_INSTANCE_VALUE_NAME, NESTED_INSTANCE_TYPE_NAME,
} from '../../src/filters/custom_objects_to_object_type'
import { FilterWith } from '../../src/filter'
import { Types, createInstanceElement, MetadataTypeAnnotations, metadataType, createMetadataObjectType } from '../../src/transformers/transformer'
import { DEPLOY_WRAPPER_INSTANCE_MARKER } from '../../src/metadata_deploy'
import { buildFetchProfile } from '../../src/fetch_profile/fetch_profile'


export const generateCustomObjectType = (): ObjectType => {
  const generateInnerMetadataTypeFields = (name: string): Record<string, FieldDefinition> => {
    if (name === NESTED_INSTANCE_VALUE_NAME.LIST_VIEWS) {
      const listViewFilterElemId = new ElemID(SALESFORCE, 'ListViewFilter')
      return {
        [INSTANCE_FULL_NAME_FIELD]: { refType: BuiltinTypes.STRING },
        columns: { refType: BuiltinTypes.STRING },
        filters: {
          refType: new ObjectType({
            elemID: listViewFilterElemId,
            fields: {
              field: { refType: BuiltinTypes.STRING },
              value: { refType: BuiltinTypes.STRING },
            },
          }),
        },
      }
    }
    if (name === NESTED_INSTANCE_VALUE_NAME.FIELD_SETS) {
      return {
        availableFields: { refType: BuiltinTypes.STRING },
        displayedFields: { refType: BuiltinTypes.STRING },
        [INSTANCE_FULL_NAME_FIELD]: { refType: BuiltinTypes.STRING },
      }
    }
    if (name === NESTED_INSTANCE_VALUE_NAME.COMPACT_LAYOUTS) {
      return {
        fields: { refType: BuiltinTypes.STRING },
        [INSTANCE_FULL_NAME_FIELD]: { refType: BuiltinTypes.STRING },
      }
    }
    return {}
  }

  const innerMetadataTypesFromInstance = Object.fromEntries(
    Object.entries(NESTED_INSTANCE_VALUE_TO_TYPE_NAME)
      .map(([annotationName, typeName]) => ([
        annotationName,
        {
          refType: new ObjectType({
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
      [INSTANCE_FULL_NAME_FIELD]: { refType: BuiltinTypes.STRING },
      pluralLabel: { refType: BuiltinTypes.STRING },
      enableFeeds: { refType: BuiltinTypes.BOOLEAN },
      [CUSTOM_SETTINGS_TYPE]: { refType: BuiltinTypes.STRING },
    },
    annotations: {
      [METADATA_TYPE]: CUSTOM_OBJECT,
    },
  })
}

describe('Custom Objects to Object Type filter', () => {
  let filter: FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>
  let result: Element[]

  let customObjectType: ObjectType
  let caseInstance: InstanceElement
  describe('onFetch', () => {
    beforeEach(() => {
      filter = filterCreator({
        config: {
          ...defaultFilterContext,
          unsupportedSystemFields: ['UnsupportedField'],
          systemFields: ['SystemField', 'NameSystemField'],
        },
      }) as typeof filter
      customObjectType = generateCustomObjectType()

      caseInstance = new InstanceElement(
        'Case',
        customObjectType,
        {
          [INSTANCE_FULL_NAME_FIELD]: 'Case',
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
      result = [customObjectType, caseInstance]
    })

    afterEach(() => {
      jest.resetAllMocks()
    })

    describe('should fetch SObjects', () => {
      it('should fetch sobject with primitive types, validate type, label, required and default annotations', async () => {
        caseInstance.value.fields.push(
          {
            [INSTANCE_FULL_NAME_FIELD]: 'LastName',
            [INSTANCE_TYPE_FIELD]: FIELD_TYPE_NAMES.TEXT,
            [INSTANCE_REQUIRED_FIELD]: true,
            [LABEL]: 'Last Name',
            [FIELD_ANNOTATIONS.DEFAULT_VALUE]: 'BLABLA',
          },
          {
            [INSTANCE_FULL_NAME_FIELD]: 'FirstName',
            [INSTANCE_TYPE_FIELD]: FIELD_TYPE_NAMES.TEXT,
          },
          {
            [INSTANCE_FULL_NAME_FIELD]: 'IsDeleted',
            [INSTANCE_TYPE_FIELD]: FIELD_TYPE_NAMES.CHECKBOX,
            [LABEL]: 'Is Deleted',
            [FIELD_ANNOTATIONS.DEFAULT_VALUE]: false,
          },
          {
            [INSTANCE_FULL_NAME_FIELD]: 'Custom__c',
            [INSTANCE_TYPE_FIELD]: FIELD_TYPE_NAMES.CHECKBOX,
            [INSTANCE_REQUIRED_FIELD]: 'false',
            [LABEL]: 'Custom Field',
          },
          {
            [INSTANCE_FULL_NAME_FIELD]: 'Formula__c',
            [INSTANCE_TYPE_FIELD]: FIELD_TYPE_NAMES.TEXT,
            [LABEL]: 'Dummy formula',
            [FORMULA]: 'my formula',
          },
        )
        await filter.onFetch(result)
        const caseElements = findElements(result, 'Case')
        expect(caseElements).toHaveLength(1)
        // Standard fields
        const caseObj = caseElements[0] as ObjectType
        expect(caseObj).toBeInstanceOf(ObjectType)
        expect(caseObj.fields.LastName.refType.elemID.name).toBe('Text')
        expect(caseObj.fields.LastName.annotations.label).toBe('Last Name')
        // Test Required true and false
        expect(caseObj.fields.LastName.annotations[CORE_ANNOTATIONS.REQUIRED])
          .toBe(true)
        expect(caseObj.fields.FirstName.annotations[CORE_ANNOTATIONS.REQUIRED])
          .toBeUndefined()
        // Default string and boolean
        expect(caseObj.fields.LastName.annotations[DEFAULT_VALUE_FORMULA])
          .toBe('BLABLA')
        expect(caseObj.fields.IsDeleted.annotations[FIELD_ANNOTATIONS.DEFAULT_VALUE])
          .toBe(false)

        // Custom type
        expect(caseObj.fields.Custom__c).toBeDefined()
        expect(caseObj.fields.Custom__c.annotations[API_NAME]).toBe('Case.Custom__c')
        // Formula field
        expect(caseObj.fields.Formula__c).toBeDefined()
        expect(caseObj.fields.Formula__c.refType.elemID.name).toBe('FormulaText')
        expect(caseObj.fields.Formula__c.annotations[FORMULA]).toBe('my formula')
      })

      it('should fetch sobject with picklist field', async () => {
        caseInstance.value.fields.push(
          {
            [INSTANCE_FULL_NAME_FIELD]: 'primary',
            [INSTANCE_TYPE_FIELD]: FIELD_TYPE_NAMES.PICKLIST,
            [LABEL]: 'Primary',
            [FIELD_ANNOTATIONS.VALUE_SET]: {
              [VALUE_SET_FIELDS.VALUE_SET_DEFINITION]: {
                [VALUE_SET_DEFINITION_FIELDS.VALUE]: [
                  createValueSetEntry('No'),
                  createValueSetEntry('Yes', true),
                ],
              },
              [VALUE_SET_FIELDS.RESTRICTED]: true,
            },
          },
        )
        await filter.onFetch(result)

        const caseObj = findElements(result, 'Case').pop() as ObjectType
        const field = caseObj.fields.primary
        expect(field.refType.type).toBe(Types.primitiveDataTypes.Picklist)
        expect(field.annotations[FIELD_ANNOTATIONS.VALUE_SET])
          .toEqual([
            createValueSetEntry('No'),
            createValueSetEntry('Yes', true),
          ])
        expect(field.annotations[FIELD_ANNOTATIONS.RESTRICTED]).toBe(true)
        expect(field.annotations[VALUE_SET_DEFINITION_FIELDS.SORTED]).toBeUndefined()
      })

      it('should fetch sobject with controlled picklist field', async () => {
        caseInstance.value.fields.push(
          {
            [INSTANCE_FULL_NAME_FIELD]: 'primary',
            [INSTANCE_TYPE_FIELD]: FIELD_TYPE_NAMES.MULTIPICKLIST,
            [LABEL]: 'Primary',
            [FIELD_ANNOTATIONS.VALUE_SET]: {
              [VALUE_SET_FIELDS.VALUE_SET_DEFINITION]: {
                [VALUE_SET_DEFINITION_FIELDS.VALUE]: createValueSetEntry('No'),
                [VALUE_SET_DEFINITION_FIELDS.SORTED]: true,
              },
              [FIELD_DEPENDENCY_FIELDS.CONTROLLING_FIELD]: 'secondary',
              [FIELD_DEPENDENCY_FIELDS.VALUE_SETTINGS]: {
                [VALUE_SETTINGS_FIELDS.VALUE_NAME]: 'No',
                [VALUE_SETTINGS_FIELDS.CONTROLLING_FIELD_VALUE]: 'a',
              },
            },
          },
        )
        await filter.onFetch(result)

        const caseObj = findElements(result, 'Case').pop() as ObjectType
        const field = caseObj.fields.primary
        expect(field.refType.type).toBe(Types.primitiveDataTypes.MultiselectPicklist)
        expect(field.annotations[FIELD_ANNOTATIONS.VALUE_SET]).toEqual([createValueSetEntry('No')])
        expect(field.annotations[VALUE_SET_DEFINITION_FIELDS.SORTED]).toBe(true)
        expect(field.annotations).toHaveProperty(
          FIELD_ANNOTATIONS.FIELD_DEPENDENCY,
          {
            [FIELD_DEPENDENCY_FIELDS.CONTROLLING_FIELD]: 'secondary',
            [FIELD_DEPENDENCY_FIELDS.VALUE_SETTINGS]: [
              {
                [VALUE_SETTINGS_FIELDS.VALUE_NAME]: 'No',
                [VALUE_SETTINGS_FIELDS.CONTROLLING_FIELD_VALUE]: ['a'],
              },
            ],
          }
        )
      })

      it('should fetch sobject with global picklist field', async () => {
        caseInstance.value.fields.push(
          {
            [INSTANCE_FULL_NAME_FIELD]: 'primary',
            [INSTANCE_TYPE_FIELD]: FIELD_TYPE_NAMES.PICKLIST,
            [LABEL]: 'Primary',
            [FIELD_ANNOTATIONS.VALUE_SET]: {
              [VALUE_SET_FIELDS.VALUE_SET_NAME]: 'GSet',
            },
          },
        )
        await filter.onFetch(result)

        const caseObj = findElements(result, 'Case').pop() as ObjectType
        expect(caseObj.fields.primary.refType.elemID.name).toBe('Picklist')
        expect(caseObj.fields.primary.annotations[VALUE_SET_FIELDS.VALUE_SET_NAME])
          .toEqual('GSet')
        expect(caseObj.fields.primary.annotations[FIELD_ANNOTATIONS.RESTRICTED]).toBe(true)
      })

      it('should fetch sobject with filtered lookup field', async () => {
        caseInstance.value.fields.push(
          {
            [INSTANCE_FULL_NAME_FIELD]: 'lookup_field',
            [LABEL]: 'My Lookup',
            [FIELD_ANNOTATIONS.REFERENCE_TO]: 'Account',
            [FIELD_ANNOTATIONS.LOOKUP_FILTER]: {
              [LOOKUP_FILTER_FIELDS.ACTIVE]: 'true',
              [LOOKUP_FILTER_FIELDS.BOOLEAN_FILTER]: 'myBooleanFilter',
              [LOOKUP_FILTER_FIELDS.ERROR_MESSAGE]: 'myErrorMessage',
              [LOOKUP_FILTER_FIELDS.INFO_MESSAGE]: 'myInfoMessage',
              [LOOKUP_FILTER_FIELDS.IS_OPTIONAL]: 'true',
              [LOOKUP_FILTER_FIELDS.FILTER_ITEMS]: {
                [FILTER_ITEM_FIELDS.FIELD]: 'myField1',
                [FILTER_ITEM_FIELDS.OPERATION]: 'myOperation1',
                [FILTER_ITEM_FIELDS.VALUE_FIELD]: 'myValueField1',
              },
            },
            [INSTANCE_TYPE_FIELD]: 'Lookup',
          },
        )
        await filter.onFetch(result)

        const caseObj = findElements(result, 'Case').pop() as ObjectType
        const field = caseObj.fields.lookup_field
        expect(field.refType.type).toBe(Types.primitiveDataTypes.Lookup)
        const lookupFilter = field.annotations[FIELD_ANNOTATIONS.LOOKUP_FILTER]
        // Should remove error message when it exists for optional filters if it exists
        // not clear if this is a real scenario...
        expect(lookupFilter).not.toHaveProperty(LOOKUP_FILTER_FIELDS.ERROR_MESSAGE)
      })

      it('should fetch sobject with unsupported field type as Unknown', async () => {
        const fieldName = 'cool_new_field__c'
        caseInstance.value.fields.push({
          [INSTANCE_FULL_NAME_FIELD]: fieldName,
          [INSTANCE_TYPE_FIELD]: 'AWholeNewType',
        })
        await filter.onFetch(result)
        const caseObj = findElements(result, 'Case').pop() as ObjectType
        const field = caseObj.fields[fieldName]
        expect(field.refType.type).toBe(Types.primitiveDataTypes.Unknown)
      })

      it('should fetch sobject with apiName and metadataType service ids', async () => {
        await filter.onFetch(result)
        const caseObj = findElements(result, 'Case').pop() as ObjectType
        expect(isServiceId((await caseObj.getAnnotationTypes())[API_NAME]))
          .toEqual(true)
        expect(isServiceId((await caseObj.getAnnotationTypes())[METADATA_TYPE]))
          .toEqual(true)
        expect(caseObj.annotations[API_NAME]).toEqual('Case')
        expect(caseObj.annotations[METADATA_TYPE]).toEqual(CUSTOM_OBJECT)
      })

      it('should keep internal annotations if they appear in a field', async () => {
        // Internal annotations may be set by the custom_objects_from_soap_describe filter
        const extraAnnotations = {
          [LABEL]: 'Test Field',
          [FIELD_ANNOTATIONS.CREATABLE]: true,
          [FIELD_ANNOTATIONS.UPDATEABLE]: false,
          [CORE_ANNOTATIONS.HIDDEN_VALUE]: true,
        }
        caseInstance.value.fields.push({
          [INSTANCE_FULL_NAME_FIELD]: 'TestField__c',
          [INSTANCE_TYPE_FIELD]: FIELD_TYPE_NAMES.NUMBER,
          [INSTANCE_REQUIRED_FIELD]: true,
          ...extraAnnotations,
        })
        await filter.onFetch(result)

        const caseObj = findElements(result, 'Case').pop() as ObjectType
        const fieldAnnotations = caseObj.fields.TestField__c.annotations
        expect(fieldAnnotations[CORE_ANNOTATIONS.REQUIRED]).toBeTruthy()
        expect(fieldAnnotations).toMatchObject(extraAnnotations)
      })

      describe('with custom object from managed package', () => {
        const namespaceName = 'namespaceName'
        const fieldWithNamespaceName = `${namespaceName}${NAMESPACE_SEPARATOR}WithNamespace__c`
        const objectName = `${namespaceName}${NAMESPACE_SEPARATOR}Test__c`
        let packagedCustomObject: ObjectType
        beforeEach(async () => {
          const packagedObj = new InstanceElement(
            objectName,
            customObjectType,
            {
              [INSTANCE_FULL_NAME_FIELD]: objectName,
              fields: [
                {
                  [INSTANCE_FULL_NAME_FIELD]: 'IsDeleted',
                  [INSTANCE_TYPE_FIELD]: FIELD_TYPE_NAMES.CHECKBOX,
                },
                {
                  [INSTANCE_FULL_NAME_FIELD]: fieldWithNamespaceName,
                  [INSTANCE_TYPE_FIELD]: FIELD_TYPE_NAMES.TEXTAREA,
                },
              ],
            }
          )
          result.push(packagedObj)
          await filter.onFetch(result)
          packagedCustomObject = result
            .filter(isObjectType)
            .find(obj => obj.elemID.name === objectName) as ObjectType
        })
        it('should create an object type in the installed package folder', () => {
          expect(packagedCustomObject).toBeDefined()
          expect(packagedCustomObject.path).toEqual([
            SALESFORCE,
            INSTALLED_PACKAGES_PATH,
            namespaceName,
            OBJECTS_PATH,
            'namespaceName__Test__c',
            'namespaceName__Test__c',
          ])
        })
        it('should have standard and packaged fields', () => {
          expect(packagedCustomObject.fields).toHaveProperty(fieldWithNamespaceName)
          expect(packagedCustomObject.fields).toHaveProperty('IsDeleted')
        })
      })

      it('should fetch sobject with packaged and not packaged custom field', async () => {
        const namespaceName = 'namespaceName'
        caseInstance.value.fields.push(
          {
            [INSTANCE_FULL_NAME_FIELD]: `${namespaceName}${NAMESPACE_SEPARATOR}PackagedField__c`,
            [INSTANCE_TYPE_FIELD]: FIELD_TYPE_NAMES.TEXT,
            [LABEL]: 'custom field',
          },
        )

        await filter.onFetch(result)

        const caseElements = findElements(result, 'Case') as ObjectType[]
        expect(caseElements).toHaveLength(1)
        const object = caseElements.find(obj =>
          _.isEqual(obj.path, [SALESFORCE, OBJECTS_PATH, 'Case', 'Case'])) as ObjectType
        expect(object).toBeDefined()
        expect(object.annotations[API_NAME]).toBeDefined()
        expect(object.fields.namespaceName__PackagedField__c).toBeDefined()
      })

      it('should not fetch SObjects that conflict with metadata types', async () => {
        const flowCustomObjectInstance = new InstanceElement(
          'Flow',
          customObjectType,
          {
            [INSTANCE_FULL_NAME_FIELD]: 'Flow',
          }
        )
        const flowMetadataType = createMetadataObjectType(
          { annotations: { metadataType: 'Flow' } }
        )

        result.push(flowCustomObjectInstance, flowMetadataType)

        await filter.onFetch(result)

        const flows = findElements(result, 'Flow')
        expect(flows).toHaveLength(1)
        expect(await metadataType(flows[0])).not.toEqual(CUSTOM_OBJECT)
      })

      it('should modify the customObjectType', async () => {
        await filter.onFetch(result)

        const listViewType = await customObjectType
          .fields[NESTED_INSTANCE_VALUE_NAME.LIST_VIEWS].getType() as ObjectType
        expect(isListType(await listViewType.fields.columns.getType())).toBeTruthy()
        expect(isListType(await listViewType.fields.filters.getType())).toBeTruthy()

        const fieldSetType = await customObjectType
          .fields[NESTED_INSTANCE_VALUE_NAME.FIELD_SETS].getType() as ObjectType
        expect(isListType(await fieldSetType.fields.availableFields.getType())).toBeTruthy()
        expect(isListType(await fieldSetType.fields.displayedFields.getType())).toBeTruthy()

        const compactLayoutType = await customObjectType
          .fields[NESTED_INSTANCE_VALUE_NAME.COMPACT_LAYOUTS].getType() as
          ObjectType
        expect(isListType(await compactLayoutType.fields.fields.getType())).toBeTruthy()
      })

      it('should remove the custom object type and its instances from the fetch result', async () => {
        await filter.onFetch(result)
        expect(result).not.toContain(customObjectType)
        expect(result).not.toContain(caseInstance)
      })

      describe('Merge elements', () => {
        describe('merge annotation types from custom object instance', () => {
          let customObjectInstance: InstanceElement
          beforeEach(() => {
            customObjectInstance = new InstanceElement(
              'Lead',
              customObjectType,
              {
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
                enableFeeds: 'True',
                enableReports: 'True',
              },
            )
          })

          it('should filter out ignored annotations and not set them on the custom object', async () => {
            result.push(customObjectInstance)
            await filter.onFetch(result)
            const lead = result.filter(o => o.elemID.name === 'Lead').pop()
            expect(isObjectType(lead)).toBeTruthy()
            const leadObjectType = lead as ObjectType
            expect((await leadObjectType.getAnnotationTypes())[INSTANCE_FULL_NAME_FIELD])
              .toBeUndefined()
            expect(leadObjectType.annotations).not.toHaveProperty(INSTANCE_FULL_NAME_FIELD)
          })

          it('should merge regular instance element annotations into the standard-custom object type', async () => {
            result.push(customObjectInstance)
            await filter.onFetch(result)
            const lead = findElements(result, 'Lead').pop() as ObjectType
            expect((await lead.getAnnotationTypes()).enableFeeds).toBeDefined()
            expect(lead.annotations.enableFeeds).toBeTruthy()
            expect((await lead.getAnnotationTypes()).enableReports).toBeUndefined()
            expect(lead.annotations.enableReports).toBeUndefined()
          })

          it('should merge regular instance element annotations into the custom settings-custom object type', async () => {
            const customSettingsInstance = customObjectInstance.clone()
            customSettingsInstance.value[CUSTOM_SETTINGS_TYPE] = 'Hierarchical'
            result.push(customSettingsInstance)
            await filter.onFetch(result)
            const lead = findElements(result, 'Lead').pop() as ObjectType
            expect((await lead.getAnnotationTypes()).enableFeeds).toBeDefined()
            expect(lead.annotations.enableFeeds).toBeTruthy()
            expect((await lead.getAnnotationTypes()).pluralLabel).toBeUndefined()
            expect(lead.annotations.customSettingsType).toBeDefined()
            expect(lead.annotations.customSettingsType).toEqual('Hierarchical')
          })

          it('should merge regular instance element annotations into the custom-custom object type', async () => {
            const customAccount = new InstanceElement(
              'Account__c',
              customObjectType,
              {
                [INSTANCE_FULL_NAME_FIELD]: 'Account__c',
                enableFeeds: 'True',
                pluralLabel: 'Accounts',
              },
            )
            result.push(customAccount)
            await filter.onFetch(result)
            const account = findElements(result, 'Account__c').pop() as ObjectType
            expect((await account.getAnnotationTypes()).enableFeeds).toBeDefined()
            expect(account.annotations.enableFeeds).toBeTruthy()
            expect((await account.getAnnotationTypes()).pluralLabel).toBeDefined()
            expect(account.annotations.pluralLabel).toEqual('Accounts')
          })

          it('should not merge nested instances into lead objects', async () => {
            result.push(customObjectInstance)
            await filter.onFetch(result)
            const lead = findElements(result, 'Lead').pop() as ObjectType
            expect((await lead.getAnnotationTypes()).listViews).toBeUndefined()
            expect(lead.annotations.listViews).toBeUndefined()
          })

          it('should create instance element for nested instances of custom object', async () => {
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
            result.push(customObjectInstance)
            await filter.onFetch(result)
            const [leadWebLink] = result.filter(o => o.elemID.name === 'Lead_WebLinkFullName')
            const leadWebLinkInstance = (leadWebLink as InstanceElement)
            expect(leadWebLinkInstance.path).toEqual([SALESFORCE, OBJECTS_PATH, 'Lead', 'ButtonsLinksAndActions',
              leadWebLinkInstance.elemID.name])
          })

          it('should create multiple instance elements for nested instances of custom object', async () => {
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
            .toEqual([SALESFORCE, OBJECTS_PATH, 'Lead', ASSIGNMENT_RULES_METADATA_TYPE, assignmentRulesInstance.elemID.name])
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
            .toEqual([SALESFORCE, OBJECTS_PATH, 'Lead', LEAD_CONVERT_SETTINGS_METADATA_TYPE, leadConvertSettingsInstance.elemID.name])
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
            await filter.onFetch([
              quickActionInstance,
              await quickActionInstance.getType(), leadType,
            ])
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

        describe('LightningPage', () => {
          const recordPageType = new ObjectType({
            elemID: new ElemID(SALESFORCE, LIGHTNING_PAGE_TYPE),
            annotations: { [METADATA_TYPE]: FLEXI_PAGE_TYPE },
          })
          const recordPageInstance = new InstanceElement('LightningPageTest',
            recordPageType,
            { [INSTANCE_FULL_NAME_FIELD]: LIGHTNING_PAGE_TYPE,
              sobjectType: 'Lead' })
          beforeEach(async () => {
            await filter.onFetch([leadType, recordPageType, recordPageInstance])
          })
          it('should add PARENT annotation to Lightning page instance with sobjectType', async () => {
            expect(recordPageInstance.annotations[CORE_ANNOTATIONS.PARENT])
              .toContainEqual(new ReferenceExpression(leadType.elemID))
          })

          it('should change the path of Lightning page instance with sobjectType', async () => {
            expect(recordPageInstance.path)
              .toEqual([SALESFORCE, OBJECTS_PATH, 'Lead', LIGHTNING_PAGE_TYPE, 'LightningPageTest'])
          })
        })

        describe('Not related to a CustomObject', () => {
          const instanceName = 'DoSomething'
          const quickActionInstance = createQuickActionInstance(instanceName, 'DoSomething')
          beforeEach(async () => {
            await filter.onFetch([
              quickActionInstance,
              await quickActionInstance.getType(), leadType,
            ])
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
            .toEqual([SALESFORCE, OBJECTS_PATH, 'Lead', CUSTOM_TAB_METADATA_TYPE, customTabInstance.elemID.name])
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

      const sharingRulesType = new ObjectType({
        elemID: new ElemID(SALESFORCE, SHARING_RULES_TYPE),
        annotations: { [METADATA_TYPE]: SHARING_RULES_TYPE },
      })
      const sharingRulesInstance = new InstanceElement(
        'Lead',
        sharingRulesType,
        { [INSTANCE_FULL_NAME_FIELD]: 'Lead' }
      )
      describe('SharingRules', () => {
        beforeEach(async () => {
          await filter.onFetch([sharingRulesInstance, sharingRulesInstance, leadType])
        })

        it('should set instance path correctly', () => {
          expect(sharingRulesInstance.path)
            .toEqual([SALESFORCE, OBJECTS_PATH, 'Lead', SHARING_RULES_TYPE, sharingRulesInstance.elemID.name])
        })

        it('should add PARENT annotation to instance', () => {
          expect(sharingRulesInstance.annotations[CORE_ANNOTATIONS.PARENT])
            .toContainEqual(new ReferenceExpression(leadType.elemID))
        })
      })

      describe('in partial fetch', () => {
        beforeEach(async () => {
          const elementsSource = buildElementsSourceFromElements([leadType])
          filter = filterCreator({
            config: {
              ...defaultFilterContext,
              fetchProfile: buildFetchProfile({ target: ['SharingRules'] }),
              elementsSource,
            },
          }) as typeof filter
          await filter.onFetch([sharingRulesType, sharingRulesInstance])
        })
        it('should set instance path', () => {
          expect(sharingRulesInstance.path).toEqual(
            [SALESFORCE, OBJECTS_PATH, 'Lead', SHARING_RULES_TYPE, sharingRulesInstance.elemID.name]
          )
        })

        it('should add parent annotation to instance', () => {
          expect(sharingRulesInstance.annotations[CORE_ANNOTATIONS.PARENT]).toContainEqual(
            new ReferenceExpression(leadType.elemID)
          )
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
            refType: Types.primitiveDataTypes.Text,
            annotations: { [API_NAME]: 'Test__c.MyField__c' },
          },
          Master: {
            refType: Types.primitiveDataTypes.MasterDetail,
            annotations: { [API_NAME]: 'Test__c.Master__c' },
          },
          SysField: {
            refType: Types.primitiveDataTypes.AutoNumber,
            annotations: { [API_NAME]: 'Test__c.SysField' },
          },
        },
        annotationRefsOrTypes: {
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
        filter = filterCreator({ config: defaultFilterContext }) as typeof filter

        testFieldSet = createInstanceElement(
          { fullName: 'Test__c.MyFieldSet', description: 'my field set' },
          await customObjectType.fields[NESTED_INSTANCE_VALUE_NAME.FIELD_SETS]
            .getType() as ObjectType,
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
          const inst = getChangeData(changes[0]) as InstanceElement
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
        filter = filterCreator({ config: defaultFilterContext }) as typeof filter
        changes = [
          toChange({ before: testObject }),
          toChange({ before: sideEffectInst }),
        ]
      })
      describe('preDeploy', () => {
        beforeAll(async () => {
          await filter.preDeploy(changes)
        })
        it('should omit side effect removals', async () => {
          expect(changes).toHaveLength(1)
          expect(changes[0].action).toEqual('remove')
          const removedElem = getChangeData(changes[0])
          expect(removedElem).toBeInstanceOf(InstanceElement)
          expect(await metadataType(removedElem)).toEqual(CUSTOM_OBJECT)
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
        filter = filterCreator({ config: defaultFilterContext }) as typeof filter
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
