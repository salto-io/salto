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
} from '../constants'

const log = logger(module)

type LookupFunc = (val: Value, ...context: string[]) => string

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
    lookup: (val, ...context) => [...context, val].join(API_NAME_SEPARATOR),
  },
}

export type ReferenceContextStrategyName = 'included' | 'instanceParent' | 'specific'
type ReferenceTargetDefinition = {
  strategy: ReferenceContextStrategyName
  metadataType: string
  name?: string
}
export type ExtendedReferenceTargetDefinition = ReferenceTargetDefinition & { lookup: LookupFunc }

type ExactSourceDef = {
  field: string
  parentType?: string
}
type RegExSourceDef = {
  field: RegExp
  parentType: string
}

/**
 * A rule defining how to convert values to reference expressions (on fetch),
 * and reference expressions back to values (on deploy).
 */
export type FieldReferenceDefinition = {
  src: ExactSourceDef | RegExSourceDef
  serializationStrategy?: ReferenceSerializationStrategyName
  // If target is missing, the definition is used for resolving
  target?: ReferenceTargetDefinition
}

/**
 * The rules for finding and resolving values into (and back from) reference expressions.
 * Overlaps between rules are allowed, but priority between them is not guaranteed.
 *
 * A value value will be converted into a reference expression if:
 * 1. An element matching the rule is found.
 * 2. Resolving the resulting reference expression back returns the original value.
 */
const fieldNameToTypeMappingDefs: FieldReferenceDefinition[] = [
  {
    src: { field: 'field', parentType: WORKFLOW_FIELD_UPDATE_METADATA_TYPE },
    serializationStrategy: 'relativeApiName',
    target: { strategy: 'instanceParent', metadataType: CUSTOM_FIELD },
  },
  {
    src: { field: 'field', parentType: LAYOUT_ITEM_METADATA_TYPE },
    serializationStrategy: 'relativeApiName',
    target: { strategy: 'instanceParent', metadataType: CUSTOM_FIELD },
  },
  {
    // includes authorizationRequiredPage, bandwidthExceededPage, fileNotFoundPage, ...
    src: { field: /Page$/, parentType: 'CustomSite' },
    target: { strategy: 'included', metadataType: 'ApexPage' },
  },
  {
    src: { field: 'recipient', parentType: 'WorkflowEmailRecipient' },
    target: { strategy: 'included', metadataType: 'Role' },
  },
  {
    src: { field: 'actionName', parentType: 'FlowActionCall' },
    target: { strategy: 'included', metadataType: 'WorkflowAlert' },
  },
  {
    src: { field: 'application', parentType: 'ProfileApplicationVisibility' },
    target: { strategy: 'included', metadataType: 'CustomApplication' },
  },
  {
    src: { field: 'layout', parentType: 'ProfileLayoutAssignment' },
    target: { strategy: 'included', metadataType: 'Layout' },
  },
  {
    src: { field: 'flow', parentType: 'ProfileFlowAccess' },
    target: { strategy: 'included', metadataType: 'Flow' },
  },
  {
    src: { field: 'recordType', parentType: 'ProfileRecordTypeVisibility' },
    target: { strategy: 'included', metadataType: 'RecordType' },
  },
  {
    src: { field: 'tabs', parentType: 'CustomApplication' },
    target: { strategy: 'included', metadataType: 'CustomTab' },
  },
  {
    src: { field: 'tab', parentType: 'WorkspaceMapping' },
    target: { strategy: 'included', metadataType: 'CustomTab' },
  },
  {
    src: { field: 'objectType', parentType: 'FlowVariable' },
    target: { strategy: 'included', metadataType: CUSTOM_OBJECT },
  },
  {
    src: { field: 'object', parentType: 'ProfileObjectPermissions' },
    target: { strategy: 'included', metadataType: CUSTOM_OBJECT },
  },
  {
    src: { field: 'name', parentType: 'ObjectSearchSetting' },
    target: { strategy: 'included', metadataType: CUSTOM_OBJECT },
  },
  {
    src: { field: 'field', parentType: 'ProfileFieldLevelSecurity' },
    target: { strategy: 'included', metadataType: CUSTOM_FIELD },
  },
  {
    src: { field: 'field', parentType: 'FilterItem' },
    target: { strategy: 'included', metadataType: CUSTOM_FIELD },
  },
  {
    src: { field: 'report', parentType: 'DashboardComponent' },
    target: { strategy: 'included', metadataType: 'Report' },
  },
  {
    src: { field: 'reportType', parentType: 'Report' },
    target: { strategy: 'included', metadataType: CUSTOM_OBJECT },
  },
  {
    src: { field: CPQ_LOOKUP_OBJECT_NAME, parentType: CPQ_PRICE_RULE },
    target: { strategy: 'included', metadataType: CUSTOM_OBJECT },
  },
  {
    src: { field: CPQ_LOOKUP_OBJECT_NAME, parentType: CPQ_PRODUCT_RULE },
    target: { strategy: 'included', metadataType: CUSTOM_OBJECT },
  },
  {
    src: { field: CPQ_RULE_LOOKUP_OBJECT_FIELD, parentType: CPQ_LOOKUP_QUERY },
    target: { strategy: 'included', metadataType: CUSTOM_OBJECT },
  },
  {
    src: { field: CPQ_RULE_LOOKUP_OBJECT_FIELD, parentType: CPQ_PRICE_ACTION },
    target: { strategy: 'included', metadataType: CUSTOM_OBJECT },
  },
  {
    src: { field: CPQ_OBJECT_NAME, parentType: CPQ_FIELD_METADATA },
    target: { strategy: 'included', metadataType: CUSTOM_OBJECT },
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
  // need typeName for backward compatibility - TODO remove after verifying
  type === undefined ? true : (metadataType(elem) === type || elem.elemID.typeName === type)
)

export class FieldReferenceResolver {
  src: ExactSourceDef | RegExSourceDef
  serializationStrategy: ReferenceSerializationStrategy
  target: ExtendedReferenceTargetDefinition | undefined

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

  field(): string | RegExp {
    return this.src.field
  }
}

export type ReferenceResolverFinder = (field: Field) => FieldReferenceResolver[]

/**
 * Generate a functioning filtering for relevant reference resolvers for a given field.
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
      ...(matchersByFieldName[field.name] || []),
      ...(regexFieldMatchersByParent[metadataType(field.parent)] || []),
    ].filter(resolver => resolver.match(field))
  ))
}

const getLookUpNameImpl = (defs = fieldNameToTypeMappingDefs): GetLookupNameFunc => {
  const resolverFinder = generateReferenceResolverFinder(defs)

  const determineLookupStrategy = (args: GetLookupNameFuncArgs): ReferenceSerializationStrategy => {
    if (args.field === undefined) {
      log.debug(`could not determine field for path ${args.path?.getFullName()}`)
      return ReferenceSerializationStrategyLookup.absoluteApiName
    }
    const strategies = resolverFinder(args.field)
      .map(def => def.serializationStrategy)

    if (strategies.length > 1) {
      log.debug(`found ${strategies.length} matching strategies for field ${args.field.elemID.getFullName()} - using the first one`)
    }
    if (strategies.length === 0) {
      log.debug(`could not find matching strategy for field ${args.field.elemID.getFullName()}`)
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
