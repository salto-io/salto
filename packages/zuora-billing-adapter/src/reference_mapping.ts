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

const log = logger(module)

type LookupFunc = (val: Value, context?: string) => string

export type ReferenceSerializationStrategy = {
  serialize: GetLookupNameFunc
  lookup: LookupFunc
}

type ReferenceSerializationStrategyName = 'fullValue' | 'id'
const ReferenceSerializationStrategyLookup: Record<
  ReferenceSerializationStrategyName, ReferenceSerializationStrategy
> = {
  fullValue: {
    serialize: ({ ref }) => ref.value,
    lookup: val => val,
  },
  id: {
    serialize: ({ ref }) => ref.value.value.id,
    lookup: val => val,
  },
}

export type ReferenceContextStrategyName = (
  'none'
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
    src: { field: 'source_workflow_id', parentTypes: ['Linkage'] },
    serializationStrategy: 'id',
    target: { type: 'Workflow' },
  },
  {
    src: { field: 'target_task_id', parentTypes: ['Linkage'] },
    serializationStrategy: 'id',
    target: { type: 'Task' },
  },
  {
    src: { field: 'source_task_id', parentTypes: ['Linkage'] },
    serializationStrategy: 'id',
    target: { type: 'Task' },
  },
]

const matchName = (fieldName: string, matcher: string | RegExp): boolean => (
  _.isString(matcher)
    ? matcher === fieldName
    : matcher.test(fieldName)
)

const matchType = (elem: Element, types: string[]): boolean => (
  // TODO change when using structured types (right now most are unknown)
  types.includes(elem.elemID.name)
)

export class FieldReferenceResolver {
  src: SourceDef
  serializationStrategy: ReferenceSerializationStrategy
  target?: ExtendedReferenceTargetDefinition

  constructor(def: FieldReferenceDefinition) {
    this.src = def.src
    this.serializationStrategy = ReferenceSerializationStrategyLookup[
      def.serializationStrategy ?? 'fullValue'
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
      && matchType(field.parent, this.src.parentTypes)
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
    .filter(def => _.isRegExp(def.src.field))
    .flatMap(def => def.src.parentTypes.map(parentType => ({ parentType, def })))
    .groupBy(({ parentType }) => parentType)
    .mapValues(items => items.map(item => item.def))
    .value()

  return (field => (
    [
      ...(matchersByFieldName[field.name] ?? []),
      ...(regexFieldMatchersByParent[field.parent.elemID.name] || []),
    ].filter(resolver => resolver.match(field))
  ))
}

const getLookUpNameImpl = (defs = fieldNameToTypeMappingDefs): GetLookupNameFunc => {
  const resolverFinder = generateReferenceResolverFinder(defs)

  const determineLookupStrategy = (args: GetLookupNameFuncArgs):
    ReferenceSerializationStrategy | undefined => {
    if (args.field === undefined) {
      log.debug('could not determine field for path %s', args.path?.getFullName())
      return undefined
    }
    const strategies = resolverFinder(args.field)
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

  return ({ ref, path, field }) => {
    // We skip resolving instance annotations because they are not deployed to the service
    // and we need the full element context in those
    const isInstanceAnnotation = path?.idType === 'instance' && path.isAttrID()

    if (!isInstanceAnnotation) {
      const strategy = determineLookupStrategy({ ref, path, field })
      if (strategy !== undefined) {
        return strategy.serialize({ ref, field })
      }
      if (isElement(ref.value)) {
        const defaultStrategy = ReferenceSerializationStrategyLookup.fullValue
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
