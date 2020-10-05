/*
*                      Copyright 2020 Salto Labs Ltd.
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
import { ElemID, InstanceElement, ObjectType, ReferenceExpression, Element, BuiltinTypes, Value, INSTANCE_ANNOTATIONS, isInstanceElement, Field, isObjectType, ListType } from '@salto-io/adapter-api'
import { FilterWith } from '../../src/filter'
import filterCreator, { addReferences } from '../../src/filters/field_references'
import { fieldNameToTypeMappingDefs } from '../../src/transformers/reference_mapping'
import mockClient from '../client'
import {
  OBJECTS_PATH, SALESFORCE, CUSTOM_OBJECT, METADATA_TYPE, INSTANCE_FULL_NAME_FIELD,
  CUSTOM_OBJECT_ID_FIELD, API_NAME, API_NAME_SEPARATOR, WORKFLOW_ACTION_REFERENCE_METADATA_TYPE,
  WORKFLOW_RULE_METADATA_TYPE, CPQ_QUOTE_LINE_FIELDS, CPQ_CUSTOM_SCRIPT,
} from '../../src/constants'
import { metadataType, apiName } from '../../src/transformers/transformer'
import { CUSTOM_OBJECT_TYPE_ID } from '../../src/filters/custom_objects'

const customObjectType = new ObjectType({
  elemID: CUSTOM_OBJECT_TYPE_ID,
  fields: {
    [INSTANCE_FULL_NAME_FIELD]: { type: BuiltinTypes.STRING },
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
  contextFieldValue?: string
}): Element[] => {
  const addFields = (obj: ObjectType): void => {
    const createField = (name: string, fieldType = BuiltinTypes.STRING): Field => (
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
      elemID: new ElemID(SALESFORCE, type, 'type', type),
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
      ? { [INSTANCE_ANNOTATIONS.PARENT]: [
        new ReferenceExpression(new ElemID(SALESFORCE, parentType)),
      ] }
      : {}) },
  )
  return [obj, instance]
}

describe('FieldReferences filter', () => {
  const { client } = mockClient()

  const filter = filterCreator({ client, config: {} }) as FilterWith<'onFetch'>

  const generateElements = (
  ): Element[] => ([
    customObjectType,
    ...generateObjectAndInstance({
      type: 'Account',
      fieldName: 'name',
    }),
    ...generateObjectAndInstance({
      type: 'SBQQ__QuoteLine__c',
      fieldName: 'name',
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
    // customScript1[CPQ_QUOTE_LINE_FIELDS] should point to SBQQ__QuoteLine__c.name (target parent)
    ...generateObjectAndInstance({
      type: CPQ_CUSTOM_SCRIPT,
      objType: CPQ_CUSTOM_SCRIPT,
      instanceName: 'customScript1',
      fieldName: CPQ_QUOTE_LINE_FIELDS,
      fieldValue: ['name'],
    }),
    // fieldUpdate54.field should point to Account.name (instanceParent)
    ...generateObjectAndInstance({
      type: 'FlowActionCall',
      objType: 'FlowActionCall',
      instanceName: 'flowAction',
      fieldName: 'actionName',
      fieldValue: 'class5',
      contextFieldName: 'actionType',
      contextFieldValue: 'apex',
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
  ])

  describe('on fetch', () => {
    let elements: Element[]

    beforeAll(async () => {
      elements = generateElements()
      await filter.onFetch(elements)
    })

    it('should resolve fields with absolute value (parent.field)', () => {
      const inst = elements.filter(
        e => isInstanceElement(e) && metadataType(e) === 'FilterItem'
      )[0] as InstanceElement
      expect(inst.value.field).toBeInstanceOf(ReferenceExpression)
      expect(inst.value.field?.elemId.getFullName()).toEqual('salesforce.Account.field.name')
    })

    it('should resolve when field is a regular expression', () => {
      const inst = elements.filter(
        e => isInstanceElement(e) && metadataType(e) === 'CustomSite'
      )[0] as InstanceElement
      expect(inst.value.authorizationRequiredPage).toBeInstanceOf(ReferenceExpression)
      expect(inst.value.authorizationRequiredPage?.elemId.getFullName()).toEqual('salesforce.ApexPage.instance.page1')
    })

    it('should resolve custom object instances', () => {
      const inst = elements.filter(
        e => isInstanceElement(e) && metadataType(e) === 'Report'
      )[0] as InstanceElement
      const account = elements.filter(e => isObjectType(e) && apiName(e) === 'Account')[0]
      expect(inst.value.reportType).toBeInstanceOf(ReferenceExpression)
      expect(inst.value.reportType?.elemId.getFullName()).toEqual(account.elemID.getFullName())
    })

    it('should resolve field with relative value using instance parent', () => {
      const inst = elements.filter(
        e => isInstanceElement(e) && metadataType(e) === 'WorkflowFieldUpdate'
      )[0] as InstanceElement
      expect(inst.value.field).toBeInstanceOf(ReferenceExpression)
      expect(inst.value.field?.elemId.getFullName()).toEqual('salesforce.Account.field.name')
    })

    it('should resolve field with relative value array using parent target', () => {
      const inst = elements.find(
        e => isInstanceElement(e) && apiName(e.type) === CPQ_CUSTOM_SCRIPT
      ) as InstanceElement
      expect(inst.value[CPQ_QUOTE_LINE_FIELDS]).toBeDefined()
      expect(inst.value[CPQ_QUOTE_LINE_FIELDS]).toHaveLength(1)
      expect(inst.value[CPQ_QUOTE_LINE_FIELDS][0]).toBeInstanceOf(ReferenceExpression)
      expect(inst.value[CPQ_QUOTE_LINE_FIELDS][0]?.elemId.getFullName()).toEqual('salesforce.SBQQ__QuoteLine__c.field.name')
    })

    it('should resolve field with neighbor context using flow action call mapping', () => {
      const inst = elements.filter(
        e => isInstanceElement(e) && metadataType(e) === 'FlowActionCall'
      )[0] as InstanceElement
      expect(inst.value.actionName).toBeInstanceOf(ReferenceExpression)
      expect(inst.value.actionName?.elemId.getFullName()).toEqual('salesforce.ApexClass.instance.class5')
    })

    it('should not resolve if field has no rule', () => {
      const inst = elements.filter(
        e => isInstanceElement(e) && metadataType(e) === 'WorkflowFieldUpdate'
      )[0] as InstanceElement
      expect(inst.value.other).not.toBeInstanceOf(ReferenceExpression)
      expect(inst.value.other).toEqual('name')
    })

    it('should not resolve if referenced does not exist', () => {
      const inst = elements.filter(
        e => isInstanceElement(e) && metadataType(e) === 'LayoutItem'
      )[0] as InstanceElement
      expect(inst.value.field).not.toBeInstanceOf(ReferenceExpression)
      expect(inst.value.field).toEqual('fffff')
    })
  })

  describe('on fetch with modified serialization', () => {
    let elements: Element[]

    beforeAll(async () => {
      elements = generateElements()
      const modifiedDefs = fieldNameToTypeMappingDefs.map(def => _.omit(def, 'serializationStrategy'))
      addReferences(elements, modifiedDefs)
    })
    afterAll(() => {
      jest.clearAllMocks()
    })

    it('should resolve fields with absolute value (parent.field)', () => {
      const inst = elements.filter(
        e => isInstanceElement(e) && metadataType(e) === 'FilterItem'
      )[0] as InstanceElement
      expect(inst.value.field).toBeInstanceOf(ReferenceExpression)
      expect(inst.value.field?.elemId.getFullName()).toEqual('salesforce.Account.field.name')
    })

    it('should fail to resolve field with relative value (because of the modified rule)', () => {
      const inst = elements.filter(
        e => isInstanceElement(e) && metadataType(e) === 'WorkflowFieldUpdate'
      )[0] as InstanceElement
      expect(inst.value.field).not.toBeInstanceOf(ReferenceExpression)
      expect(inst.value.field).toEqual('name')
    })
  })
})

describe('FieldReferences filter - neighbor context strategy', () => {
  const { client } = mockClient()

  const filter = filterCreator({ client, config: {} }) as FilterWith<'onFetch'>

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
      { [INSTANCE_ANNOTATIONS.PARENT]: [
        new ReferenceExpression(new ElemID(SALESFORCE, parentName)),
      ] },
    )
  }

  const generateFlowRecordLookupInstance = (
    flowRecordLookupInstanceName: string,
    value: { object: string; queriedFields: string[] },
  ): InstanceElement => {
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
        { [API_NAME]: [WORKFLOW_ACTION_REFERENCE_METADATA_TYPE, 'queriedFields'].join(API_NAME_SEPARATOR) }
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
          { [INSTANCE_ANNOTATIONS.PARENT]: [
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
      const workflowRuleType = instanceSingleAction.type

      instanceFlowRecordLookup = generateFlowRecordLookupInstance('single', { object: 'User', queriedFields: ['name'] })

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
        instanceFlowRecordLookup, instanceFlowRecordLookup.type,
      ]
      await filter.onFetch(elements)
    })

    it('should have references to the right actions', () => {
      const getFullName = (action: WorkflowActionReference): string => {
        expect(action.name).toBeInstanceOf(ReferenceExpression)
        return (action.name as ReferenceExpression).elemId.getFullName()
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

    it('should have references if referencing field is an array', () => {
      const getFullName = (val: string | ReferenceExpression): string => {
        expect(val).toBeInstanceOf(ReferenceExpression)
        return (val as ReferenceExpression).elemId.getFullName()
      }
      expect(getFullName(instanceFlowRecordLookup.value.queriedFields[0])).toEqual('salesforce.User.field.name')
    })

    it('should not have references when lookup fails', () => {
      expect(instanceUnknownActionName.value.actions.name).toEqual('unknown')
      expect(instanceMissingActionForType.value.actions.name).toEqual('foo')
      expect(instanceInvalidActionType.value.actions.name).toEqual('foo')
    })
  })
})
