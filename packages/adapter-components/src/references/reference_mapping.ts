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
import { Field, Value, Element, isInstanceElement, ElemID, InstanceElement, cloneDeepWithoutRefs } from '@salto-io/adapter-api'
import { collections, types } from '@salto-io/lowerdash'
import { GetLookupNameFunc } from '@salto-io/adapter-utils'

const { awu } = collections.asynciterable

export type ApiNameFunc = (elem: Element) => string
export type LookupFunc = (val: Value, context?: string) => string
export type CreateMissingRefFunc = (
  params: { value: string; adapter: string; typeName?: string }
) => Element | undefined
export type CheckMissingRefFunc = (element: Element) => boolean

export type GetReferenceIdFunc = (topLevelId: ElemID) => ElemID

export type ReferenceSerializationStrategy = {
  lookup: LookupFunc
  lookupIndexName?: string
} & (
  types.OneOf<{
    serialize: GetLookupNameFunc
    // getReferenceId set the path of the value that the reference will be set by.
    // Note that this path will also be the path of the reference, meaning the if
    // it won't return a top level id, the reference path won't be a top level id.
    getReferenceId: GetReferenceIdFunc
  }>
)
export const basicLookUp: LookupFunc = val => val

export type ReferenceSerializationStrategyName = 'fullValue' | 'id' | 'name' | 'nameWithPath'
export const ReferenceSerializationStrategyLookup: Record<
  ReferenceSerializationStrategyName, ReferenceSerializationStrategy
> = {
  fullValue: {
    serialize: ({ ref }) => cloneDeepWithoutRefs(
      isInstanceElement(ref.value) ? ref.value.value : ref.value
    ),
    lookup: basicLookUp,
  },
  id: {
    serialize: ({ ref }) => ref.value.value.id,
    lookup: basicLookUp,
    lookupIndexName: 'id',
  },
  name: {
    serialize: ({ ref }) => ref.value.value.name,
    lookup: basicLookUp,
    lookupIndexName: 'name',
  },
  nameWithPath: {
    lookup: basicLookUp,
    lookupIndexName: 'name',
    getReferenceId: topLevelId => topLevelId.createNestedID('name'),
  },
}

export type ReferenceSourceTransformation = {
  transform: (fieldValue: string|number) => string
  validate: (referringFieldValue: string|number, serializedRefExpr: string) => boolean
}

export type ReferenceSourceTransformationName = 'exact' | 'asString' | 'asCaseInsensitiveString'
export const ReferenceSourceTransformationLookup: Record<
ReferenceSourceTransformationName,
ReferenceSourceTransformation
> = {
  exact: {
    transform: fieldValue => _.toString(fieldValue),
    validate: (referringFieldValue, serializedRefExpr) => referringFieldValue === serializedRefExpr,
  },
  asString: {
    transform: fieldValue => _.toString(fieldValue),
    validate: (referringFieldValue, serializedRefExpr) => (
      _.toString(referringFieldValue) === _.toString(serializedRefExpr)
    ),
  },
  asCaseInsensitiveString: {
    transform: fieldValue => _.toString(fieldValue).toLocaleLowerCase(),
    validate: (referringFieldValue, serializedRefExpr) => (
      _.toString(referringFieldValue).toLocaleLowerCase() === _.toString(serializedRefExpr).toLocaleLowerCase()
    ),
  },
}

export type MissingReferenceStrategy = {
  create: CreateMissingRefFunc
}
export type MissingReferenceStrategyName = 'typeAndValue' | 'startsWith'

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
  field: string
  parentTypes?: string[]
  // when available, only consider instances matching one or more of the specified types
  instanceTypes?: (string | RegExp)[]
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
  sourceTransformation?: ReferenceSourceTransformationName
  // If target is missing, the definition is used for resolving
  target?: ReferenceTargetDefinition<T>
  // If missingRefStrategy is missing, we won't replace broken values with missing references
  missingRefStrategy?: MissingReferenceStrategyName
}

// We can extract the api name from the elem id as long as we don't support renaming
const elemLookupName: ApiNameFunc = elem => elem.elemID.name

const matchName = (name: string, matcher: string | RegExp): boolean => (
  _.isString(matcher)
    ? matcher === name
    : matcher.test(name)
)

const matchInstanceType = async (
  inst: InstanceElement,
  matchers: (string | RegExp)[],
): Promise<boolean> => {
  const typeName = elemLookupName(await inst.getType())
  return matchers.some(matcher => matchName(typeName, matcher))
}

type FieldReferenceResolverDetails<T extends string> = {
  serializationStrategy: ReferenceSerializationStrategy
  sourceTransformation: ReferenceSourceTransformation
  target?: ExtendedReferenceTargetDefinition<T>
  missingRefStrategy?: MissingReferenceStrategy
}

export class FieldReferenceResolver<T extends string> {
  src: SourceDef
  serializationStrategy: ReferenceSerializationStrategy
  sourceTransformation: ReferenceSourceTransformation
  target?: ExtendedReferenceTargetDefinition<T>
  missingRefStrategy?: MissingReferenceStrategy

  constructor(def: FieldReferenceDefinition<T>) {
    this.src = def.src
    this.serializationStrategy = ReferenceSerializationStrategyLookup[
      def.serializationStrategy ?? 'fullValue'
    ]
    this.sourceTransformation = ReferenceSourceTransformationLookup[def.sourceTransformation ?? 'exact']
    this.target = def.target
      ? { ...def.target, lookup: this.serializationStrategy.lookup }
      : undefined
  }

  static create<S extends string>(def: FieldReferenceDefinition<S>): FieldReferenceResolver<S> {
    return new FieldReferenceResolver<S>(def)
  }

  async match(field: Field, element: Element): Promise<boolean> {
    return (
      matchName(field.name, this.src.field)
      && (
        this.src.parentTypes === undefined
        || this.src.parentTypes.includes(elemLookupName(field.parent))
      )
      && (this.src.instanceTypes === undefined
        || (isInstanceElement(element) && matchInstanceType(element, this.src.instanceTypes)))
    )
  }
}

export type ReferenceResolverFinder<T extends string> = (
  field: Field,
  element: Element,
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

  return (async (field, element) => (
    awu(matchersByFieldName[field.name] ?? [])
      .filter(resolver => resolver.match(field, element))
      .toArray()
  ))
}
