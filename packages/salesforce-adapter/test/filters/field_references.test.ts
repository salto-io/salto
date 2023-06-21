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
import { ElemID, InstanceElement, ObjectType, ReferenceExpression, Element, BuiltinTypes, Value, CORE_ANNOTATIONS, isInstanceElement, Field, isObjectType, ListType, TypeElement } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import filterCreator, { addReferences } from '../../src/filters/field_references'
import { getReferenceMappingDefs } from '../../src/transformers/reference_mapping'
import { OBJECTS_PATH, SALESFORCE, CUSTOM_OBJECT, METADATA_TYPE, INSTANCE_FULL_NAME_FIELD, CUSTOM_OBJECT_ID_FIELD, API_NAME, API_NAME_SEPARATOR, WORKFLOW_ACTION_REFERENCE_METADATA_TYPE, WORKFLOW_RULE_METADATA_TYPE, CPQ_QUOTE_LINE_FIELDS, CPQ_CUSTOM_SCRIPT, CPQ_CONFIGURATION_ATTRIBUTE, CPQ_DEFAULT_OBJECT_FIELD, CPQ_LOOKUP_QUERY, CPQ_TESTED_OBJECT, CPQ_DISCOUNT_SCHEDULE, CPQ_CONSTRAINT_FIELD } from '../../src/constants'
import { metadataType, apiName, createInstanceElement } from '../../src/transformers/transformer'
import { CUSTOM_OBJECT_TYPE_ID } from '../../src/filters/custom_objects_to_object_type'
import { defaultFilterContext } from '../utils'
import { mockTypes } from '../mock_elements'
import { FilterWith } from './mocks'

const { awu } = collections.asynciterable

const customObjectType = new ObjectType({
  elemID: CUSTOM_OBJECT_TYPE_ID,
  fields: {
    [INSTANCE_FULL_NAME_FIELD]: {
      refType: BuiltinTypes.STRING,
    },
  },
  annotations: {
    [METADATA_TYPE]: CUSTOM_OBJECT,
  },
})

const generateObjectAndInstance = ({
  type,
  objType = CUSTOM_OBJECT,
  instanceName,
  fieldName,
  fieldValue,
  parentType,
  contextFieldName,
  contextFieldValue,
}: {
  type: string
  objType?: string
  instanceName?: string
  fieldName: string
  fieldValue?: Value
  parentType?: string
  contextFieldName?: string
  contextFieldValue?: string | ReferenceExpression
}): Element[] => {
  const addFields = (obj: ObjectType): void => {
    const createField = (name: string, fieldType: TypeElement = BuiltinTypes.STRING): Field => (
      new Field(obj, name, fieldType, { [API_NAME]: [type, name].join(API_NAME_SEPARATOR) })
    )
    obj.fields = {
      [fieldName]: createField(fieldName),
      other: createField('other'),
      ignore: createField('ignore', BuiltinTypes.NUMBER),
      ...(contextFieldName ? { [contextFieldName]: createField(contextFieldName) } : {}),
    }
    if (objType === CUSTOM_OBJECT) {
      obj.fields[CUSTOM_OBJECT_ID_FIELD] = createField(CUSTOM_OBJECT_ID_FIELD)
    }
  }
  if (objType === CUSTOM_OBJECT || fieldValue === undefined) {
    const customObj = new ObjectType({
      elemID: new ElemID(SALESFORCE, type),
      annotations: {
        [METADATA_TYPE]: objType,
        [API_NAME]: type,
      },
    })
    addFields(customObj)
    return [customObj]
  }
  const obj = new ObjectType({
    elemID: new ElemID(SALESFORCE, type),
    annotations: { [METADATA_TYPE]: objType },
  })
  addFields(obj)
  const realInstanceName = instanceName || `${type}Inst`
  const instance = new InstanceElement(
    realInstanceName,
    obj,
    {
      [INSTANCE_FULL_NAME_FIELD]: parentType
        ? [parentType, realInstanceName].join(API_NAME_SEPARATOR)
        : realInstanceName,
      [fieldName]: fieldValue,
      other: fieldValue,
      ignore: 125,
      ...((contextFieldName && contextFieldValue) ? { [contextFieldName]: contextFieldValue } : {}),
    },
    [SALESFORCE, OBJECTS_PATH, ...(parentType ? [parentType] : []), realInstanceName],
    { ...(parentType
      ? { [CORE_ANNOTATIONS.PARENT]: [
        new ReferenceExpression(new ElemID(SALESFORCE, parentType)),
      ] }
      : {}) },
  )
  return [obj, instance]
}

describe('FieldReferences filter', () => {
  const filter = filterCreator({ config: defaultFilterContext }) as FilterWith<'onFetch'>

  const generateElements = (): Element[] => {
    const filterItemType = new ObjectType({
      elemID: new ElemID(SALESFORCE, 'FilterItem'),
      annotations: { [METADATA_TYPE]: 'FilterItem' },
      fields: {
        // note: does not exactly match the real type
        field: { refType: BuiltinTypes.STRING },
      },
    })

    const sharingRulesType = new ObjectType({
      elemID: new ElemID(SALESFORCE, 'SharingRules'),
      annotations: { [METADATA_TYPE]: 'SharingRules' },
      fields: {
        someFilterField: { refType: filterItemType },
      },
    })
    const FlowElementReferenceOrValueType = new ObjectType({
      elemID: new ElemID(SALESFORCE, 'FlowElementReferenceOrValue'),
      annotations: { [METADATA_TYPE]: 'FlowElementReferenceOrValue' },
      fields: {
        elementReference: { refType: BuiltinTypes.STRING },
      },
    })
    const FlowType = new ObjectType({
      elemID: new ElemID(SALESFORCE, 'Flow'),
      annotations: { [METADATA_TYPE]: 'Flow' },
      fields: {
        // note: does not exactly match the real type
        inputAssignments: { refType: new ListType(FlowElementReferenceOrValueType) },
      },
    })
    const flowInstance = new InstanceElement(
      'flow1',
      FlowType,
      {
        inputAssignments: [
          { elementReference: 'check' },
          { elementReference: '$Label.check' },
        ],
      }
    )
    const checkLabel = createInstanceElement({ fullName: 'check' }, mockTypes.CustomLabel)
    return [
      customObjectType,
      // sharingRules555 should point to Account.name (rule contains instanceTypes constraint)
      filterItemType,
      sharingRulesType,
      new InstanceElement(
        'sharingRules555',
        sharingRulesType,
        {
          someFilterField: {
            field: 'name',
          },
        },
        undefined,
        {
          [CORE_ANNOTATIONS.PARENT]: [
            new ReferenceExpression(new ElemID(SALESFORCE, 'Account')),
          ],
        },
      ),
      FlowElementReferenceOrValueType,
      FlowType,
      flowInstance,
      checkLabel,
      ...generateObjectAndInstance({
        type: 'Account',
        fieldName: 'name',
      }),
      ...generateObjectAndInstance({
        type: 'SBQQ__QuoteLine__c',
        fieldName: 'name',
      }),
      ...generateObjectAndInstance({
        type: 'SBQQ__Quote__c',
        fieldName: 'SBQQ__Account__c',
      }),

      // site1.authorizationRequiredPage should point to page1
      ...generateObjectAndInstance({
        type: 'ApexPage',
        objType: 'ApexPage',
        instanceName: 'page1',
        fieldName: 'any',
        fieldValue: 'aaa',
      }),
      ...generateObjectAndInstance({
        type: 'ApexClass',
        objType: 'ApexClass',
        instanceName: 'class5',
        fieldName: 'any',
        fieldValue: 'aaa',
      }),
      ...generateObjectAndInstance({
        type: 'CustomSite',
        objType: 'CustomSite',
        instanceName: 'site1',
        fieldName: 'authorizationRequiredPage',
        fieldValue: 'page1',
      }),
      // report53.reportType should point to Account
      ...generateObjectAndInstance({
        type: 'Report',
        objType: 'Report',
        instanceName: 'report53',
        fieldName: 'reportType',
        fieldValue: 'Account',
      }),
      // filterItem643.field should point to Account.name (default strategy)
      ...generateObjectAndInstance({
        type: 'FilterItem',
        objType: 'FilterItem',
        instanceName: 'filterItem643',
        fieldName: 'field',
        fieldValue: 'Account.name',
      }),
      // fieldUpdate54.field should point to Account.name (instanceParent)
      ...generateObjectAndInstance({
        type: 'WorkflowFieldUpdate',
        objType: 'WorkflowFieldUpdate',
        instanceName: 'fieldUpdate54',
        fieldName: 'field',
        fieldValue: 'name',
        parentType: 'Account',
      }),
      // customScript1[CPQ_QUOTE_LINE_FIELDS] should point to SBQQ__QuoteLine__c.name
      // (target parent)
      ...generateObjectAndInstance({
        type: CPQ_CUSTOM_SCRIPT,
        objType: CPQ_CUSTOM_SCRIPT,
        instanceName: 'customScript1',
        fieldName: CPQ_QUOTE_LINE_FIELDS,
        fieldValue: ['name'],
      }),
      ...generateObjectAndInstance({
        type: CPQ_CONFIGURATION_ATTRIBUTE,
        objType: CPQ_CONFIGURATION_ATTRIBUTE,
        instanceName: 'configAttr1',
        fieldName: CPQ_DEFAULT_OBJECT_FIELD,
        fieldValue: 'Quote__c',
      }),
      ...generateObjectAndInstance({
        type: CPQ_DISCOUNT_SCHEDULE,
        objType: CPQ_DISCOUNT_SCHEDULE,
        instanceName: 'discountSchedule1',
        fieldName: CPQ_CONSTRAINT_FIELD,
        fieldValue: 'Account__c',
      }),
      ...generateObjectAndInstance({
        type: CPQ_LOOKUP_QUERY,
        objType: CPQ_LOOKUP_QUERY,
        instanceName: 'lookupQuery1',
        fieldName: CPQ_TESTED_OBJECT,
        fieldValue: 'Quote',
      }),
      // name should point to ApexPage.instance.page1 (neighbor context)
      ...generateObjectAndInstance({
        type: 'AppMenuItem',
        objType: 'AppMenuItem',
        instanceName: 'appMenuItem',
        fieldName: 'name',
        fieldValue: 'page1',
        contextFieldName: 'type',
        contextFieldValue: 'ApexPage',
      }),
      // actionName should point to ApexClass.instance.class5 (neighbor context with reference)
      new InstanceElement('apex', customObjectType, { [INSTANCE_FULL_NAME_FIELD]: 'apex' }), // fake instance so we have a reference
      ...generateObjectAndInstance({
        type: 'FlowActionCall',
        objType: 'FlowActionCall',
        instanceName: 'flowAction',
        fieldName: 'actionName',
        fieldValue: 'class5',
        contextFieldName: 'actionType',
        contextFieldValue: new ReferenceExpression(customObjectType.elemID.createNestedID('instance', 'apex')),
      }),
      // layoutItem436.field will remain the same (Account.fffff doesn't exist)
      ...generateObjectAndInstance({
        type: 'LayoutItem',
        objType: 'LayoutItem',
        instanceName: 'layoutItem436',
        fieldName: 'field',
        fieldValue: 'fffff',
        parentType: 'Account',
      }),
      // shareTo should point to salesforce.Role.instance.CFO (neighbor context)
      ...generateObjectAndInstance({
        type: 'Role',
        objType: 'Role',
        instanceName: 'CFO',
        fieldName: 'fullName',
        fieldValue: 'CFO',
      }),
      ...generateObjectAndInstance({
        type: 'FolderShare',
        objType: 'FolderShare',
        instanceName: 'folderShare',
        fieldName: 'sharedTo',
        fieldValue: 'CFO',
        contextFieldName: 'sharedToType',
        contextFieldValue: 'Role',
      }),
      // field should point to salesforce.Account.field.Id (neighbor context)
      ...generateObjectAndInstance({
        type: 'ReportTypeColumn',
        objType: 'ReportTypeColumn',
        instanceName: 'reportTypeColumn',
        fieldName: 'field',
        fieldValue: 'Id',
        contextFieldName: 'table',
        contextFieldValue: 'Account',
      }),
    ]
  }

  describe('on fetch', () => {
    let elements: Element[]

    beforeAll(async () => {
      elements = generateElements()
      await filter.onFetch(elements)
    })

    it('should resolve fields with absolute value (parent.field)', async () => {
      const inst = await awu(elements).find(
        async e => isInstanceElement(e) && await metadataType(e) === 'FilterItem'
      ) as InstanceElement
      expect(inst.value.field).toBeInstanceOf(ReferenceExpression)
      expect(inst.value.field?.elemID.getFullName()).toEqual('salesforce.Account.field.name')
    })

    it('should resolve when field is a regular expression', async () => {
      const inst = await awu(elements).find(
        async e => isInstanceElement(e) && await metadataType(e) === 'CustomSite'
      ) as InstanceElement
      expect(inst.value.authorizationRequiredPage).toBeInstanceOf(ReferenceExpression)
      expect(inst.value.authorizationRequiredPage?.elemID.getFullName()).toEqual('salesforce.ApexPage.instance.page1')
    })

    it('should resolve custom object instances', async () => {
      const inst = await awu(elements).find(
        async e => isInstanceElement(e) && await metadataType(e) === 'Report'
      ) as InstanceElement
      const account = await awu(elements)
        .find(async e => isObjectType(e) && await apiName(e) === 'Account')
      expect(inst.value.reportType).toBeInstanceOf(ReferenceExpression)
      expect(inst.value.reportType?.elemID.getFullName())
        .toEqual(account && account.elemID.getFullName())
    })

    it('should resolve field with relative value using instance parent', async () => {
      const inst = await awu(elements).find(
        async e => isInstanceElement(e) && await metadataType(e) === 'WorkflowFieldUpdate'
      ) as InstanceElement
      expect(inst.value.field).toBeInstanceOf(ReferenceExpression)
      expect(inst.value.field?.elemID.getFullName()).toEqual('salesforce.Account.field.name')
    })
    it('should resolve fields with relative value based on instanceType condition', async () => {
      const inst = await awu(elements).find(
        async e => isInstanceElement(e) && await metadataType(e) === 'SharingRules'
      ) as InstanceElement
      expect(inst.value.someFilterField.field).toBeInstanceOf(ReferenceExpression)
      expect(inst.value.someFilterField.field?.elemID.getFullName()).toEqual('salesforce.Account.field.name')
    })

    it('should resolve field with relative value array using parent target', async () => {
      const inst = await awu(elements).find(
        async e => isInstanceElement(e) && await apiName(await e.getType()) === CPQ_CUSTOM_SCRIPT
      ) as InstanceElement
      expect(inst.value[CPQ_QUOTE_LINE_FIELDS]).toBeDefined()
      expect(inst.value[CPQ_QUOTE_LINE_FIELDS]).toHaveLength(1)
      expect(inst.value[CPQ_QUOTE_LINE_FIELDS][0]).toBeInstanceOf(ReferenceExpression)
      expect(inst.value[CPQ_QUOTE_LINE_FIELDS][0]?.elemID.getFullName()).toEqual('salesforce.SBQQ__QuoteLine__c.field.name')
    })

    it('should resolve object with configurationAttributeMapping strategy', async () => {
      const inst = await awu(elements).find(
        async e => isInstanceElement(e)
          && await apiName(await e.getType()) === CPQ_CONFIGURATION_ATTRIBUTE
      ) as InstanceElement
      expect(inst.value[CPQ_DEFAULT_OBJECT_FIELD]).toBeDefined()
      expect(inst.value[CPQ_DEFAULT_OBJECT_FIELD]).toBeInstanceOf(ReferenceExpression)
      expect(inst.value[CPQ_DEFAULT_OBJECT_FIELD]?.elemID.getFullName()).toEqual('salesforce.SBQQ__Quote__c')
    })

    it('should resolve object with lookupQueryMapping strategy', async () => {
      const inst = await awu(elements).find(
        async e => isInstanceElement(e) && await apiName(await e.getType()) === CPQ_LOOKUP_QUERY
      ) as InstanceElement
      expect(inst.value[CPQ_TESTED_OBJECT]).toBeDefined()
      expect(inst.value[CPQ_TESTED_OBJECT]).toBeInstanceOf(ReferenceExpression)
      expect(inst.value[CPQ_TESTED_OBJECT]?.elemID.getFullName()).toEqual('salesforce.SBQQ__Quote__c')
    })

    it('should resolve field with scheduleConstraintFieldMapping strategy', async () => {
      const inst = await awu(elements).find(
        async e => isInstanceElement(e)
          && await apiName(await e.getType()) === CPQ_DISCOUNT_SCHEDULE
      ) as InstanceElement
      expect(inst.value[CPQ_CONSTRAINT_FIELD]).toBeDefined()
      expect(inst.value[CPQ_CONSTRAINT_FIELD]).toBeInstanceOf(ReferenceExpression)
      expect(inst.value[CPQ_CONSTRAINT_FIELD]?.elemID.getFullName()).toEqual('salesforce.SBQQ__Quote__c.field.SBQQ__Account__c')
    })

    it('should resolve field with CustomLabel strategy', async () => {
      const inst = await awu(elements).find(
        async e => isInstanceElement(e)
              && await apiName(await e.getType()) === 'Flow'
      ) as InstanceElement
      expect(inst.value.inputAssignments[0].elementReference).toEqual('check')
      expect(inst.value.inputAssignments[1].elementReference).toBeInstanceOf(ReferenceExpression)
      expect(inst.value.inputAssignments[1].elementReference.elemID.getFullName()).toEqual('salesforce.CustomLabel.instance.check')
    })

    it('should resolve field with neighbor context using app menu item mapping when context is a string', async () => {
      const inst = await awu(elements).find(
        async e => isInstanceElement(e) && await metadataType(e) === 'AppMenuItem'
      ) as InstanceElement
      expect(inst.value.name).toBeInstanceOf(ReferenceExpression)
      expect(inst.value.name?.elemID.getFullName()).toEqual('salesforce.ApexPage.instance.page1')
    })

    it('should resolve field with neighbor context using flow action call mapping when context is a reference', async () => {
      const inst = await awu(elements).find(
        async e => isInstanceElement(e) && await metadataType(e) === 'FlowActionCall'
      ) as InstanceElement
      expect(inst.value.actionName).toBeInstanceOf(ReferenceExpression)
      expect(inst.value.actionName?.elemID.getFullName()).toEqual('salesforce.ApexClass.instance.class5')
    })

    it('should not resolve if field has no rule', async () => {
      const inst = await awu(elements).find(
        async e => isInstanceElement(e) && await metadataType(e) === 'WorkflowFieldUpdate'
      ) as InstanceElement
      expect(inst.value.other).not.toBeInstanceOf(ReferenceExpression)
      expect(inst.value.other).toEqual('name')
    })

    it('should not resolve if referenced does not exist', async () => {
      const inst = await awu(elements).find(
        async e => isInstanceElement(e) && await metadataType(e) === 'LayoutItem'
      ) as InstanceElement
      expect(inst.value.field).not.toBeInstanceOf(ReferenceExpression)
      expect(inst.value.field).toEqual('fffff')
    })

    it('should resolve field with neighbor context using share to type mapping when context is a string', async () => {
      const inst = await awu(elements).find(
        async e => isInstanceElement(e) && await metadataType(e) === 'FolderShare'
      ) as InstanceElement
      expect(inst.value.sharedTo).toBeInstanceOf(ReferenceExpression)
      expect(inst.value.sharedTo?.elemID.getFullName()).toEqual('salesforce.Role.instance.CFO')
    })

    it('should resolve field with neighbor context using table field', async () => {
      const inst = await awu(elements).find(
        async e => isInstanceElement(e) && await metadataType(e) === 'ReportTypeColumn'
      ) as InstanceElement
      expect(inst.value.field).toBeInstanceOf(ReferenceExpression)
      expect(inst.value.field.elemID.getFullName()).toEqual('salesforce.Account.field.Id')
    })
  })

  describe('on fetch with modified serialization', () => {
    let elements: Element[]

    beforeAll(async () => {
      elements = generateElements()
      const modifiedDefs = getReferenceMappingDefs({ enumFieldPermissions: false, fetchProfiles: false }).map(def => _.omit(def, 'serializationStrategy'))
      await addReferences(elements, buildElementsSourceFromElements(elements), modifiedDefs)
    })
    afterAll(() => {
      jest.clearAllMocks()
    })

    it('should resolve fields with absolute value (parent.field)', async () => {
      const inst = await awu(elements).find(
        async e => isInstanceElement(e) && await metadataType(e) === 'FilterItem'
      ) as InstanceElement
      expect(inst.value.field).toBeInstanceOf(ReferenceExpression)
      expect(inst.value.field?.elemID.getFullName()).toEqual('salesforce.Account.field.name')
    })

    it('should fail to resolve field with relative value (because of the modified rule)', async () => {
      const inst = await awu(elements).find(
        async e => isInstanceElement(e) && await metadataType(e) === 'WorkflowFieldUpdate'
      ) as InstanceElement
      expect(inst.value.field).not.toBeInstanceOf(ReferenceExpression)
      expect(inst.value.field).toEqual('name')
    })
  })
})

describe('FieldReferences filter - neighbor context strategy', () => {
  const filter = filterCreator({ config: defaultFilterContext }) as FilterWith<'onFetch'>

  const parentName = 'User'
  type WorkflowActionReference = {
    name: string | ReferenceExpression
    type: string
  }
  const generateWorkFlowRuleInstance = (
    workflowRuleInstanceName: string,
    actions: WorkflowActionReference | WorkflowActionReference[]
  ): InstanceElement => {
    const workflowActionReferenceObjectType = new ObjectType({
      elemID: new ElemID(SALESFORCE, WORKFLOW_ACTION_REFERENCE_METADATA_TYPE),
      annotations: {
        [METADATA_TYPE]: WORKFLOW_ACTION_REFERENCE_METADATA_TYPE,
      },
    })
    workflowActionReferenceObjectType.fields = {
      name: new Field(
        workflowActionReferenceObjectType,
        'name',
        BuiltinTypes.STRING,
        { [API_NAME]: [WORKFLOW_ACTION_REFERENCE_METADATA_TYPE, 'name'].join(API_NAME_SEPARATOR) }
      ),
      type: new Field(
        workflowActionReferenceObjectType,
        'type',
        BuiltinTypes.STRING,
        { [API_NAME]: [WORKFLOW_ACTION_REFERENCE_METADATA_TYPE, 'type'].join(API_NAME_SEPARATOR) }
      ),
    }
    const workflowRuleObjectType = new ObjectType({
      elemID: new ElemID(SALESFORCE, WORKFLOW_RULE_METADATA_TYPE),
      annotations: {
        [METADATA_TYPE]: WORKFLOW_RULE_METADATA_TYPE,
      },
    })
    workflowRuleObjectType.fields = {
      actions: new Field(
        workflowRuleObjectType,
        'actions',
        new ListType(workflowActionReferenceObjectType),
        { [API_NAME]: [WORKFLOW_RULE_METADATA_TYPE, 'actions'].join(API_NAME_SEPARATOR) }
      ),
    }
    const instanceName = `${parentName}_${workflowRuleInstanceName}`
    return new InstanceElement(
      instanceName,
      workflowRuleObjectType,
      {
        [INSTANCE_FULL_NAME_FIELD]: `${parentName}${API_NAME_SEPARATOR}${workflowRuleInstanceName}`,
        actions,
      },
      [SALESFORCE, OBJECTS_PATH, WORKFLOW_RULE_METADATA_TYPE, instanceName],
      { [CORE_ANNOTATIONS.PARENT]: [
        new ReferenceExpression(new ElemID(SALESFORCE, parentName)),
      ] },
    )
  }

  const generateFlowRecordLookupInstance = (
    flowRecordLookupInstanceName: string,
    value: { object: string; queriedFields: string[]; filters: { field: string }[] },
  ): InstanceElement => {
    const flowRecordFilterObjType = new ObjectType({
      elemID: new ElemID(SALESFORCE, 'FlowRecordFilter'),
      annotations: {
        [METADATA_TYPE]: 'FlowRecordFilter',
      },
    })
    flowRecordFilterObjType.fields = {
      field: new Field(
        flowRecordFilterObjType,
        'field',
        BuiltinTypes.STRING,
        { [API_NAME]: ['FlowRecordFilter', 'field'].join(API_NAME_SEPARATOR) }
      ),
    }

    const flowRecordLookupObjectType = new ObjectType({
      elemID: new ElemID(SALESFORCE, 'FlowRecordLookup'),
      annotations: {
        [METADATA_TYPE]: 'FlowRecordLookup',
      },
    })
    flowRecordLookupObjectType.fields = {
      object: new Field(
        flowRecordLookupObjectType,
        'object',
        BuiltinTypes.STRING,
        { [API_NAME]: ['FlowRecordLookupObjectType', 'object'].join(API_NAME_SEPARATOR) }
      ),
      queriedFields: new Field(
        flowRecordLookupObjectType,
        'queriedFields',
        new ListType(BuiltinTypes.STRING),
        { [API_NAME]: ['FlowRecordLookupObjectType', 'queriedFields'].join(API_NAME_SEPARATOR) }
      ),
      filters: new Field(
        flowRecordLookupObjectType,
        'filters',
        new ListType(flowRecordFilterObjType),
        { [API_NAME]: ['FlowRecordLookupObjectType', 'filters'].join(API_NAME_SEPARATOR) }
      ),
    }
    const instanceName = `${parentName}_${flowRecordLookupInstanceName}`
    return new InstanceElement(
      instanceName,
      flowRecordLookupObjectType,
      {
        [INSTANCE_FULL_NAME_FIELD]: `${parentName}${API_NAME_SEPARATOR}${flowRecordLookupObjectType}`,
        ...value,
      },
    )
  }

  describe('on fetch', () => {
    let instanceSingleAction: InstanceElement
    let instanceMultiAction: InstanceElement
    let instanceUnknownActionName: InstanceElement
    let instanceMissingActionForType: InstanceElement
    let instanceInvalidActionType: InstanceElement
    let elements: Element[]
    let actionInstances: InstanceElement[]

    let instanceFlowRecordLookup: InstanceElement

    beforeAll(async () => {
      const actionTypeObjects = ['WorkflowAlert', 'WorkflowFieldUpdate'].map(actionType => (
        new ObjectType({
          elemID: new ElemID(SALESFORCE, actionType),
          annotations: {
            [METADATA_TYPE]: actionType,
          },
        })
      ))
      const actionName = 'foo'
      const instanceName = `${parentName}_${actionName}`
      // creating two objects of different types with the same api name
      actionInstances = actionTypeObjects.map(actionTypeObj => (
        new InstanceElement(
          instanceName,
          actionTypeObj,
          {
            [INSTANCE_FULL_NAME_FIELD]: `${parentName}${API_NAME_SEPARATOR}${actionName}`,
          },
          [SALESFORCE, OBJECTS_PATH, actionTypeObj.elemID.typeName, instanceName],
          { [CORE_ANNOTATIONS.PARENT]: [
            new ReferenceExpression(new ElemID(SALESFORCE, parentName)),
          ] },
        )
      ))

      const actionReferences = ['Alert', 'FieldUpdate'].map(actionType => ({
        name: actionName,
        type: actionType,
      }))

      instanceSingleAction = generateWorkFlowRuleInstance('single', actionReferences[0])
      instanceMultiAction = generateWorkFlowRuleInstance('multi', actionReferences)
      instanceUnknownActionName = generateWorkFlowRuleInstance('unknownActionName', { name: 'unknown', type: 'Alert' })
      instanceMissingActionForType = generateWorkFlowRuleInstance('unknownActionType', { name: 'foo', type: 'Task' })
      instanceInvalidActionType = generateWorkFlowRuleInstance('unknownActionType', { name: 'foo', type: 'InvalidType' })
      const workflowRuleType = await instanceSingleAction.getType()

      instanceFlowRecordLookup = generateFlowRecordLookupInstance('single', {
        object: 'User',
        queriedFields: ['name'],
        filters: [{ field: 'name' }, { field: 'unknown' }, { field: 'name' }],
      })

      elements = [
        customObjectType,
        ...generateObjectAndInstance({
          type: parentName,
          fieldName: 'name',
        }),
        workflowRuleType,
        instanceSingleAction, instanceMultiAction,
        instanceUnknownActionName, instanceMissingActionForType, instanceInvalidActionType,
        ...actionTypeObjects, ...actionInstances,
        instanceFlowRecordLookup, await instanceFlowRecordLookup.getType(),
      ]
      await filter.onFetch(elements)
    })

    it('should have references to the right actions', async () => {
      const getFullName = (action: WorkflowActionReference): string => {
        expect(action.name).toBeInstanceOf(ReferenceExpression)
        return (action.name as ReferenceExpression).elemID.getFullName()
      }
      expect(getFullName(instanceSingleAction.value.actions)).toEqual(
        actionInstances[0].elemID.getFullName()
      )
      expect(getFullName(instanceSingleAction.value.actions)).not.toEqual(
        actionInstances[1].elemID.getFullName()
      )
      expect(getFullName(instanceMultiAction.value.actions[0])).toEqual(
        actionInstances[0].elemID.getFullName()
      )
      expect(getFullName(instanceMultiAction.value.actions[1])).toEqual(
        actionInstances[1].elemID.getFullName()
      )
    })

    it('should have references if referencing field is an array', async () => {
      const getFullName = (val: string | ReferenceExpression): string => {
        expect(val).toBeInstanceOf(ReferenceExpression)
        return (val as ReferenceExpression).elemID.getFullName()
      }
      expect(getFullName(instanceFlowRecordLookup.value.queriedFields[0])).toEqual('salesforce.User.field.name')
    })

    it('should have reference for parent\'s neighbor in an array', async () => {
      const getFullName = (val: string | ReferenceExpression): string => {
        expect(val).toBeInstanceOf(ReferenceExpression)
        return (val as ReferenceExpression).elemID.getFullName()
      }
      expect(getFullName(instanceFlowRecordLookup.value.filters[0].field)).toEqual('salesforce.User.field.name')
      expect(getFullName(instanceFlowRecordLookup.value.filters[2].field)).toEqual('salesforce.User.field.name')
    })

    it('should not have references when lookup fails', async () => {
      expect(instanceUnknownActionName.value.actions.name).toEqual('unknown')
      expect(instanceMissingActionForType.value.actions.name).toEqual('foo')
      expect(instanceInvalidActionType.value.actions.name).toEqual('foo')
      expect(instanceFlowRecordLookup.value.filters[1].field).toEqual('unknown')
    })
  })
})
