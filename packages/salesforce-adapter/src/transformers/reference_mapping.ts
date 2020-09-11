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
import { Field, Element, isElement, Value } from '@salto-io/adapter-api'
import { GetLookupNameFunc, GetLookupNameFuncArgs } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { apiName, metadataType } from './transformer'
import {
  LAYOUT_ITEM_METADATA_TYPE, WORKFLOW_FIELD_UPDATE_METADATA_TYPE, CUSTOM_OBJECT, API_NAME_SEPARATOR,
  WORKFLOW_ACTION_REFERENCE_METADATA_TYPE, CPQ_LOOKUP_FIELD, CPQ_LOOKUP_QUERY, CPQ_PRICE_RULE,
  CPQ_SOURCE_LOOKUP_FIELD, CPQ_PRICE_ACTION, CPQ_LOOKUP_PRODUCT_FIELD, CPQ_PRODUCT_RULE,
  CPQ_LOOKUP_MESSAGE_FIELD, CPQ_LOOKUP_REQUIRED_FIELD, CPQ_LOOKUP_TYPE_FIELD, CUSTOM_FIELD,
  CPQ_LOOKUP_OBJECT_NAME, CPQ_RULE_LOOKUP_OBJECT_FIELD, CPQ_OBJECT_NAME, CPQ_FIELD_METADATA,
  CUSTOM_FIELD_TRANSLATION_METADATA_TYPE,
  VALIDATION_RULES_METADATA_TYPE, RECORD_TYPE_METADATA_TYPE, BUSINESS_PROCESS_METADATA_TYPE,
  VALIDATION_RULE_TRANSLATION_METADATA_TYPE,
  WEBLINK_METADATA_TYPE,
} from '../constants'

const log = logger(module)

type LookupFunc = (val: Value, context?: string) => string

export type ReferenceSerializationStrategy = {
  serialize: GetLookupNameFunc
  lookup: LookupFunc
}

type ReferenceSerializationStrategyName = 'absoluteApiName' | 'relativeApiName'
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
}

export type ReferenceContextStrategyName = 'none' | 'instanceParent'

type ReferenceTargetDefinition = {
  parentContext?: ReferenceContextStrategyName
  type: string
  name?: string
}
export type ExtendedReferenceTargetDefinition = ReferenceTargetDefinition & { lookup: LookupFunc }

type SourceDef = {
  field: string | RegExp
  parentType: string
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
const fieldNameToTypeMappingDefs: FieldReferenceDefinition[] = [
  {
    src: { field: 'field', parentType: WORKFLOW_FIELD_UPDATE_METADATA_TYPE },
    serializationStrategy: 'relativeApiName',
    target: { parentContext: 'instanceParent', type: CUSTOM_FIELD },
  },
  {
    src: { field: 'field', parentType: LAYOUT_ITEM_METADATA_TYPE },
    serializationStrategy: 'relativeApiName',
    target: { parentContext: 'instanceParent', type: CUSTOM_FIELD },
  },
  {
    src: { field: 'customLink', parentType: LAYOUT_ITEM_METADATA_TYPE },
    serializationStrategy: 'relativeApiName',
    target: { parentContext: 'instanceParent', type: WEBLINK_METADATA_TYPE },
  },
  {
    src: { field: 'name', parentType: CUSTOM_FIELD_TRANSLATION_METADATA_TYPE },
    serializationStrategy: 'relativeApiName',
    target: { parentContext: 'instanceParent', type: CUSTOM_FIELD },
  },
  {
    src: { field: 'name', parentType: VALIDATION_RULE_TRANSLATION_METADATA_TYPE },
    serializationStrategy: 'relativeApiName',
    target: { parentContext: 'instanceParent', type: VALIDATION_RULES_METADATA_TYPE },
  },
  {
    src: { field: 'businessProcess', parentType: RECORD_TYPE_METADATA_TYPE },
    serializationStrategy: 'relativeApiName',
    target: { parentContext: 'instanceParent', type: BUSINESS_PROCESS_METADATA_TYPE },
  },
  {
    // includes authorizationRequiredPage, bandwidthExceededPage, fileNotFoundPage, ...
    src: { field: /Page$/, parentType: 'CustomSite' },
    target: { type: 'ApexPage' },
  },
  {
    src: { field: 'recipient', parentType: 'WorkflowEmailRecipient' },
    target: { type: 'Role' },
  },
  {
    src: { field: 'actionName', parentType: 'FlowActionCall' },
    target: { type: 'WorkflowAlert' },
  },
  {
    src: { field: 'application', parentType: 'ProfileApplicationVisibility' },
    target: { type: 'CustomApplication' },
  },
  {
    src: { field: 'layout', parentType: 'ProfileLayoutAssignment' },
    target: { type: 'Layout' },
  },
  {
    src: { field: 'recordType', parentType: 'ProfileLayoutAssignment' },
    target: { type: 'RecordType' },
  },
  {
    src: { field: 'flow', parentType: 'ProfileFlowAccess' },
    target: { type: 'Flow' },
  },
  {
    src: { field: 'recordType', parentType: 'ProfileRecordTypeVisibility' },
    target: { type: 'RecordType' },
  },
  {
    src: { field: 'tabs', parentType: 'CustomApplication' },
    target: { type: 'CustomTab' },
  },
  {
    src: { field: 'tab', parentType: 'WorkspaceMapping' },
    target: { type: 'CustomTab' },
  },
  {
    src: { field: 'objectType', parentType: 'FlowVariable' },
    target: { type: CUSTOM_OBJECT },
  },
  {
    src: { field: 'object', parentType: 'ProfileObjectPermissions' },
    target: { type: CUSTOM_OBJECT },
  },
  {
    src: { field: 'name', parentType: 'ObjectSearchSetting' },
    target: { type: CUSTOM_OBJECT },
  },
  {
    src: { field: 'field', parentType: 'ProfileFieldLevelSecurity' },
    target: { type: CUSTOM_FIELD },
  },
  {
    src: { field: 'field', parentType: 'FilterItem' },
    target: { type: CUSTOM_FIELD },
  },
  {
    src: { field: 'report', parentType: 'DashboardComponent' },
    target: { type: 'Report' },
  },
  {
    src: { field: 'reportType', parentType: 'Report' },
    target: { type: CUSTOM_OBJECT },
  },
  {
    src: { field: CPQ_LOOKUP_OBJECT_NAME, parentType: CPQ_PRICE_RULE },
    target: { type: CUSTOM_OBJECT },
  },
  {
    src: { field: CPQ_LOOKUP_OBJECT_NAME, parentType: CPQ_PRODUCT_RULE },
    target: { type: CUSTOM_OBJECT },
  },
  {
    src: { field: CPQ_RULE_LOOKUP_OBJECT_FIELD, parentType: CPQ_LOOKUP_QUERY },
    target: { type: CUSTOM_OBJECT },
  },
  {
    src: { field: CPQ_RULE_LOOKUP_OBJECT_FIELD, parentType: CPQ_PRICE_ACTION },
    target: { type: CUSTOM_OBJECT },
  },
  {
    src: { field: CPQ_OBJECT_NAME, parentType: CPQ_FIELD_METADATA },
    target: { type: CUSTOM_OBJECT },
  },

  // serialization-only
  {
    src: { field: 'name', parentType: WORKFLOW_ACTION_REFERENCE_METADATA_TYPE },
    serializationStrategy: 'relativeApiName',
  },
  {
    src: { field: CPQ_LOOKUP_FIELD, parentType: CPQ_LOOKUP_QUERY },
    serializationStrategy: 'relativeApiName',
  },
  {
    src: { field: CPQ_SOURCE_LOOKUP_FIELD, parentType: CPQ_PRICE_ACTION },
    serializationStrategy: 'relativeApiName',
  },
  {
    src: { field: CPQ_LOOKUP_PRODUCT_FIELD, parentType: CPQ_PRODUCT_RULE },
    serializationStrategy: 'relativeApiName',
  },
  {
    src: { field: CPQ_LOOKUP_MESSAGE_FIELD, parentType: CPQ_PRODUCT_RULE },
    serializationStrategy: 'relativeApiName',
  },
  {
    src: { field: CPQ_LOOKUP_REQUIRED_FIELD, parentType: CPQ_PRODUCT_RULE },
    serializationStrategy: 'relativeApiName',
  },
  {
    src: { field: CPQ_LOOKUP_TYPE_FIELD, parentType: CPQ_PRODUCT_RULE },
    serializationStrategy: 'relativeApiName',
  },
  {
    src: { field: CPQ_LOOKUP_PRODUCT_FIELD, parentType: CPQ_PRICE_RULE },
    serializationStrategy: 'relativeApiName',
  },
  {
    src: { field: CPQ_LOOKUP_MESSAGE_FIELD, parentType: CPQ_PRICE_RULE },
    serializationStrategy: 'relativeApiName',
  },
  {
    src: { field: CPQ_LOOKUP_REQUIRED_FIELD, parentType: CPQ_PRICE_RULE },
    serializationStrategy: 'relativeApiName',
  },
  {
    src: { field: CPQ_LOOKUP_TYPE_FIELD, parentType: CPQ_PRICE_RULE },
    serializationStrategy: 'relativeApiName',
  },
]

const matchName = (fieldName: string, matcher: string | RegExp): boolean => (
  _.isString(matcher)
    ? matcher === fieldName
    : matcher.test(fieldName)
)

const matchMetadataType = (elem: Element, type: string | undefined): boolean => (
  type === undefined ? true : (metadataType(elem) === type)
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

  match(field: Field): boolean {
    return (
      matchName(field.name, this.src.field)
      && matchMetadataType(field.parent, this.src.parentType)
    )
  }
}

export type ReferenceResolverFinder = (field: Field) => FieldReferenceResolver[]

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
    .filter(def => _.isRegExp(def.src.field) && _.isString(def.src.parentType))
    .groupBy(def => def.src.parentType)
    .value()

  return (field => (
    [
      ...(matchersByFieldName[field.name] ?? []),
      ...(regexFieldMatchersByParent[metadataType(field.parent)] || []),
    ].filter(resolver => resolver.match(field))
  ))
}

const getLookUpNameImpl = (defs = fieldNameToTypeMappingDefs): GetLookupNameFunc => {
  const resolverFinder = generateReferenceResolverFinder(defs)

  const determineLookupStrategy = (args: GetLookupNameFuncArgs): ReferenceSerializationStrategy => {
    if (args.field === undefined) {
      log.debug('could not determine field for path %s', args.path?.getFullName())
      return ReferenceSerializationStrategyLookup.absoluteApiName
    }
    const strategies = resolverFinder(args.field)
      .map(def => def.serializationStrategy)

    if (strategies.length > 1) {
      log.debug(
        'found %d matching strategies for field %s - using the first one',
        strategies.length,
        args.field.elemID.getFullName(),
      )
    }
    if (strategies.length === 0) {
      log.debug('could not find matching strategy for field %s', args.field.elemID.getFullName())
    }
    return strategies[0] ?? ReferenceSerializationStrategyLookup.absoluteApiName
  }

  return ({ ref, path, field }) => {
    if (isElement(ref.value)) {
      const lookupFunc = determineLookupStrategy({ ref, path, field }).serialize
      return lookupFunc({ ref })
    }
    return ref.value
  }
}

/**
 * Translate a reference expression back to its original value before deploy.
 */
export const getLookUpName = getLookUpNameImpl()
