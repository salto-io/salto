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
import { types } from '@salto-io/lowerdash'
import { GetLookupNameFunc } from '@salto-io/adapter-utils'

export type ApiNameFunc = (elem: Element) => string
type LookupFunc = (val: Value, context?: string) => string

export type ReferenceSerializationStrategy = {
  serialize: GetLookupNameFunc
  lookup: LookupFunc
  lookupIndexName?: string
}

export type ReferenceSerializationStrategyName = 'fullValue' | 'id' | 'name'
export const ReferenceSerializationStrategyLookup: Record<
  ReferenceSerializationStrategyName, ReferenceSerializationStrategy
> = {
  fullValue: {
    serialize: ({ ref }) => ref.value,
    lookup: val => val,
  },
  id: {
    serialize: ({ ref }) => ref.value.value.id,
    lookup: val => val,
    lookupIndexName: 'id',
  },
  name: {
    serialize: ({ ref }) => ref.value.value.name,
    lookup: val => val,
    lookupIndexName: 'name',
  },
}

type MetadataTypeArgs<T extends string> = {
  type: string
  typeContext: T
}
type MetadataParentArgs<T extends string> = {
  parent?: string
  parentContext?: T
}

export type ReferenceTargetDefinition<T extends string> = (
  { name?: string }
  & types.OneOf<MetadataTypeArgs<T>>
  & types.OneOf<MetadataParentArgs<T>>
)
export type ExtendedReferenceTargetDefinition<
  T extends string
> = ReferenceTargetDefinition<T> & { lookup: LookupFunc }

type SourceDef = {
  field: string | RegExp
  parentTypes?: string[]
}

/**
 * A rule defining how to convert values to reference expressions (on fetch),
 * and reference expressions back to values (on deploy).
 * Overlaps between rules are allowed, and the first successful conversion wins.
 * Current order (defined by generateReferenceResolverFinder):
 *  1. Exact field names take precedence over regexp
 *  2. Order within each group is currently *not* guaranteed (groupBy is not stable)
 *
 * A value will be converted into a reference expression if:
 * 1. An element matching the rule is found.
 * 2. Resolving the resulting reference expression back returns the original value.
 */
export type FieldReferenceDefinition<
  T extends string | never
> = {
  src: SourceDef
  serializationStrategy?: ReferenceSerializationStrategyName
  // If target is missing, the definition is used for resolving
  target?: ReferenceTargetDefinition<T>
}

// We can extract the api name from the elem id as long as we don't support renaming
const elemLookupName: ApiNameFunc = elem => elem.elemID.name

type FieldReferenceResolverDetails<T extends string> = {
  serializationStrategy: ReferenceSerializationStrategy
  target?: ExtendedReferenceTargetDefinition<T>
}

export class FieldReferenceResolver<T extends string> {
  src: SourceDef
  serializationStrategy: ReferenceSerializationStrategy
  target?: ExtendedReferenceTargetDefinition<T>

  constructor(def: FieldReferenceDefinition<T>) {
    this.src = def.src
    this.serializationStrategy = ReferenceSerializationStrategyLookup[
      def.serializationStrategy ?? 'fullValue'
    ]
    this.target = def.target
      ? { ...def.target, lookup: this.serializationStrategy.lookup }
      : undefined
  }

  static create<S extends string>(def: FieldReferenceDefinition<S>): FieldReferenceResolver<S> {
    return new FieldReferenceResolver<S>(def)
  }

  match(field: Field): boolean {
    return (
      field.name === this.src.field
      && (
        this.src.parentTypes === undefined
        || this.src.parentTypes.includes(elemLookupName(field.parent))
      )
    )
  }
}

export type ReferenceResolverFinder<T extends string> = (
  field: Field
) => Promise<FieldReferenceResolverDetails<T>[]>

/**
 * Generates a function that filters the relevant resolvers for a given field.
 */
export const generateReferenceResolverFinder = <
  T extends string,
  GenericFieldReferenceDefinition extends FieldReferenceDefinition<T>
>(
    defs: GenericFieldReferenceDefinition[],
    fieldReferenceResolverCreator?:
      (def: GenericFieldReferenceDefinition) => FieldReferenceResolver<T>
  ): ReferenceResolverFinder<T> => {
  const referenceDefinitions = defs.map(
    def => (fieldReferenceResolverCreator
      ? fieldReferenceResolverCreator(def)
      : FieldReferenceResolver.create<T>(def))
  )

  const matchersByFieldName = _(referenceDefinitions)
    .filter(def => _.isString(def.src.field))
    .groupBy(def => def.src.field)
    .value()

  return (async field => (
    (matchersByFieldName[field.name] ?? []).filter(resolver => resolver.match(field))
  ))
}
