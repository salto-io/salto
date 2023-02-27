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
import { Field, isElement, Value, Element, ReferenceExpression, ElemID, isInstanceElement, InstanceElement } from '@salto-io/adapter-api'
import { references as referenceUtils } from '@salto-io/adapter-components'
import { GetLookupNameFunc, GetLookupNameFuncArgs } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import { apiName } from './transformer'
import {
  LAYOUT_ITEM_METADATA_TYPE, WORKFLOW_FIELD_UPDATE_METADATA_TYPE, CUSTOM_OBJECT, API_NAME_SEPARATOR,
  WORKFLOW_ACTION_REFERENCE_METADATA_TYPE, CPQ_LOOKUP_FIELD, CPQ_LOOKUP_QUERY, CPQ_PRICE_RULE,
  CPQ_SOURCE_LOOKUP_FIELD, CPQ_PRICE_ACTION, CPQ_LOOKUP_PRODUCT_FIELD, CPQ_PRODUCT_RULE,
  CPQ_LOOKUP_MESSAGE_FIELD, CPQ_LOOKUP_REQUIRED_FIELD, CPQ_LOOKUP_TYPE_FIELD, CUSTOM_FIELD,
  CPQ_LOOKUP_OBJECT_NAME, CPQ_RULE_LOOKUP_OBJECT_FIELD, CPQ_OBJECT_NAME, CPQ_FIELD_METADATA,
  VALIDATION_RULES_METADATA_TYPE, RECORD_TYPE_METADATA_TYPE, BUSINESS_PROCESS_METADATA_TYPE,
  WEBLINK_METADATA_TYPE, SUMMARY_LAYOUT_ITEM_METADATA_TYPE, CPQ_CUSTOM_SCRIPT, CPQ_QUOTE_FIELDS,
  CPQ_CONSUMPTION_RATE_FIELDS, CPQ_CONSUMPTION_SCHEDULE_FIELDS, CPQ_GROUP_FIELDS,
  CPQ_QUOTE_LINE_FIELDS, DEFAULT_OBJECT_TO_API_MAPPING, SCHEDULE_CONTRAINT_FIELD_TO_API_MAPPING,
  TEST_OBJECT_TO_API_MAPPING, CPQ_TESTED_OBJECT, CPQ_PRICE_SCHEDULE, CPQ_DISCOUNT_SCHEDULE,
  CPQ_CONFIGURATION_ATTRIBUTE, CPQ_DEFAULT_OBJECT_FIELD, CPQ_QUOTE, CPQ_CONSTRAINT_FIELD, CUSTOM_LABEL_METADATA_TYPE,
} from '../constants'

const log = logger(module)
const { awu } = collections.asynciterable
type LookupFunc = (val: Value, context?: string) => string

export type ReferenceSerializationStrategy = {
  serialize: GetLookupNameFunc
  lookup: LookupFunc
}

const safeApiName = ({ ref, path, relative }: {
  ref: ReferenceExpression
  path?: ElemID
  relative?: boolean
}): Promise<string | Value> => {
  const { value } = ref
  if (!isElement(value)) {
    log.warn('Unexpected non-element value for ref id %s in path %s', ref.elemID.getFullName(), path?.getFullName())
    return value
  }
  return apiName(value, relative)
}

type ReferenceSerializationStrategyName = 'absoluteApiName' | 'relativeApiName' | 'configurationAttributeMapping' | 'lookupQueryMapping' | 'scheduleConstraintFieldMapping'
 | 'mapKey' | 'customLabel'
const ReferenceSerializationStrategyLookup: Record<
  ReferenceSerializationStrategyName, ReferenceSerializationStrategy
> = {
  absoluteApiName: {
    serialize: ({ ref, path }) => safeApiName({ ref, path, relative: false }),
    lookup: val => val,
  },
  relativeApiName: {
    serialize: ({ ref, path }) => safeApiName({ ref, path, relative: true }),
    lookup: (val, context) => (context !== undefined
      ? [context, val].join(API_NAME_SEPARATOR)
      : val
    ),
  },
  configurationAttributeMapping: {
    serialize: async ({ ref, path }) => (
      _.invert(DEFAULT_OBJECT_TO_API_MAPPING)[await safeApiName({ ref, path })]
      ?? safeApiName({ ref, path })
    ),
    lookup: val => (_.isString(val) ? (DEFAULT_OBJECT_TO_API_MAPPING[val] ?? val) : val),
  },
  lookupQueryMapping: {
    serialize: async ({ ref, path }) => (
      _.invert(TEST_OBJECT_TO_API_MAPPING)[await safeApiName({ ref, path })]
      ?? safeApiName({ ref, path })
    ),
    lookup: val => (_.isString(val) ? (TEST_OBJECT_TO_API_MAPPING[val] ?? val) : val),
  },
  scheduleConstraintFieldMapping: {
    serialize: async ({ ref, path }) => {
      const relativeApiName = await safeApiName({ ref, path, relative: true })
      return (
        _.invert(SCHEDULE_CONTRAINT_FIELD_TO_API_MAPPING)[relativeApiName]
          ?? relativeApiName
      )
    },
    lookup: (val, context) => {
      const mappedValue = SCHEDULE_CONTRAINT_FIELD_TO_API_MAPPING[val]
      return (context !== undefined
        ? [context, mappedValue].join(API_NAME_SEPARATOR)
        : mappedValue
      )
    },
  },
  mapKey: {
    serialize: async ({ ref }) => ref.elemID.name,
    lookup: val => val,
  },
  customLabel: {
    serialize: async ({ ref, path }) => `$Label${API_NAME_SEPARATOR}${await safeApiName({ ref, path })}`,
    lookup: val => {
      if (val.includes('$Label')) {
        return val.split(API_NAME_SEPARATOR)[1]
      }
      return val
    },
  },
}

export type ReferenceContextStrategyName = (
  'instanceParent' | 'neighborTypeWorkflow' | 'neighborCPQLookup' | 'neighborCPQRuleLookup'
  | 'neighborLookupValueTypeLookup' | 'neighborObjectLookup' | 'neighborPicklistObjectLookup'
  | 'neighborTypeLookup' | 'neighborActionTypeFlowLookup' | 'neighborActionTypeLookup' | 'parentObjectLookup'
  | 'parentInputObjectLookup' | 'parentOutputObjectLookup' | 'neighborSharedToTypeLookup' | 'neighborTableLookup'
  | 'neighborCaseOwnerTypeLookup' | 'neighborAssignedToTypeLookup' | 'neighborRelatedEntityTypeLookup'
)

type SourceDef = {
  field: string | RegExp
  parentTypes: string[]
  // when available, only consider instances matching one or more of the specified types
  instanceTypes?: (string | RegExp)[]
}

/**
 * A rule defining how to convert values to reference expressions (on fetch),
 * and reference expressions back to values (on deploy).
 */
export type FieldReferenceDefinition = {
  src: SourceDef
  serializationStrategy?: ReferenceSerializationStrategyName
  sourceTransformation?: referenceUtils.ReferenceSourceTransformationName
  // If target is missing, the definition is used for resolving
  target?: referenceUtils.ReferenceTargetDefinition<ReferenceContextStrategyName>
}

export const defaultFieldNameToTypeMappingDefs: FieldReferenceDefinition[] = [
  {
    src: { field: 'field', parentTypes: [WORKFLOW_FIELD_UPDATE_METADATA_TYPE, LAYOUT_ITEM_METADATA_TYPE, SUMMARY_LAYOUT_ITEM_METADATA_TYPE, 'WorkflowEmailRecipient', 'QuickActionLayoutItem', 'FieldSetItem'] },
    serializationStrategy: 'relativeApiName',
    target: { parentContext: 'instanceParent', type: CUSTOM_FIELD },
  },
  {
    src: { field: 'flowName', parentTypes: ['FlowSubflow'] },
    target: { type: 'Flow' },
  },
  {
    src: { field: 'flowDefinition', parentTypes: ['QuickAction'] },
    target: { type: 'Flow' },
  },
  {
    src: { field: 'lightningComponent', parentTypes: ['QuickAction'] },
    target: { type: 'AuraDefinitionBundle' },
  },
  {
    src: { field: 'lightningComponent', parentTypes: ['QuickAction'] },
    target: { type: 'ApexPage' },
  },
  {
    src: { field: 'letterhead', parentTypes: ['EmailTemplate'] },
    target: { type: 'Letterhead' },
  },
  {
    src: { field: 'fields', parentTypes: ['WorkflowOutboundMessage'] },
    serializationStrategy: 'relativeApiName',
    target: { parentContext: 'instanceParent', type: CUSTOM_FIELD },
  },
  // note: not all field values under ReportColumn match this rule - but it's ok because
  // only the ones that match are currently extracted (SALTO-1758)
  {
    src: {
      field: 'field',
      parentTypes: ['ReportColumn', 'PermissionSetFieldPermissions'],
    },
    target: { type: CUSTOM_FIELD },
  },
  {
    src: {
      field: 'field',
      parentTypes: ['FilterItem'],
      // match everything except SharingRules (which uses a different serialization strategy)
      instanceTypes: [/^(?!SharingRules$).*/],
    },
    target: { type: CUSTOM_FIELD },
  },
  {
    src: {
      field: 'field',
      parentTypes: ['FilterItem'],
      instanceTypes: ['SharingRules'],
    },
    serializationStrategy: 'relativeApiName',
    target: { parentContext: 'instanceParent', type: CUSTOM_FIELD },
  },
  {
    src: { field: 'offsetFromField', parentTypes: ['WorkflowTask', 'WorkflowTimeTrigger'] },
    target: { type: CUSTOM_FIELD },
  },
  {
    src: { field: 'customLink', parentTypes: [LAYOUT_ITEM_METADATA_TYPE, SUMMARY_LAYOUT_ITEM_METADATA_TYPE] },
    serializationStrategy: 'relativeApiName',
    target: { parentContext: 'instanceParent', type: WEBLINK_METADATA_TYPE },
  },
  ...([CUSTOM_FIELD, 'FieldSet', 'RecordType', 'SharingReason', WEBLINK_METADATA_TYPE, 'WorkflowTask', VALIDATION_RULES_METADATA_TYPE, 'QuickAction'].map(
    (targetType): FieldReferenceDefinition => ({
      src: { field: 'name', parentTypes: [`${targetType}Translation`] },
      serializationStrategy: 'relativeApiName',
      target: { parentContext: 'instanceParent', type: targetType },
    })
  )),
  {
    src: { field: 'name', parentTypes: [WORKFLOW_ACTION_REFERENCE_METADATA_TYPE] },
    serializationStrategy: 'relativeApiName',
    target: { parentContext: 'instanceParent', typeContext: 'neighborTypeWorkflow' },
  },
  {
    src: { field: 'name', parentTypes: ['GlobalQuickActionTranslation'] },
    target: { type: 'QuickAction' },
  },
  {
    src: { field: 'businessHours', parentTypes: ['EntitlementProcess', 'EntitlementProcessMilestoneItem'] },
    target: { type: 'BusinessHoursEntry' },
    serializationStrategy: 'mapKey',
  },
  {
    src: { field: 'businessProcess', parentTypes: [RECORD_TYPE_METADATA_TYPE] },
    serializationStrategy: 'relativeApiName',
    target: { parentContext: 'instanceParent', type: BUSINESS_PROCESS_METADATA_TYPE },
  },
  {
    // includes authorizationRequiredPage, bandwidthExceededPage, fileNotFoundPage, ...
    src: { field: /Page$/, parentTypes: ['CustomSite'] },
    target: { type: 'ApexPage' },
  },
  {
    src: { field: 'apexClass', parentTypes: ['FlowApexPluginCall', 'FlowVariable', 'ProfileApexClassAccess', 'TransactionSecurityPolicy'] },
    target: { type: 'ApexClass' },
  },
  {
    src: { field: 'recipient', parentTypes: ['WorkflowEmailRecipient'] },
    target: { type: 'Role' },
  },
  {
    src: { field: 'application', parentTypes: ['ProfileApplicationVisibility'] },
    target: { type: 'CustomApplication' },
  },
  {
    src: { field: 'permissionSets', parentTypes: ['PermissionSetGroup', 'DelegateGroup'] },
    target: { type: 'PermissionSet' },
  },
  {
    src: { field: 'layout', parentTypes: ['ProfileLayoutAssignment'] },
    target: { type: 'Layout' },
  },
  {
    src: { field: 'recordType', parentTypes: ['ProfileLayoutAssignment'] },
    target: { type: 'RecordType' },
  },
  {
    src: { field: 'flow', parentTypes: ['ProfileFlowAccess'] },
    target: { type: 'Flow' },
  },
  {
    src: { field: 'recordType', parentTypes: ['ProfileRecordTypeVisibility'] },
    target: { type: 'RecordType' },
  },
  {
    src: { field: 'tabs', parentTypes: ['CustomApplication'] },
    target: { type: 'CustomTab' },
  },
  {
    src: { field: 'tab', parentTypes: ['WorkspaceMapping'] },
    target: { type: 'CustomTab' },
  },
  {
    src: { field: 'actionName', parentTypes: ['FlowActionCall'] },
    target: { typeContext: 'neighborActionTypeFlowLookup' },
  },
  {
    src: { field: 'actionName', parentTypes: ['PlatformActionListItem'] },
    // will only resolve for actionType = QuickAction
    target: { typeContext: 'neighborActionTypeLookup' },
  },
  {
    src: { field: 'quickActionName', parentTypes: ['QuickActionListItem'] },
    target: { type: 'QuickAction' },
  },
  {
    src: { field: 'content', parentTypes: ['AppActionOverride', 'ActionOverride'] },
    target: { type: 'LightningPage' },
  },
  {
    src: { field: 'name', parentTypes: ['AppMenuItem'] },
    target: { typeContext: 'neighborTypeLookup' },
  },
  {
    src: { field: 'objectType', parentTypes: ['FlowVariable'] },
    target: { type: CUSTOM_OBJECT },
  },
  {
    src: { field: 'object', parentTypes: ['ProfileObjectPermissions', 'FlowDynamicChoiceSet', 'FlowRecordLookup', 'FlowRecordUpdate', 'FlowRecordCreate', 'FlowRecordDelete', 'FlowStart', 'PermissionSetObjectPermissions'] },
    target: { type: CUSTOM_OBJECT },
  },
  {
    src: { field: 'picklistObject', parentTypes: ['FlowDynamicChoiceSet'] },
    target: { type: CUSTOM_OBJECT },
  },
  {
    src: { field: 'targetObject', parentTypes: ['QuickAction', 'AnalyticSnapshot'] },
    target: { type: CUSTOM_OBJECT },
  },
  {
    src: { field: 'inputObject', parentTypes: ['ObjectMapping'] },
    target: { type: CUSTOM_OBJECT },
  },
  {
    src: { field: 'outputObject', parentTypes: ['ObjectMapping'] },
    target: { type: CUSTOM_OBJECT },
  },
  {
    src: { field: 'matchRuleSObjectType', parentTypes: ['DuplicateRuleMatchRule'] },
    target: { type: CUSTOM_OBJECT },
  },
  {
    src: { field: 'typeValue', parentTypes: ['FlowDataTypeMapping'] },
    target: { type: CUSTOM_OBJECT },
  },
  {
    src: { field: 'targetObject', parentTypes: ['WorkflowFieldUpdate'] },
    target: { parentContext: 'instanceParent', type: CUSTOM_FIELD },
  },
  {
    src: { field: 'targetField', parentTypes: ['AnalyticSnapshot'] },
    target: { type: CUSTOM_FIELD },
  },
  {
    src: { field: 'name', parentTypes: ['ObjectSearchSetting'] },
    target: { type: CUSTOM_OBJECT },
  },
  {
    src: { field: 'report', parentTypes: ['DashboardComponent'] },
    target: { type: 'Report' },
  },
  {
    src: { field: 'reportType', parentTypes: ['Report'] },
    target: { type: CUSTOM_OBJECT },
  },
  {
    src: { field: 'entryStartDateField', parentTypes: ['EntitlementProcess'] },
    target: { type: CUSTOM_FIELD },
  },
  {
    src: { field: 'SObjectType', parentTypes: ['EntitlementProcess'] },
    target: { type: CUSTOM_OBJECT },
  },
  {
    src: { field: CPQ_LOOKUP_OBJECT_NAME, parentTypes: [CPQ_PRICE_RULE, CPQ_PRODUCT_RULE] },
    target: { type: CUSTOM_OBJECT },
  },
  {
    src: { field: CPQ_RULE_LOOKUP_OBJECT_FIELD, parentTypes: [CPQ_LOOKUP_QUERY, CPQ_PRICE_ACTION] },
    target: { type: CUSTOM_OBJECT },
  },
  {
    src: { field: CPQ_DEFAULT_OBJECT_FIELD, parentTypes: [CPQ_CONFIGURATION_ATTRIBUTE] },
    serializationStrategy: 'configurationAttributeMapping',
    target: { type: CUSTOM_OBJECT },
  },
  {
    src: { field: CPQ_TESTED_OBJECT, parentTypes: [CPQ_LOOKUP_QUERY] },
    serializationStrategy: 'lookupQueryMapping',
    target: { type: CUSTOM_OBJECT },
  },
  {
    src: { field: CPQ_OBJECT_NAME, parentTypes: [CPQ_FIELD_METADATA] },
    target: { type: CUSTOM_OBJECT },
  },
  {
    src: { field: 'relatedList', parentTypes: ['RelatedListItem'] },
    target: { type: CUSTOM_FIELD },
  },
  {
    src: { field: 'value', parentTypes: ['FilterItem'] },
    serializationStrategy: 'relativeApiName',
    target: { parentContext: 'instanceParent', type: RECORD_TYPE_METADATA_TYPE },
  },
  {
    src: { field: 'sharedTo', parentTypes: ['FolderShare'] },
    target: { typeContext: 'neighborSharedToTypeLookup' },
  },
  {
    src: { field: 'role', parentTypes: ['SharedTo'] },
    target: { type: 'Role' },
  },
  {
    src: { field: 'roleAndSubordinates', parentTypes: ['SharedTo'] },
    target: { type: 'Role' },
  },
  {
    src: { field: 'group', parentTypes: ['SharedTo'] },
    target: { type: 'Group' },
  },
  {
    src: { field: 'compactLayoutAssignment', parentTypes: [RECORD_TYPE_METADATA_TYPE] },
    serializationStrategy: 'relativeApiName',
    target: { parentContext: 'instanceParent', type: 'CompactLayout' },
  },
  {
    src: { field: 'template', parentTypes: ['RuleEntry'] },
    target: { type: 'EmailTemplate' },
  },
  {
    src: { field: 'field', parentTypes: ['ReportGrouping'] },
    target: { parentContext: 'instanceParent', type: CUSTOM_FIELD },
  },
  {
    src: { field: 'field', parentTypes: ['ReportTypeColumn'] },
    serializationStrategy: 'relativeApiName',
    target: { parentContext: 'neighborTableLookup', type: CUSTOM_FIELD },
  },
  {
    src: { field: 'publicGroup', parentTypes: ['PublicGroups'] },
    target: { type: 'Group' },
  },
  {
    src: { field: 'role', parentTypes: ['Roles'] },
    target: { type: 'Role' },
  },
  {
    // sometimes has a value that is not a reference - should only convert to reference
    // if lookupValueType exists
    src: { field: 'lookupValue', parentTypes: ['WorkflowFieldUpdate'] },
    target: { typeContext: 'neighborLookupValueTypeLookup' },
  },
  ...(['displayField', 'sortField', 'valueField'].map(
    (fieldName): FieldReferenceDefinition => ({
      src: { field: fieldName, parentTypes: ['FlowDynamicChoiceSet'] },
      serializationStrategy: 'relativeApiName',
      target: { parentContext: 'neighborObjectLookup', type: CUSTOM_FIELD },
    })
  )),
  ...(['queriedFields', 'sortField'].map(
    (fieldName): FieldReferenceDefinition => ({
      src: { field: fieldName, parentTypes: ['FlowRecordLookup'] },
      serializationStrategy: 'relativeApiName',
      target: { parentContext: 'neighborObjectLookup', type: CUSTOM_FIELD },
    })
  )),
  {
    src: { field: 'field', parentTypes: ['FlowRecordFilter', 'FlowInputFieldAssignment', 'FlowOutputFieldAssignment'] },
    serializationStrategy: 'relativeApiName',
    target: { parentContext: 'parentObjectLookup', type: CUSTOM_FIELD },
  },
  {
    src: { field: 'inputField', parentTypes: ['ObjectMappingField'] },
    serializationStrategy: 'relativeApiName',
    target: { parentContext: 'parentInputObjectLookup', type: CUSTOM_FIELD },
  },
  {
    src: { field: 'outputField', parentTypes: ['ObjectMappingField'] },
    serializationStrategy: 'relativeApiName',
    target: { parentContext: 'parentOutputObjectLookup', type: CUSTOM_FIELD },
  },
  {
    src: { field: 'picklistField', parentTypes: ['FlowDynamicChoiceSet'] },
    serializationStrategy: 'relativeApiName',
    target: { parentContext: 'neighborPicklistObjectLookup', type: CUSTOM_FIELD },
  },
  {
    src: { field: CPQ_LOOKUP_FIELD, parentTypes: [CPQ_LOOKUP_QUERY] },
    serializationStrategy: 'relativeApiName',
    target: { parentContext: 'neighborCPQRuleLookup', type: CUSTOM_FIELD },
  },
  {
    src: { field: CPQ_SOURCE_LOOKUP_FIELD, parentTypes: [CPQ_PRICE_ACTION] },
    serializationStrategy: 'relativeApiName',
    target: { parentContext: 'neighborCPQRuleLookup', type: CUSTOM_FIELD },
  },
  {
    src: { field: 'errorDisplayField', parentTypes: ['ValidationRule'] },
    serializationStrategy: 'relativeApiName',
    target: { parentContext: 'instanceParent', type: CUSTOM_FIELD },
  },
  {
    src: { field: 'picklist', parentTypes: ['RecordTypePicklistValue'] },
    serializationStrategy: 'relativeApiName',
    target: { parentContext: 'instanceParent', type: CUSTOM_FIELD },
  },
  {
    src: { field: 'page', parentTypes: ['WebLink'] },
    target: { type: 'ApexPage' },
  },
  {
    src: { field: 'value', parentTypes: ['ComponentInstanceProperty'] },
    target: { type: 'Flow' },
  },
  {
    src: { field: CPQ_LOOKUP_PRODUCT_FIELD, parentTypes: [CPQ_PRODUCT_RULE, CPQ_PRICE_RULE] },
    serializationStrategy: 'relativeApiName',
    target: { parentContext: 'neighborCPQLookup', type: CUSTOM_FIELD },
  },
  {
    src: { field: CPQ_LOOKUP_MESSAGE_FIELD, parentTypes: [CPQ_PRODUCT_RULE, CPQ_PRICE_RULE] },
    serializationStrategy: 'relativeApiName',
    target: { parentContext: 'neighborCPQLookup', type: CUSTOM_FIELD },
  },
  {
    src: { field: CPQ_LOOKUP_REQUIRED_FIELD, parentTypes: [CPQ_PRODUCT_RULE, CPQ_PRICE_RULE] },
    serializationStrategy: 'relativeApiName',
    target: { parentContext: 'neighborCPQLookup', type: CUSTOM_FIELD },
  },
  {
    src: { field: CPQ_LOOKUP_TYPE_FIELD, parentTypes: [CPQ_PRODUCT_RULE, CPQ_PRICE_RULE] },
    serializationStrategy: 'relativeApiName',
    target: { parentContext: 'neighborCPQLookup', type: CUSTOM_FIELD },
  },
  {
    src: { field: CPQ_CONSUMPTION_RATE_FIELDS, parentTypes: [CPQ_CUSTOM_SCRIPT] },
    serializationStrategy: 'relativeApiName',
    target: { parent: 'ConsumptionRate', type: CUSTOM_FIELD },
  },
  {
    src: { field: CPQ_CONSUMPTION_SCHEDULE_FIELDS, parentTypes: [CPQ_CUSTOM_SCRIPT] },
    serializationStrategy: 'relativeApiName',
    target: { parent: 'ConsumptionSchedule', type: CUSTOM_FIELD },
  },
  {
    src: { field: CPQ_GROUP_FIELDS, parentTypes: [CPQ_CUSTOM_SCRIPT] },
    serializationStrategy: 'relativeApiName',
    target: { parent: 'SBQQ__QuoteLineGroup__c', type: CUSTOM_FIELD },
  },
  {
    src: { field: CPQ_QUOTE_FIELDS, parentTypes: [CPQ_CUSTOM_SCRIPT] },
    serializationStrategy: 'relativeApiName',
    target: { parent: 'SBQQ__Quote__c', type: CUSTOM_FIELD },
  },
  {
    src: { field: CPQ_QUOTE_LINE_FIELDS, parentTypes: [CPQ_CUSTOM_SCRIPT] },
    serializationStrategy: 'relativeApiName',
    target: { parent: 'SBQQ__QuoteLine__c', type: CUSTOM_FIELD },
  },
  {
    src: { field: 'SBQQ__FieldName__c', parentTypes: ['SBQQ__LineColumn__c'] },
    serializationStrategy: 'relativeApiName',
    target: { parent: 'SBQQ__QuoteLine__c', type: CUSTOM_FIELD },
  },
  {
    src: { field: 'SBQQ__FieldName__c', parentTypes: [CPQ_FIELD_METADATA] },
    serializationStrategy: 'relativeApiName',
    target: { parent: CPQ_OBJECT_NAME, type: CUSTOM_FIELD },
  },
  {
    src: { field: CPQ_CONSTRAINT_FIELD, parentTypes: [CPQ_PRICE_SCHEDULE, CPQ_DISCOUNT_SCHEDULE] },
    serializationStrategy: 'scheduleConstraintFieldMapping',
    target: { parent: CPQ_QUOTE, type: CUSTOM_FIELD },
  },

  // note: not all column and xColumn values match this rule - but it's ok because
  // only the ones that match are currently extracted (SALTO-1758)
  {
    src: { field: 'groupingColumn', parentTypes: ['Report'] },
    target: { type: CUSTOM_FIELD },
  },
  {
    src: { field: 'secondaryGroupingColumn', parentTypes: ['Report'] },
    target: { type: CUSTOM_FIELD },
  },
  {
    src: { field: 'column', parentTypes: ['ReportFilterItem', 'DashboardFilterColumn', 'DashboardTableColumn'] },
    target: { type: CUSTOM_FIELD },
  },
  {
    src: { field: 'recipient', parentTypes: ['WorkflowEmailRecipient'] },
    target: { type: 'Group' },
  },
  {
    src: { field: 'queue', parentTypes: ['ListView'] },
    target: { type: 'Queue' },
  },
  {
    src: { field: 'caseOwner', parentTypes: ['EmailToCaseRoutingAddress'] },
    target: { typeContext: 'neighborCaseOwnerTypeLookup' },
  },
  {
    src: { field: 'assignedTo', parentTypes: ['RuleEntry', 'EscalationAction'] },
    target: { typeContext: 'neighborAssignedToTypeLookup' },
  },
  {
    src: { field: 'assignedToTemplate', parentTypes: ['EscalationAction'] },
    target: { type: 'EmailTemplate' },
  },
  {
    src: { field: 'caseAssignNotificationTemplate', parentTypes: ['CaseSettings'] },
    target: { type: 'EmailTemplate' },
  },
  {
    src: { field: 'caseCloseNotificationTemplate', parentTypes: ['CaseSettings'] },
    target: { type: 'EmailTemplate' },
  },
  {
    src: { field: 'caseCommentNotificationTemplate', parentTypes: ['CaseSettings'] },
    target: { type: 'EmailTemplate' },
  },
  {
    src: { field: 'caseCreateNotificationTemplate', parentTypes: ['CaseSettings'] },
    target: { type: 'EmailTemplate' },
  },
  {
    src: { field: 'relatedEntityType', parentTypes: ['ServiceChannel'] },
    target: { type: CUSTOM_OBJECT },
  },
  {
    src: { field: 'secondaryRoutingPriorityField', parentTypes: ['ServiceChannel'] },
    serializationStrategy: 'relativeApiName',
    target: { parentContext: 'neighborRelatedEntityTypeLookup', type: CUSTOM_FIELD },
  },
  {
    src: { field: 'entitlementProcess', parentTypes: ['EntitlementTemplate'] },
    target: { type: 'EntitlementProcess' },
    sourceTransformation: 'asCaseInsensitiveString',
  },
  {
    src: { field: 'elementReference', parentTypes: ['FlowElementReferenceOrValue'] },
    serializationStrategy: 'customLabel',
    target: { type: CUSTOM_LABEL_METADATA_TYPE },
  },
]

// Optional reference that should not be used if enumFieldPermissions config is on
const fieldPermissionEnumDisabledExtraMappingDefs: FieldReferenceDefinition[] = [
  {
    src: { field: 'field', parentTypes: ['ProfileFieldLevelSecurity'] },
    target: { type: CUSTOM_FIELD },
  },
]

/**
 * The rules for finding and resolving values into (and back from) reference expressions.
 * Overlaps between rules are allowed, and the first successful conversion wins.
 * Current order (defined by generateReferenceResolverFinder):
 *  1. Exact field names take precedence over regexp
 *  2. Order within each group is currently *not* guaranteed (groupBy is not stable)
 *
 * A value will be converted into a reference expression if:
 * 1. An element matching the rule is found.
 * 2. Resolving the resulting reference expression back returns the original value.
 */
export const fieldNameToTypeMappingDefs: FieldReferenceDefinition[] = [
  ...defaultFieldNameToTypeMappingDefs,
  ...fieldPermissionEnumDisabledExtraMappingDefs,
]

const matchName = (name: string, matcher: string | RegExp): boolean => (
  _.isString(matcher)
    ? matcher === name
    : matcher.test(name)
)

const matchApiName = async (elem: Element, types: string[]): Promise<boolean> => (
  types.includes(await apiName(elem))
)

const matchInstanceType = async (
  inst: InstanceElement,
  matchers: (string | RegExp)[],
): Promise<boolean> => {
  const typeName = await apiName(await inst.getType())
  return matchers.some(matcher => matchName(typeName, matcher))
}

export class FieldReferenceResolver {
  src: SourceDef
  serializationStrategy: ReferenceSerializationStrategy
  sourceTransformation: referenceUtils.ReferenceSourceTransformation
  target?: referenceUtils.ExtendedReferenceTargetDefinition<ReferenceContextStrategyName>

  constructor(def: FieldReferenceDefinition) {
    this.src = def.src
    this.serializationStrategy = ReferenceSerializationStrategyLookup[
      def.serializationStrategy ?? 'absoluteApiName'
    ]
    this.sourceTransformation = referenceUtils.ReferenceSourceTransformationLookup[def.sourceTransformation ?? 'asString']
    this.target = def.target
      ? { ...def.target, lookup: this.serializationStrategy.lookup }
      : undefined
  }

  static create(def: FieldReferenceDefinition): FieldReferenceResolver {
    return new FieldReferenceResolver(def)
  }

  async match(field: Field, element: Element): Promise<boolean> {
    return (
      matchName(field.name, this.src.field)
      && await matchApiName(field.parent, this.src.parentTypes)
      && (this.src.instanceTypes === undefined
        || (isInstanceElement(element) && matchInstanceType(element, this.src.instanceTypes)))
    )
  }
}

export type ReferenceResolverFinder = (
  field: Field,
  element: Element,
) => Promise<FieldReferenceResolver[]>

/**
 * Generates a function that filters the relevant resolvers for a given field.
 */
export const generateReferenceResolverFinder = (
  defs = fieldNameToTypeMappingDefs
): ReferenceResolverFinder => {
  const referenceDefinitions = defs.map(
    def => FieldReferenceResolver.create(def)
  )

  const matchersByFieldName = _(referenceDefinitions)
    .filter(def => _.isString(def.src.field))
    .groupBy(def => def.src.field)
    .value()
  const regexFieldMatchersByParent = _(referenceDefinitions)
    .filter(def => _.isRegExp(def.src.field))
    .flatMap(def => def.src.parentTypes.map(parentType => ({ parentType, def })))
    .groupBy(({ parentType }) => parentType)
    .mapValues(items => items.map(item => item.def))
    .value()

  return (async (field, element) => awu([
    ...(matchersByFieldName[field.name] ?? []),
    ...(regexFieldMatchersByParent[await apiName(field.parent)] || []),
  ]).filter(resolver => resolver.match(field, element)).toArray())
}

const getLookUpNameImpl = (defs = fieldNameToTypeMappingDefs): GetLookupNameFunc => {
  const resolverFinder = generateReferenceResolverFinder(defs)

  const determineLookupStrategy = async (args: GetLookupNameFuncArgs):
    Promise<ReferenceSerializationStrategy | undefined> => {
    if (args.field === undefined) {
      log.debug('could not determine field for path %s', args.path?.getFullName())
      return undefined
    }
    const strategies = (await resolverFinder(args.field, args.element))
      .map(def => def.serializationStrategy)

    if (strategies.length === 0) {
      log.debug('could not find matching strategy for field %s', args.field.elemID.getFullName())
      return undefined
    }

    if (strategies.length > 1) {
      log.debug(
        'found %d matching strategies for field %s - using the first one',
        strategies.length,
        args.field.elemID.getFullName(),
      )
    }

    return strategies[0]
  }

  return async ({ ref, path, field, element }) => {
    // We skip resolving instance annotations because they are not deployed to the service
    // and we need the full element context in those
    const isInstanceAnnotation = path?.idType === 'instance' && path.isAttrID()

    if (!isInstanceAnnotation) {
      const strategy = await determineLookupStrategy({ ref, path, field, element })
      if (strategy !== undefined) {
        return strategy.serialize({ ref, field, element })
      }
      if (isElement(ref.value)) {
        const defaultStrategy = ReferenceSerializationStrategyLookup.absoluteApiName
        return defaultStrategy.serialize({ ref, element })
      }
    }
    return ref.value
  }
}

/**
 * Translate a reference expression back to its original value before deploy.
 */
export const getLookUpName = getLookUpNameImpl()
