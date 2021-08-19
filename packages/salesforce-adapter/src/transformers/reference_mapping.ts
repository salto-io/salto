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
import { Field, isElement, Value, Element } from '@salto-io/adapter-api'
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
  CPQ_CONFIGURATION_ATTRIBUTE, CPQ_DEFAULT_OBJECT_FIELD, CPQ_QUOTE, CPQ_CONSTRAINT_FIELD,
} from '../constants'

const log = logger(module)
const { awu } = collections.asynciterable
type LookupFunc = (val: Value, context?: string) => string

export type ReferenceSerializationStrategy = {
  serialize: GetLookupNameFunc
  lookup: LookupFunc
}

type ReferenceSerializationStrategyName = 'absoluteApiName' | 'relativeApiName' | 'configurationAttributeMapping' | 'lookupQueryMapping' | 'scheduleConstraintFieldMapping'
 | 'mapKey'
const ReferenceSerializationStrategyLookup: Record<
  ReferenceSerializationStrategyName, ReferenceSerializationStrategy
> = {
  absoluteApiName: {
    serialize: ({ ref }) => apiName(ref.value),
    lookup: val => val,
  },
  relativeApiName: {
    serialize: ({ ref }) => apiName(ref.value, true),
    lookup: (val, context) => (context !== undefined
      ? [context, val].join(API_NAME_SEPARATOR)
      : val
    ),
  },
  configurationAttributeMapping: {
    serialize: async ({ ref }) => (_.invert(DEFAULT_OBJECT_TO_API_MAPPING)[await apiName(ref.value)]
      ?? apiName(ref.value)),
    lookup: val => (_.isString(val) ? (DEFAULT_OBJECT_TO_API_MAPPING[val] ?? val) : val),
  },
  lookupQueryMapping: {
    serialize: async ({ ref }) => (_.invert(TEST_OBJECT_TO_API_MAPPING)[await apiName(ref.value)]
      ?? apiName(ref.value)),
    lookup: val => (_.isString(val) ? (TEST_OBJECT_TO_API_MAPPING[val] ?? val) : val),
  },
  scheduleConstraintFieldMapping: {
    serialize: async ({ ref }) => {
      const relativeApiName = await apiName(ref.value, true)
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
}

export type ReferenceContextStrategyName = (
  'none' | 'instanceParent' | 'neighborTypeWorkflow' | 'neighborCPQLookup' | 'neighborCPQRuleLookup'
  | 'neighborLookupValueTypeLookup' | 'neighborObjectLookup' | 'neighborPicklistObjectLookup'
  | 'neighborTypeLookup' | 'neighborActionTypeFlowLookup' | 'neighborActionTypeLookup' | 'parentObjectLookup'
  | 'parentInputObjectLookup' | 'parentOutputObjectLookup'
)

type PickOne<T, K extends keyof T> = Pick<T, K> & { [P in keyof Omit<T, K>]?: never };
type MetadataTypeArgs = {
  type: string
  typeContext: ReferenceContextStrategyName
}
type MetadataParentArgs = {
  parent?: string
  parentContext?: ReferenceContextStrategyName
}
type ReferenceTargetDefinition = {
  name?: string
} & (PickOne<MetadataTypeArgs, 'type'> | PickOne<MetadataTypeArgs, 'typeContext'>)
  & (PickOne<MetadataParentArgs, 'parent'> | PickOne<MetadataParentArgs, 'parentContext'>)
export type ExtendedReferenceTargetDefinition = ReferenceTargetDefinition & { lookup: LookupFunc }

type SourceDef = {
  field: string | RegExp
  parentTypes: string[]
}

/**
 * A rule defining how to convert values to reference expressions (on fetch),
 * and reference expressions back to values (on deploy).
 */
export type FieldReferenceDefinition = {
  src: SourceDef
  serializationStrategy?: ReferenceSerializationStrategyName
  // If target is missing, the definition is used for resolving
  target?: ReferenceTargetDefinition
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
export const fieldNameToTypeMappingDefs: FieldReferenceDefinition[] = [
  {
    src: { field: 'field', parentTypes: [WORKFLOW_FIELD_UPDATE_METADATA_TYPE, LAYOUT_ITEM_METADATA_TYPE, SUMMARY_LAYOUT_ITEM_METADATA_TYPE, 'WorkflowEmailRecipient', 'QuickActionLayoutItem', 'FieldSetItem'] },
    serializationStrategy: 'relativeApiName',
    target: { parentContext: 'instanceParent', type: CUSTOM_FIELD },
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
  {
    src: { field: 'field', parentTypes: ['ProfileFieldLevelSecurity', 'FilterItem', 'PermissionSetFieldPermissions'] },
    target: { type: CUSTOM_FIELD },
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
    src: { field: 'apexClass', parentTypes: ['FlowApexPluginCall', 'FlowVariable', 'ProfileApexClassAccess', 'TransactionSecurityPolicy', 'ProfileApexClassAccess'] },
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
    src: { field: 'field', parentTypes: ['FlowRecordFilter', 'FlowInputFieldAssignment'] },
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
]

const matchName = (fieldName: string, matcher: string | RegExp): boolean => (
  _.isString(matcher)
    ? matcher === fieldName
    : matcher.test(fieldName)
)

const matchApiName = async (elem: Element, types: string[]): Promise<boolean> => (
  types.includes(await apiName(elem))
)

export class FieldReferenceResolver {
  src: SourceDef
  serializationStrategy: ReferenceSerializationStrategy
  target?: ExtendedReferenceTargetDefinition

  constructor(def: FieldReferenceDefinition) {
    this.src = def.src
    this.serializationStrategy = ReferenceSerializationStrategyLookup[
      def.serializationStrategy ?? 'absoluteApiName'
    ]
    this.target = def.target
      ? { ...def.target, lookup: this.serializationStrategy.lookup }
      : undefined
  }

  static create(def: FieldReferenceDefinition): FieldReferenceResolver {
    return new FieldReferenceResolver(def)
  }

  async match(field: Field): Promise<boolean> {
    return (
      matchName(field.name, this.src.field)
      && matchApiName(field.parent, this.src.parentTypes)
    )
  }
}

export type ReferenceResolverFinder = (field: Field) => Promise<FieldReferenceResolver[]>

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

  return (async field => awu([
    ...(matchersByFieldName[field.name] ?? []),
    ...(regexFieldMatchersByParent[await apiName(field.parent)] || []),
  ]).filter(resolver => resolver.match(field)).toArray())
}

const getLookUpNameImpl = (defs = fieldNameToTypeMappingDefs): GetLookupNameFunc => {
  const resolverFinder = generateReferenceResolverFinder(defs)

  const determineLookupStrategy = async (args: GetLookupNameFuncArgs):
    Promise<ReferenceSerializationStrategy | undefined> => {
    if (args.field === undefined) {
      log.debug('could not determine field for path %s', args.path?.getFullName())
      return undefined
    }
    const strategies = (await resolverFinder(args.field))
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

  return async ({ ref, path, field }) => {
    // We skip resolving instance annotations because they are not deployed to the service
    // and we need the full element context in those
    const isInstanceAnnotation = path?.idType === 'instance' && path.isAttrID()

    if (!isInstanceAnnotation) {
      const strategy = await determineLookupStrategy({ ref, path, field })
      if (strategy !== undefined) {
        return strategy.serialize({ ref, field })
      }
      if (isElement(ref.value)) {
        const defaultStrategy = ReferenceSerializationStrategyLookup.absoluteApiName
        return defaultStrategy.serialize({ ref })
      }
    }
    return ref.value
  }
}

/**
 * Translate a reference expression back to its original value before deploy.
 */
export const getLookUpName = getLookUpNameImpl()
