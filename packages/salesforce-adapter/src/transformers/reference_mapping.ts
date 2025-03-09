/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  Field,
  isElement,
  Value,
  Element,
  ReferenceExpression,
  ElemID,
  isInstanceElement,
  InstanceElement,
  isField,
  isObjectType,
  Change,
} from '@salto-io/adapter-api'
import { references as referenceUtils, resolveChangeElement, resolveValues } from '@salto-io/adapter-components'
import { GetLookupNameFunc, GetLookupNameFuncArgs, inspectValue, ResolveValuesFunc } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import { apiName, isMetadataInstanceElement } from './transformer'
import {
  API_NAME_SEPARATOR,
  DEFAULT_OBJECT_TO_API_MAPPING,
  SCHEDULE_CONSTRAINT_FIELD_TO_API_MAPPING,
  TEST_OBJECT_TO_API_MAPPING,
} from '../constants'
import { instanceInternalId, isOrderedMapTypeOrRefType } from '../filters/utils'
import { FetchProfile } from '../types'

const log = logger(module)
const { awu } = collections.asynciterable
type LookupFunc = (val: Value, context?: string) => string

type ReferenceSerializationStrategy = {
  serialize: GetLookupNameFunc
  lookup: LookupFunc
}

const safeApiName = ({
  ref,
  path,
  relative,
}: {
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

type ReferenceSerializationStrategyName =
  | 'absoluteApiName'
  | 'relativeApiName'
  | 'configurationAttributeMapping'
  | 'lookupQueryMapping'
  | 'scheduleConstraintFieldMapping'
  | 'mapKey'
  | 'customLabel'
  | 'fromDataInstance'
  | 'recordField'
  | 'recordFieldDollarPrefix'
  | 'flexiPageleftValueField'
export const ReferenceSerializationStrategyLookup: Record<
  ReferenceSerializationStrategyName,
  ReferenceSerializationStrategy
> = {
  absoluteApiName: {
    serialize: ({ ref, path }) => safeApiName({ ref, path, relative: false }),
    lookup: val => val,
  },
  relativeApiName: {
    serialize: ({ ref, path }) => safeApiName({ ref, path, relative: true }),
    lookup: (val, context) => (context !== undefined ? [context, val].join(API_NAME_SEPARATOR) : val),
  },
  configurationAttributeMapping: {
    serialize: async ({ ref, path }) =>
      _.invert(DEFAULT_OBJECT_TO_API_MAPPING)[await safeApiName({ ref, path })] ?? safeApiName({ ref, path }),
    lookup: val => (_.isString(val) ? DEFAULT_OBJECT_TO_API_MAPPING[val] ?? val : val),
  },
  lookupQueryMapping: {
    serialize: async ({ ref, path }) =>
      _.invert(TEST_OBJECT_TO_API_MAPPING)[await safeApiName({ ref, path })] ?? safeApiName({ ref, path }),
    lookup: val => (_.isString(val) ? TEST_OBJECT_TO_API_MAPPING[val] ?? val : val),
  },
  scheduleConstraintFieldMapping: {
    serialize: async ({ ref, path }) => {
      const relativeApiName = await safeApiName({ ref, path, relative: true })
      return _.invert(SCHEDULE_CONSTRAINT_FIELD_TO_API_MAPPING)[relativeApiName] ?? relativeApiName
    },
    lookup: (val, context) => {
      const mappedValue = SCHEDULE_CONSTRAINT_FIELD_TO_API_MAPPING[val]
      return context !== undefined ? [context, mappedValue].join(API_NAME_SEPARATOR) : mappedValue
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
  fromDataInstance: {
    serialize: async args =>
      (await isMetadataInstanceElement(args.ref.value))
        ? instanceInternalId(args.ref.value)
        : ReferenceSerializationStrategyLookup.absoluteApiName.serialize(args),
    lookup: val => val,
  },
  recordField: {
    serialize: async ({ ref, path }) =>
      `Record${API_NAME_SEPARATOR}${await safeApiName({ ref, path, relative: true })}`,
    lookup: (val, context) => {
      if (context !== undefined && _.isString(val) && val.startsWith('Record.')) {
        return [context, val.split(API_NAME_SEPARATOR)[1]].join(API_NAME_SEPARATOR)
      }
      return val
    },
  },
  recordFieldDollarPrefix: {
    serialize: async ({ ref, path }) =>
      `$Record${API_NAME_SEPARATOR}${await safeApiName({ ref, path, relative: true })}`,
    lookup: (val, context) => {
      if (context !== undefined && _.isString(val) && val.startsWith('$Record.')) {
        return [context, val.split(API_NAME_SEPARATOR)[1]].join(API_NAME_SEPARATOR)
      }
      return val
    },
  },
  flexiPageleftValueField: {
    serialize: async ({ ref, path }) =>
      `{!Record${API_NAME_SEPARATOR}${await safeApiName({ ref, path, relative: true })}}`,
    lookup: (val, context) => {
      if (context !== undefined && _.isString(val) && val.startsWith('{!Record.')) {
        return [context, val.split(API_NAME_SEPARATOR)[1].replace(/}$/, '')].join(API_NAME_SEPARATOR)
      }
      return val
    },
  },
}

export type ReferenceContextStrategyName =
  | 'instanceParent'
  | 'neighborTypeWorkflow'
  | 'neighborCPQLookup'
  | 'neighborCPQRuleLookup'
  | 'neighborLookupValueTypeLookup'
  | 'neighborObjectLookup'
  | 'neighborSobjectLookup'
  | 'neighborPicklistObjectLookup'
  | 'neighborTypeLookup'
  | 'neighborActionTypeFlowLookup'
  | 'neighborActionTypeLookup'
  | 'parentObjectLookup'
  | 'parentInputObjectLookup'
  | 'parentOutputObjectLookup'
  | 'neighborSharedToTypeLookup'
  | 'neighborTableLookup'
  | 'neighborCaseOwnerTypeLookup'
  | 'neighborAssignedToTypeLookup'
  | 'neighborRelatedEntityTypeLookup'
  | 'parentSObjectTypeLookupTopLevel'

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
export const referenceMappingDefs: Record<string, FieldReferenceDefinition> = {
  'GenAiPlannerFunctionDef.genAiFunctionName': {
    src: {
      field: 'genAiFunctionName',
      parentTypes: ['GenAiPlannerFunctionDef'],
    },
    target: {
      type: 'GenAiFunction',
    },
  },
  'GenAiPlannerFunctionDef.genAiPluginName': {
    src: {
      field: 'genAiPluginName',
      parentTypes: ['GenAiPlannerFunctionDef'],
    },
    target: {
      type: 'GenAiPlugin',
    },
  },
  'GenAiPluginFunctionDef.functionName': {
    src: {
      field: 'functionName',
      parentTypes: ['GenAiPluginFunctionDef'],
    },
    target: {
      type: 'GenAiFunction',
    },
  },
  'PackageVersion.namespace': {
    src: {
      field: 'namespace',
      parentTypes: ['PackageVersion'],
    },
    target: {
      type: 'InstalledPackage',
    },
  },
  'Network.changePasswordTemplate': {
    src: {
      field: 'changePasswordTemplate',
      parentTypes: ['Network'],
    },
    target: {
      type: 'EmailTemplate',
    },
  },
  'Network.chgEmailVerNewTemplate': {
    src: {
      field: 'chgEmailVerNewTemplate',
      parentTypes: ['Network'],
    },
    target: {
      type: 'EmailTemplate',
    },
  },
  'Network.chgEmailVerOldTemplate': {
    src: {
      field: 'chgEmailVerOldTemplate',
      parentTypes: ['Network'],
    },
    target: {
      type: 'EmailTemplate',
    },
  },
  'Network.forgotPasswordTemplate': {
    src: {
      field: 'forgotPasswordTemplate',
      parentTypes: ['Network'],
    },
    target: {
      type: 'EmailTemplate',
    },
  },
  'Network.lockoutTemplate': {
    src: {
      field: 'lockoutTemplate',
      parentTypes: ['Network'],
    },
    target: {
      type: 'EmailTemplate',
    },
  },
  'Network.verificationTemplate': {
    src: {
      field: 'verificationTemplate',
      parentTypes: ['Network'],
    },
    target: {
      type: 'EmailTemplate',
    },
  },
  'Network.welcomeTemplate': {
    src: {
      field: 'welcomeTemplate',
      parentTypes: ['Network'],
    },
    target: {
      type: 'EmailTemplate',
    },
  },
  'WorkflowFieldUpdate.field': {
    src: {
      field: 'field',
      parentTypes: [
        'WorkflowFieldUpdate',
        'LayoutItem',
        'SummaryLayoutItem',
        'WorkflowEmailRecipient',
        'QuickActionLayoutItem',
        'FieldSetItem',
      ],
    },
    serializationStrategy: 'relativeApiName',
    target: {
      parentContext: 'instanceParent',
      type: 'CustomField',
    },
  },
  'FlowSubflow.flowName': {
    src: {
      field: 'flowName',
      parentTypes: ['FlowSubflow'],
    },
    target: {
      type: 'Flow',
    },
  },
  'QuickAction.flowDefinition': {
    src: {
      field: 'flowDefinition',
      parentTypes: ['QuickAction'],
    },
    target: {
      type: 'Flow',
    },
  },
  'QuickAction.lightningComponent': {
    src: {
      field: 'lightningComponent',
      parentTypes: ['QuickAction'],
    },
    target: {
      type: 'ApexPage',
    },
  },
  'EmailTemplate.letterhead': {
    src: {
      field: 'letterhead',
      parentTypes: ['EmailTemplate'],
    },
    target: {
      type: 'Letterhead',
    },
  },
  'WorkflowOutboundMessage.fields': {
    src: {
      field: 'fields',
      parentTypes: ['WorkflowOutboundMessage'],
    },
    serializationStrategy: 'relativeApiName',
    target: {
      parentContext: 'instanceParent',
      type: 'CustomField',
    },
  },
  'ReportColumn.field': {
    src: {
      field: 'field',
      parentTypes: ['ReportColumn'],
    },
    target: {
      type: 'CustomField',
    },
  },
  'FilterItem.field': {
    src: {
      field: 'field',
      parentTypes: ['FilterItem'],
      instanceTypes: ['SharingRules'],
    },
    serializationStrategy: 'relativeApiName',
    target: {
      parentContext: 'instanceParent',
      type: 'CustomField',
    },
  },
  'WorkflowTask.offsetFromField': {
    src: {
      field: 'offsetFromField',
      parentTypes: ['WorkflowTask', 'WorkflowTimeTrigger'],
    },
    target: {
      type: 'CustomField',
    },
  },
  'LayoutItem.customLink': {
    src: {
      field: 'customLink',
      parentTypes: ['LayoutItem', 'SummaryLayoutItem'],
    },
    serializationStrategy: 'relativeApiName',
    target: {
      parentContext: 'instanceParent',
      type: 'WebLink',
    },
  },
  'CustomFieldTranslation.name': {
    src: {
      field: 'name',
      parentTypes: ['CustomFieldTranslation'],
    },
    serializationStrategy: 'relativeApiName',
    target: {
      parentContext: 'instanceParent',
      type: 'CustomField',
    },
  },
  'FieldSetTranslation.name': {
    src: {
      field: 'name',
      parentTypes: ['FieldSetTranslation'],
    },
    serializationStrategy: 'relativeApiName',
    target: {
      parentContext: 'instanceParent',
      type: 'FieldSet',
    },
  },
  'RecordTypeTranslation.name': {
    src: {
      field: 'name',
      parentTypes: ['RecordTypeTranslation'],
    },
    serializationStrategy: 'relativeApiName',
    target: {
      parentContext: 'instanceParent',
      type: 'RecordType',
    },
  },
  'SharingReasonTranslation.name': {
    src: {
      field: 'name',
      parentTypes: ['SharingReasonTranslation'],
    },
    serializationStrategy: 'relativeApiName',
    target: {
      parentContext: 'instanceParent',
      type: 'SharingReason',
    },
  },
  'WebLinkTranslation.name': {
    src: {
      field: 'name',
      parentTypes: ['WebLinkTranslation'],
    },
    serializationStrategy: 'relativeApiName',
    target: {
      parentContext: 'instanceParent',
      type: 'WebLink',
    },
  },
  'WorkflowTaskTranslation.name': {
    src: {
      field: 'name',
      parentTypes: ['WorkflowTaskTranslation'],
    },
    serializationStrategy: 'relativeApiName',
    target: {
      parentContext: 'instanceParent',
      type: 'WorkflowTask',
    },
  },
  'ValidationRuleTranslation.name': {
    src: {
      field: 'name',
      parentTypes: ['ValidationRuleTranslation'],
    },
    serializationStrategy: 'relativeApiName',
    target: {
      parentContext: 'instanceParent',
      type: 'ValidationRule',
    },
  },
  'QuickActionTranslation.name': {
    src: {
      field: 'name',
      parentTypes: ['QuickActionTranslation'],
    },
    serializationStrategy: 'relativeApiName',
    target: {
      parentContext: 'instanceParent',
      type: 'QuickAction',
    },
  },
  'WorkflowActionReference.name': {
    src: {
      field: 'name',
      parentTypes: ['WorkflowActionReference'],
    },
    serializationStrategy: 'relativeApiName',
    target: {
      parentContext: 'parentSObjectTypeLookupTopLevel',
      typeContext: 'neighborTypeWorkflow',
    },
  },
  'GlobalQuickActionTranslation.name': {
    src: {
      field: 'name',
      parentTypes: ['GlobalQuickActionTranslation'],
    },
    target: {
      type: 'QuickAction',
    },
  },
  'EntitlementProcess.businessHours': {
    src: {
      field: 'businessHours',
      parentTypes: ['EntitlementProcess', 'EntitlementProcessMilestoneItem'],
    },
    target: {
      type: 'BusinessHoursEntry',
    },
    serializationStrategy: 'mapKey',
  },
  'RecordType.businessProcess': {
    src: {
      field: 'businessProcess',
      parentTypes: ['RecordType'],
    },
    serializationStrategy: 'relativeApiName',
    target: {
      parentContext: 'instanceParent',
      type: 'BusinessProcess',
    },
  },
  'CustomSite.Page': {
    src: {
      field: /Page$/,
      parentTypes: ['CustomSite'],
    },
    target: {
      type: 'ApexPage',
    },
  },
  'FlowApexPluginCall.apexClass': {
    src: {
      field: 'apexClass',
      parentTypes: ['FlowApexPluginCall', 'FlowVariable', 'TransactionSecurityPolicy'],
    },
    target: {
      type: 'ApexClass',
    },
  },
  'WorkflowEmailRecipient.recipient': {
    src: {
      field: 'recipient',
      parentTypes: ['WorkflowEmailRecipient'],
    },
    target: {
      type: 'Group',
    },
  },
  'PermissionSetGroup.permissionSets': {
    src: {
      field: 'permissionSets',
      parentTypes: ['PermissionSetGroup', 'DelegateGroup'],
    },
    target: {
      type: 'PermissionSet',
    },
  },
  'CustomApplication.tabs': {
    src: {
      field: 'tabs',
      parentTypes: ['CustomApplication'],
    },
    target: {
      type: 'CustomTab',
    },
  },
  'WorkspaceMapping.tab': {
    src: {
      field: 'tab',
      parentTypes: ['WorkspaceMapping'],
    },
    target: {
      type: 'CustomTab',
    },
  },
  'FlowActionCall.actionName': {
    src: {
      field: 'actionName',
      parentTypes: ['FlowActionCall'],
    },
    target: {
      typeContext: 'neighborActionTypeFlowLookup',
    },
  },
  'PlatformActionListItem.actionName': {
    src: {
      field: 'actionName',
      parentTypes: ['PlatformActionListItem'],
    },
    target: {
      typeContext: 'neighborActionTypeLookup',
    },
  },
  'QuickActionListItem.quickActionName': {
    src: {
      field: 'quickActionName',
      parentTypes: ['QuickActionListItem'],
    },
    target: {
      type: 'QuickAction',
    },
  },
  'AppActionOverride.content': {
    src: {
      field: 'content',
      parentTypes: ['AppActionOverride', 'ActionOverride'],
    },
    target: {
      type: 'LightningPage',
    },
  },
  'AppMenuItem.name': {
    src: {
      field: 'name',
      parentTypes: ['AppMenuItem'],
    },
    target: {
      typeContext: 'neighborTypeLookup',
    },
  },
  'FlowVariable.objectType': {
    src: {
      field: 'objectType',
      parentTypes: ['FlowVariable'],
    },
    target: {
      type: 'CustomObject',
    },
  },
  'FlowDynamicChoiceSet.object': {
    src: {
      field: 'object',
      parentTypes: [
        'FlowDynamicChoiceSet',
        'FlowRecordLookup',
        'FlowRecordUpdate',
        'FlowRecordCreate',
        'FlowRecordDelete',
        'FlowStart',
      ],
    },
    target: {
      type: 'CustomObject',
    },
  },
  'FlowDynamicChoiceSet.picklistObject': {
    src: {
      field: 'picklistObject',
      parentTypes: ['FlowDynamicChoiceSet'],
    },
    target: {
      type: 'CustomObject',
    },
  },
  'QuickAction.targetObject': {
    src: {
      field: 'targetObject',
      parentTypes: ['QuickAction', 'AnalyticSnapshot'],
    },
    target: {
      type: 'CustomObject',
    },
  },
  'ObjectMapping.inputObject': {
    src: {
      field: 'inputObject',
      parentTypes: ['ObjectMapping'],
    },
    target: {
      type: 'CustomObject',
    },
  },
  'ObjectMapping.outputObject': {
    src: {
      field: 'outputObject',
      parentTypes: ['ObjectMapping'],
    },
    target: {
      type: 'CustomObject',
    },
  },
  'DuplicateRuleMatchRule.matchRuleSObjectType': {
    src: {
      field: 'matchRuleSObjectType',
      parentTypes: ['DuplicateRuleMatchRule'],
    },
    target: {
      type: 'CustomObject',
    },
  },
  'FlowDataTypeMapping.typeValue': {
    src: {
      field: 'typeValue',
      parentTypes: ['FlowDataTypeMapping'],
    },
    target: {
      type: 'CustomObject',
    },
  },
  'WorkflowFieldUpdate.targetObject': {
    src: {
      field: 'targetObject',
      parentTypes: ['WorkflowFieldUpdate'],
    },
    target: {
      parentContext: 'instanceParent',
      type: 'CustomField',
    },
  },
  'FieldOverride.field': {
    src: {
      field: 'field',
      parentTypes: ['FieldOverride'],
    },
    serializationStrategy: 'relativeApiName',
    target: {
      parentContext: 'instanceParent',
      type: 'CustomField',
    },
  },
  'AnalyticSnapshot.targetField': {
    src: {
      field: 'targetField',
      parentTypes: ['AnalyticSnapshot'],
    },
    target: {
      type: 'CustomField',
    },
  },
  'ObjectSearchSetting.name': {
    src: {
      field: 'name',
      parentTypes: ['ObjectSearchSetting'],
    },
    target: {
      type: 'CustomObject',
    },
  },
  'DashboardComponent.report': {
    src: {
      field: 'report',
      parentTypes: ['DashboardComponent'],
    },
    target: {
      type: 'Report',
    },
  },
  'Report.reportType': {
    src: {
      field: 'reportType',
      parentTypes: ['Report'],
    },
    target: {
      type: 'CustomObject',
    },
  },
  'EntitlementProcess.entryStartDateField': {
    src: {
      field: 'entryStartDateField',
      parentTypes: ['EntitlementProcess'],
    },
    target: {
      type: 'CustomField',
    },
  },
  'EntitlementProcess.SObjectType': {
    src: {
      field: 'SObjectType',
      parentTypes: ['EntitlementProcess'],
    },
    target: {
      type: 'CustomObject',
    },
  },
  'SBQQ__PriceRule__c.SBQQ__LookupObject__c': {
    src: {
      field: 'SBQQ__LookupObject__c',
      parentTypes: ['SBQQ__PriceRule__c', 'SBQQ__ProductRule__c'],
    },
    target: {
      type: 'CustomObject',
    },
  },
  'SBQQ__LookupQuery__c.SBQQ__RuleLookupObject__c': {
    src: {
      field: 'SBQQ__RuleLookupObject__c',
      parentTypes: ['SBQQ__LookupQuery__c', 'SBQQ__PriceAction__c'],
    },
    target: {
      type: 'CustomObject',
    },
  },
  'SBQQ__ConfigurationAttribute__c.SBQQ__DefaultObject__c': {
    src: {
      field: 'SBQQ__DefaultObject__c',
      parentTypes: ['SBQQ__ConfigurationAttribute__c'],
    },
    serializationStrategy: 'configurationAttributeMapping',
    target: {
      type: 'CustomObject',
    },
  },
  'SBQQ__LookupQuery__c.SBQQ__TestedObject__c': {
    src: {
      field: 'SBQQ__TestedObject__c',
      parentTypes: ['SBQQ__LookupQuery__c'],
    },
    serializationStrategy: 'lookupQueryMapping',
    target: {
      type: 'CustomObject',
    },
  },
  'SBQQ__FieldMetadata__c.SBQQ__ObjectName__c': {
    src: {
      field: 'SBQQ__ObjectName__c',
      parentTypes: ['SBQQ__FieldMetadata__c'],
    },
    target: {
      type: 'CustomObject',
    },
  },
  'RelatedListItem.relatedList': {
    src: {
      field: 'relatedList',
      parentTypes: ['RelatedListItem'],
    },
    target: {
      type: 'CustomField',
    },
  },
  'FolderShare.sharedTo': {
    src: {
      field: 'sharedTo',
      parentTypes: ['FolderShare'],
    },
    target: {
      typeContext: 'neighborSharedToTypeLookup',
    },
  },
  'SharedTo.role': {
    src: {
      field: 'role',
      parentTypes: ['SharedTo'],
    },
    target: {
      type: 'Role',
    },
  },
  'SharedTo.roleAndSubordinates': {
    src: {
      field: 'roleAndSubordinates',
      parentTypes: ['SharedTo'],
    },
    target: {
      type: 'Role',
    },
  },
  'SharedTo.group': {
    src: {
      field: 'group',
      parentTypes: ['SharedTo'],
    },
    target: {
      type: 'Group',
    },
  },
  'RecordType.compactLayoutAssignment': {
    src: {
      field: 'compactLayoutAssignment',
      parentTypes: ['RecordType'],
    },
    serializationStrategy: 'relativeApiName',
    target: {
      parentContext: 'instanceParent',
      type: 'CompactLayout',
    },
  },
  'RuleEntry.template': {
    src: {
      field: 'template',
      parentTypes: ['RuleEntry'],
    },
    target: {
      type: 'EmailTemplate',
    },
  },
  'ReportGrouping.field': {
    src: {
      field: 'field',
      parentTypes: ['ReportGrouping'],
    },
    target: {
      parentContext: 'instanceParent',
      type: 'CustomField',
    },
  },
  'ReportTypeColumn.field': {
    src: {
      field: 'field',
      parentTypes: ['ReportTypeColumn'],
    },
    serializationStrategy: 'relativeApiName',
    target: {
      parentContext: 'neighborTableLookup',
      type: 'CustomField',
    },
  },
  'PublicGroups.publicGroup': {
    src: {
      field: 'publicGroup',
      parentTypes: ['PublicGroups'],
    },
    target: {
      type: 'Group',
    },
  },
  'Roles.role': {
    src: {
      field: 'role',
      parentTypes: ['Roles'],
    },
    target: {
      type: 'Role',
    },
  },
  'WorkflowFieldUpdate.lookupValue': {
    src: {
      field: 'lookupValue',
      parentTypes: ['WorkflowFieldUpdate'],
    },
    target: {
      typeContext: 'neighborLookupValueTypeLookup',
    },
  },
  'FlowDynamicChoiceSet.displayField': {
    src: {
      field: 'displayField',
      parentTypes: ['FlowDynamicChoiceSet'],
    },
    serializationStrategy: 'relativeApiName',
    target: {
      parentContext: 'neighborObjectLookup',
      type: 'CustomField',
    },
  },
  'FlowDynamicChoiceSet.sortField': {
    src: {
      field: 'sortField',
      parentTypes: ['FlowDynamicChoiceSet'],
    },
    serializationStrategy: 'relativeApiName',
    target: {
      parentContext: 'neighborObjectLookup',
      type: 'CustomField',
    },
  },
  'FlowDynamicChoiceSet.valueField': {
    src: {
      field: 'valueField',
      parentTypes: ['FlowDynamicChoiceSet'],
    },
    serializationStrategy: 'relativeApiName',
    target: {
      parentContext: 'neighborObjectLookup',
      type: 'CustomField',
    },
  },
  'FlowRecordLookup.queriedFields': {
    src: {
      field: 'queriedFields',
      parentTypes: ['FlowRecordLookup'],
    },
    serializationStrategy: 'relativeApiName',
    target: {
      parentContext: 'neighborObjectLookup',
      type: 'CustomField',
    },
  },
  'FlowRecordLookup.sortField': {
    src: {
      field: 'sortField',
      parentTypes: ['FlowRecordLookup'],
    },
    serializationStrategy: 'relativeApiName',
    target: {
      parentContext: 'neighborObjectLookup',
      type: 'CustomField',
    },
  },
  'FlowRecordFilter.field': {
    src: {
      field: 'field',
      parentTypes: ['FlowRecordFilter', 'FlowInputFieldAssignment', 'FlowOutputFieldAssignment'],
    },
    serializationStrategy: 'relativeApiName',
    target: {
      parentContext: 'parentObjectLookup',
      type: 'CustomField',
    },
  },
  'ObjectMappingField.inputField': {
    src: {
      field: 'inputField',
      parentTypes: ['ObjectMappingField'],
    },
    serializationStrategy: 'relativeApiName',
    target: {
      parentContext: 'parentInputObjectLookup',
      type: 'CustomField',
    },
  },
  'ObjectMappingField.outputField': {
    src: {
      field: 'outputField',
      parentTypes: ['ObjectMappingField'],
    },
    serializationStrategy: 'relativeApiName',
    target: {
      parentContext: 'parentOutputObjectLookup',
      type: 'CustomField',
    },
  },
  'FlowDynamicChoiceSet.picklistField': {
    src: {
      field: 'picklistField',
      parentTypes: ['FlowDynamicChoiceSet'],
    },
    serializationStrategy: 'relativeApiName',
    target: {
      parentContext: 'neighborPicklistObjectLookup',
      type: 'CustomField',
    },
  },
  'SBQQ__LookupQuery__c.SBQQ__LookupField__c': {
    src: {
      field: 'SBQQ__LookupField__c',
      parentTypes: ['SBQQ__LookupQuery__c'],
    },
    serializationStrategy: 'relativeApiName',
    target: {
      parentContext: 'neighborCPQRuleLookup',
      type: 'CustomField',
    },
  },
  'SBQQ__PriceAction__c.SBQQ__SourceLookupField__c': {
    src: {
      field: 'SBQQ__SourceLookupField__c',
      parentTypes: ['SBQQ__PriceAction__c'],
    },
    serializationStrategy: 'relativeApiName',
    target: {
      parentContext: 'neighborCPQRuleLookup',
      type: 'CustomField',
    },
  },
  'ValidationRule.errorDisplayField': {
    src: {
      field: 'errorDisplayField',
      parentTypes: ['ValidationRule'],
    },
    serializationStrategy: 'relativeApiName',
    target: {
      parentContext: 'instanceParent',
      type: 'CustomField',
    },
  },
  'RecordTypePicklistValue.picklist': {
    src: {
      field: 'picklist',
      parentTypes: ['RecordTypePicklistValue'],
    },
    serializationStrategy: 'relativeApiName',
    target: {
      parentContext: 'instanceParent',
      type: 'CustomField',
    },
  },
  'WebLink.page': {
    src: {
      field: 'page',
      parentTypes: ['WebLink'],
    },
    target: {
      type: 'ApexPage',
    },
  },
  'ComponentInstanceProperty.value': {
    src: {
      field: 'value',
      parentTypes: ['ComponentInstanceProperty'],
    },
    target: {
      type: 'Flow',
    },
  },
  'SBQQ__ProductRule__c.SBQQ__LookupProductField__c': {
    src: {
      field: 'SBQQ__LookupProductField__c',
      parentTypes: ['SBQQ__ProductRule__c', 'SBQQ__PriceRule__c'],
    },
    serializationStrategy: 'relativeApiName',
    target: {
      parentContext: 'neighborCPQLookup',
      type: 'CustomField',
    },
  },
  'SBQQ__ProductRule__c.SBQQ__LookupMessageField__c': {
    src: {
      field: 'SBQQ__LookupMessageField__c',
      parentTypes: ['SBQQ__ProductRule__c', 'SBQQ__PriceRule__c'],
    },
    serializationStrategy: 'relativeApiName',
    target: {
      parentContext: 'neighborCPQLookup',
      type: 'CustomField',
    },
  },
  'SBQQ__ProductRule__c.SBQQ__LookupRequiredField__c': {
    src: {
      field: 'SBQQ__LookupRequiredField__c',
      parentTypes: ['SBQQ__ProductRule__c', 'SBQQ__PriceRule__c'],
    },
    serializationStrategy: 'relativeApiName',
    target: {
      parentContext: 'neighborCPQLookup',
      type: 'CustomField',
    },
  },
  'SBQQ__ProductRule__c.SBQQ__LookupTypeField__c': {
    src: {
      field: 'SBQQ__LookupTypeField__c',
      parentTypes: ['SBQQ__ProductRule__c', 'SBQQ__PriceRule__c'],
    },
    serializationStrategy: 'relativeApiName',
    target: {
      parentContext: 'neighborCPQLookup',
      type: 'CustomField',
    },
  },
  'SBQQ__CustomScript__c.SBQQ__ConsumptionRateFields__c': {
    src: {
      field: 'SBQQ__ConsumptionRateFields__c',
      parentTypes: ['SBQQ__CustomScript__c'],
    },
    serializationStrategy: 'relativeApiName',
    target: {
      parent: 'ConsumptionRate',
      type: 'CustomField',
    },
  },
  'SBQQ__CustomScript__c.SBQQ__ConsumptionScheduleFields__c': {
    src: {
      field: 'SBQQ__ConsumptionScheduleFields__c',
      parentTypes: ['SBQQ__CustomScript__c'],
    },
    serializationStrategy: 'relativeApiName',
    target: {
      parent: 'ConsumptionSchedule',
      type: 'CustomField',
    },
  },
  'SBQQ__CustomScript__c.SBQQ__GroupFields__c': {
    src: {
      field: 'SBQQ__GroupFields__c',
      parentTypes: ['SBQQ__CustomScript__c'],
    },
    serializationStrategy: 'relativeApiName',
    target: {
      parent: 'SBQQ__QuoteLineGroup__c',
      type: 'CustomField',
    },
  },
  'SBQQ__CustomScript__c.SBQQ__QuoteFields__c': {
    src: {
      field: 'SBQQ__QuoteFields__c',
      parentTypes: ['SBQQ__CustomScript__c'],
    },
    serializationStrategy: 'relativeApiName',
    target: {
      parent: 'SBQQ__Quote__c',
      type: 'CustomField',
    },
  },
  'SBQQ__CustomScript__c.SBQQ__QuoteLineFields__c': {
    src: {
      field: 'SBQQ__QuoteLineFields__c',
      parentTypes: ['SBQQ__CustomScript__c'],
    },
    serializationStrategy: 'relativeApiName',
    target: {
      parent: 'SBQQ__QuoteLine__c',
      type: 'CustomField',
    },
  },
  'SBQQ__LineColumn__c.SBQQ__FieldName__c': {
    src: {
      field: 'SBQQ__FieldName__c',
      parentTypes: ['SBQQ__LineColumn__c'],
    },
    serializationStrategy: 'relativeApiName',
    target: {
      parent: 'SBQQ__QuoteLine__c',
      type: 'CustomField',
    },
  },
  'SBQQ__FieldMetadata__c.SBQQ__FieldName__c': {
    src: {
      field: 'SBQQ__FieldName__c',
      parentTypes: ['SBQQ__FieldMetadata__c'],
    },
    serializationStrategy: 'relativeApiName',
    target: {
      parent: 'SBQQ__ObjectName__c',
      type: 'CustomField',
    },
  },
  'SBQQ__PriceSchedule__c.SBQQ__ConstraintField__c': {
    src: {
      field: 'SBQQ__ConstraintField__c',
      parentTypes: ['SBQQ__PriceSchedule__c', 'SBQQ__DiscountSchedule__c'],
    },
    serializationStrategy: 'scheduleConstraintFieldMapping',
    target: {
      parent: 'SBQQ__Quote__c',
      type: 'CustomField',
    },
  },
  'Report.groupingColumn': {
    src: {
      field: 'groupingColumn',
      parentTypes: ['Report'],
    },
    target: {
      type: 'CustomField',
    },
  },
  'Report.secondaryGroupingColumn': {
    src: {
      field: 'secondaryGroupingColumn',
      parentTypes: ['Report'],
    },
    target: {
      type: 'CustomField',
    },
  },
  'ReportFilterItem.column': {
    src: {
      field: 'column',
      parentTypes: ['ReportFilterItem', 'DashboardFilterColumn', 'DashboardTableColumn'],
    },
    target: {
      type: 'CustomField',
    },
  },
  'ListView.queue': {
    src: {
      field: 'queue',
      parentTypes: ['ListView'],
    },
    target: {
      type: 'Queue',
    },
  },
  'EmailToCaseRoutingAddress.caseOwner': {
    src: {
      field: 'caseOwner',
      parentTypes: ['EmailToCaseRoutingAddress'],
    },
    target: {
      typeContext: 'neighborCaseOwnerTypeLookup',
    },
  },
  'RuleEntry.assignedTo': {
    src: {
      field: 'assignedTo',
      parentTypes: ['RuleEntry', 'EscalationAction'],
    },
    target: {
      typeContext: 'neighborAssignedToTypeLookup',
    },
  },
  'EscalationAction.assignedToTemplate': {
    src: {
      field: 'assignedToTemplate',
      parentTypes: ['EscalationAction'],
    },
    target: {
      type: 'EmailTemplate',
    },
  },
  'CaseSettings.caseAssignNotificationTemplate': {
    src: {
      field: 'caseAssignNotificationTemplate',
      parentTypes: ['CaseSettings'],
    },
    target: {
      type: 'EmailTemplate',
    },
  },
  'CaseSettings.caseCloseNotificationTemplate': {
    src: {
      field: 'caseCloseNotificationTemplate',
      parentTypes: ['CaseSettings'],
    },
    target: {
      type: 'EmailTemplate',
    },
  },
  'CaseSettings.caseCommentNotificationTemplate': {
    src: {
      field: 'caseCommentNotificationTemplate',
      parentTypes: ['CaseSettings'],
    },
    target: {
      type: 'EmailTemplate',
    },
  },
  'CaseSettings.caseCreateNotificationTemplate': {
    src: {
      field: 'caseCreateNotificationTemplate',
      parentTypes: ['CaseSettings'],
    },
    target: {
      type: 'EmailTemplate',
    },
  },
  'ServiceChannel.relatedEntityType': {
    src: {
      field: 'relatedEntityType',
      parentTypes: ['ServiceChannel'],
    },
    target: {
      type: 'CustomObject',
    },
  },
  'ServiceChannel.secondaryRoutingPriorityField': {
    src: {
      field: 'secondaryRoutingPriorityField',
      parentTypes: ['ServiceChannel'],
    },
    serializationStrategy: 'relativeApiName',
    target: {
      parentContext: 'neighborRelatedEntityTypeLookup',
      type: 'CustomField',
    },
  },
  'EntitlementTemplate.entitlementProcess': {
    src: {
      field: 'entitlementProcess',
      parentTypes: ['EntitlementTemplate'],
    },
    target: {
      type: 'EntitlementProcess',
    },
    sourceTransformation: 'asCaseInsensitiveString',
  },
  'FlowElementReferenceOrValue.elementReference': {
    src: {
      field: 'elementReference',
      parentTypes: ['FlowElementReferenceOrValue'],
    },
    serializationStrategy: 'customLabel',
    target: {
      type: 'CustomLabel',
    },
  },
  'EntitlementProcessMilestoneItem.milestoneName': {
    src: {
      field: 'milestoneName',
      parentTypes: ['EntitlementProcessMilestoneItem'],
    },
    target: {
      type: 'MilestoneType',
    },
  },
  'DuplicateRuleFilterItem.field': {
    src: {
      field: 'field',
      parentTypes: ['DuplicateRuleFilterItem'],
    },
    serializationStrategy: 'relativeApiName',
    target: {
      parentContext: 'neighborTableLookup',
      type: 'CustomField',
    },
  },
  'DuplicateRuleFilterItem.table': {
    src: {
      field: 'table',
      parentTypes: ['DuplicateRuleFilterItem'],
    },
    serializationStrategy: 'relativeApiName',
    target: {
      type: 'CustomObject',
    },
  },
  'HomePageComponent.links': {
    src: {
      field: 'links',
      parentTypes: ['HomePageComponent'],
    },
    target: {
      type: 'CustomPageWebLink',
    },
  },
  'AnimationRule.recordTypeName': {
    src: {
      field: 'recordTypeName',
      parentTypes: ['AnimationRule'],
    },
    serializationStrategy: 'relativeApiName',
    target: {
      parentContext: 'neighborSobjectLookup',
      type: 'RecordType',
    },
  },
  'AnimationRule.targetField': {
    src: {
      field: 'targetField',
      parentTypes: ['AnimationRule'],
    },
    serializationStrategy: 'relativeApiName',
    target: {
      parentContext: 'neighborSobjectLookup',
      type: 'CustomField',
    },
  },
  'AnimationRule.sobjectType': {
    src: {
      field: 'sobjectType',
      parentTypes: ['AnimationRule'],
    },
    target: {
      type: 'CustomObject',
    },
  },
  'ProfileFieldLevelSecurity.field': {
    src: {
      field: 'field',
      parentTypes: ['ProfileFieldLevelSecurity'],
    },
    target: {
      type: 'CustomField',
    },
  },
  'ProfileObjectPermissions.object': {
    src: {
      field: 'object',
      parentTypes: ['ProfileObjectPermissions'],
    },
    target: {
      type: 'CustomObject',
    },
  },
  'ProfileApexClassAccess.apexClass': {
    src: {
      field: 'apexClass',
      parentTypes: ['ProfileApexClassAccess'],
    },
    target: {
      type: 'ApexClass',
    },
  },
  'ProfileLayoutAssignment.layout': {
    src: {
      field: 'layout',
      parentTypes: ['ProfileLayoutAssignment'],
    },
    target: {
      type: 'Layout',
    },
  },
  'ProfileLayoutAssignment.recordType': {
    src: {
      field: 'recordType',
      parentTypes: ['ProfileLayoutAssignment'],
    },
    target: {
      type: 'RecordType',
    },
  },
  'ProfileFlowAccess.flow': {
    src: {
      field: 'flow',
      parentTypes: ['ProfileFlowAccess'],
    },
    target: {
      type: 'Flow',
    },
  },
  'ProfileRecordTypeVisibility.recordType': {
    src: {
      field: 'recordType',
      parentTypes: ['ProfileRecordTypeVisibility'],
    },
    target: {
      type: 'RecordType',
    },
  },
  'ProfileApplicationVisibility.application': {
    src: {
      field: 'application',
      parentTypes: ['ProfileApplicationVisibility'],
    },
    target: {
      type: 'CustomApplication',
    },
  },
  'ListView.columns': {
    src: {
      field: 'columns',
      parentTypes: ['ListView'],
    },
    serializationStrategy: 'relativeApiName',
    target: {
      type: 'CustomField',
      parentContext: 'instanceParent',
    },
  },
  'PermissionSetFieldPermissions.field': {
    src: {
      field: 'field',
      parentTypes: ['PermissionSetFieldPermissions'],
    },
    target: {
      type: 'CustomField',
    },
  },
  'PermissionSetObjectPermissions.object': {
    src: {
      field: 'object',
      parentTypes: ['PermissionSetObjectPermissions'],
    },
    target: {
      type: 'CustomObject',
    },
  },
  'FilterItem.value': {
    src: {
      field: 'value',
      parentTypes: ['FilterItem'],
    },
    serializationStrategy: 'relativeApiName',
    target: {
      parentContext: 'instanceParent',
      type: 'RecordType',
    },
  },
  'FieldInstance.fieldItem': {
    src: {
      field: 'fieldItem',
      parentTypes: ['FieldInstance'],
    },
    serializationStrategy: 'recordField',
    target: {
      parentContext: 'instanceParent',
      type: 'CustomField',
    },
  },
  'FlowAssignmentItem.assignToReference': {
    src: {
      field: 'assignToReference',
      parentTypes: [
        'FlowAssignmentItem',
        'FlowStageStepOutputParameter',
        'FlowSubflowOutputAssignment',
        'FlowTransformValueAction',
        'FlowScreenFieldOutputParameter',
        'FlowWaitEventOutputParameter',
        'FlowStageStepExitActionOutputParameter',
        'FlowApexPluginCallOutputParameter',
        'FlowActionCallOutputParameter',
        'FlowOutputFieldAssignment',
        'FlowStageStepEntryActionOutputParameter',
      ],
    },
    serializationStrategy: 'recordFieldDollarPrefix',
    target: {
      parentContext: 'instanceParent',
      type: 'CustomField',
    },
  },
  'CustomApplication.logo': {
    src: {
      field: 'logo',
      parentTypes: ['CustomApplication'],
    },
    target: {
      type: 'Document',
    },
  },
  'UiFormulaCriterion.leftValue': {
    src: {
      field: 'leftValue',
      parentTypes: ['UiFormulaCriterion'],
    },
    serializationStrategy: 'flexiPageleftValueField',
    target: {
      parentContext: 'instanceParent',
      type: 'CustomField',
    },
  },
}

const matchName = (name: string, matcher: string | RegExp): boolean =>
  _.isString(matcher) ? matcher === name : matcher.test(name)

const matchApiName = async (elem: Element, types: string[]): Promise<boolean> => types.includes(await apiName(elem))

const matchInstanceType = async (inst: InstanceElement, matchers: (string | RegExp)[]): Promise<boolean> => {
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
    this.serializationStrategy = ReferenceSerializationStrategyLookup[def.serializationStrategy ?? 'absoluteApiName']
    this.sourceTransformation =
      referenceUtils.ReferenceSourceTransformationLookup[def.sourceTransformation ?? 'asString']
    this.target = def.target ? { ...def.target, lookup: this.serializationStrategy.lookup } : undefined
  }

  static create(def: FieldReferenceDefinition): FieldReferenceResolver {
    return new FieldReferenceResolver(def)
  }

  async match(field: Field, element: Element): Promise<boolean> {
    return (
      matchName(field.name, this.src.field) &&
      (await matchApiName(field.parent, this.src.parentTypes)) &&
      (this.src.instanceTypes === undefined ||
        (isInstanceElement(element) && matchInstanceType(element, this.src.instanceTypes)))
    )
  }
}

type AsyncReferenceResolverFinder = (field: Field, element: Element) => Promise<FieldReferenceResolver[]>

/**
 * Generates a function that filters the relevant resolvers for a given field.
 */
export const generateReferenceResolverFinder = (defs: FieldReferenceDefinition[]): AsyncReferenceResolverFinder => {
  const referenceDefinitions = defs.map(def => FieldReferenceResolver.create(def))

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

  return async (field, element) =>
    awu([
      ...(matchersByFieldName[field.name] ?? []),
      ...(regexFieldMatchersByParent[await apiName(field.parent)] || []),
    ])
      .filter(resolver => resolver.match(field, element))
      .toArray()
}

const getLookUpNameImpl = ({
  defs,
  resolveToElementFallback,
  defaultStrategyName,
}: {
  defs: FieldReferenceDefinition[]
  resolveToElementFallback: boolean
  defaultStrategyName: ReferenceSerializationStrategyName
}): GetLookupNameFunc => {
  const resolverFinder = generateReferenceResolverFinder(defs)

  const determineLookupStrategy = async (
    args: GetLookupNameFuncArgs,
  ): Promise<ReferenceSerializationStrategy | undefined> => {
    if (args.field === undefined) {
      log.debug('could not determine field for path %s', args.path?.getFullName())
      return undefined
    }
    const strategies = (await resolverFinder(args.field, args.element)).map(def => def.serializationStrategy)

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
      const strategy = await determineLookupStrategy({
        ref,
        path,
        field,
        element,
      })
      if (strategy !== undefined) {
        return strategy.serialize({ ref, field, element })
      }
      if (isElement(ref.value)) {
        const defaultStrategy = ReferenceSerializationStrategyLookup[defaultStrategyName]
        const resolvedValue = await defaultStrategy.serialize({ ref, element })
        if (resolvedValue !== undefined) {
          return resolvedValue
        }
        if (resolveToElementFallback) {
          // We want to return the referenced Element in that case, which will be handled later in the deployment flow.
          // This is relevant for ADD_CUSTOM_APPROVAL_RULE_AND_CONDITION_GROUP deploy group
          // and also for the case of Data Records that reference the same type (and are deployed in the same group)
          return ref.value
        }
        log.warn(
          'could not resolve reference to %s in path %s, resolving to undefined',
          ref.elemID.getFullName(),
          path?.getFullName(),
        )
        return undefined
      }
    }
    return ref.value
  }
}

export const getDefsFromFetchProfile = (fetchProfile: FetchProfile): FieldReferenceDefinition[] => {
  const { disabledReferences } = fetchProfile
  if (!fetchProfile.disabledReferences) {
    return Object.values(referenceMappingDefs)
  }
  const [validDisables, invalidDisables] = _.partition(
    disabledReferences,
    disabledReference => referenceMappingDefs[disabledReference] !== undefined,
  )
  if (invalidDisables.length > 0) {
    log.warn('the following disabled references are not supported: %s', invalidDisables)
  }
  if (validDisables.length > 0) {
    log.debug('the following references will be disabled: %s', inspectValue(validDisables))
    return Object.values(_.omit(referenceMappingDefs, validDisables))
  }
  return Object.values(referenceMappingDefs)
}

/**
 * Translate a reference expression back to its original value before deploy.
 */
const isFieldWithOrderedMapAnnotation = (field: Field): boolean =>
  Object.values(field.getTypeSync().annotationRefTypes).some(isOrderedMapTypeOrRefType)

const isElementWithOrderedMap = (element: Element): boolean => {
  if (isField(element)) {
    return isFieldWithOrderedMapAnnotation(element)
  }
  if (isInstanceElement(element)) {
    return Object.values(element.getTypeSync().fields).some(field => isOrderedMapTypeOrRefType(field.getTypeSync()))
  }
  if (isObjectType(element)) {
    return Object.values(element.fields).some(isFieldWithOrderedMapAnnotation)
  }
  return false
}

export const salesforceAdapterResolveValues: ResolveValuesFunc = async (
  element,
  getLookUpNameFunc,
  elementsSource,
  allowEmpty = true,
) => {
  const resolvedElement = await resolveValues(element, getLookUpNameFunc, elementsSource, allowEmpty)
  // Since OrderedMaps' order values reference values that may contain references, we should resolve the Element twice
  // in order to fully resolve it. An example use-case for this is the Field `SBQQ__ProductRule__c.SBQQ__LookupObject__c`
  // Where the `fullName` of the Picklist values is a Reference to a Custom Object.
  return isElementWithOrderedMap(resolvedElement)
    ? resolveValues(resolvedElement, getLookUpNameFunc, elementsSource, allowEmpty)
    : resolvedElement
}

export const resolveSalesforceChanges = (
  changes: readonly Change[],
  getLookupNameFunc: GetLookupNameFunc,
): Promise<Change[]> =>
  Promise.all(changes.map(change => resolveChangeElement(change, getLookupNameFunc, salesforceAdapterResolveValues)))

export const getLookUpName = (fetchProfile: FetchProfile): GetLookupNameFunc =>
  getLookUpNameImpl({
    defs: getDefsFromFetchProfile(fetchProfile),
    resolveToElementFallback: false,
    defaultStrategyName: 'absoluteApiName',
  })

export const getLookupNameForDataInstances = (fetchProfile: FetchProfile): GetLookupNameFunc =>
  getLookUpNameImpl({
    defs: getDefsFromFetchProfile(fetchProfile),
    resolveToElementFallback: true,
    defaultStrategyName: 'fromDataInstance',
  })
