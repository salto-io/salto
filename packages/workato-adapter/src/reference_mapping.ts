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
import { Field, Value, Element } from '@salto-io/adapter-api'
import { GetLookupNameFunc, elements as elementUtils } from '@salto-io/adapter-utils'

const { toNestedTypeName } = elementUtils.ducktype

export type ApiNameFunc = (elem: Element) => string
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
    src: { field: 'api_client_id', parentTypes: ['api_access_profile'] },
    serializationStrategy: 'id',
    target: { type: 'api_client' },
  },
  {
    src: { field: 'api_collection_ids', parentTypes: ['api_access_profile'] },
    serializationStrategy: 'id',
    target: { type: 'api_collection' },
  },
  {
    src: { field: 'api_collection_id', parentTypes: ['api_endpoint'] },
    serializationStrategy: 'id',
    target: { type: 'api_collection' },
  },
  {
    src: { field: 'flow_id', parentTypes: ['api_endpoint'] },
    serializationStrategy: 'id',
    target: { type: 'recipe' },
  },
  {
    src: { field: 'parent_id', parentTypes: ['folder'] },
    serializationStrategy: 'id',
    target: { type: 'folder' },
  },
  {
    src: { field: 'account_id', parentTypes: [toNestedTypeName('recipe', 'config')] },
    serializationStrategy: 'id',
    target: { type: 'connection' },
  },

  // serialization-only rule, for translating the reference back to the original value pre-deploy
  // (not used in fetch-only)
  {
    src: { field: 'code', parentTypes: ['recipe'] },
    serializationStrategy: 'fullValue',
  },
]

// We can extract the api name from the elem id as long as we don't support renaming
const apiName: ApiNameFunc = elem => elem.elemID.name

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
      field.name === this.src.field
      && this.src.parentTypes.includes(apiName(field.parent))
    )
  }
}

export type ReferenceResolverFinder = (field: Field) => FieldReferenceResolver[]

/**
 * Generates a function that filters the relevant resolvers for a given field.
 */
export const generateReferenceResolverFinder = (
  defs = fieldNameToTypeMappingDefs,
): ReferenceResolverFinder => {
  const referenceDefinitions = defs.map(
    def => FieldReferenceResolver.create(def)
  )

  const matchersByFieldName = _(referenceDefinitions)
    .filter(def => _.isString(def.src.field))
    .groupBy(def => def.src.field)
    .value()

  return (field => (
    (matchersByFieldName[field.name] ?? []).filter(resolver => resolver.match(field))
  ))
}
