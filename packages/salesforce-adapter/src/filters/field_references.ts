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
import {
  Field, Element, isInstanceElement, Value, Values, isObjectType, isReferenceExpression,
  ReferenceExpression, InstanceElement, INSTANCE_ANNOTATIONS,
} from '@salto-io/adapter-api'
import { TransformFunc, transformValues } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { collections, values as lowerDashValues } from '@salto-io/lowerdash'
import { apiName, metadataType, isCustomObject } from '../transformers/transformer'
import { FilterCreator } from '../filter'
import {
  ReferenceSerializationStrategy, ExtendedReferenceTargetDefinition, ReferenceResolverFinder,
  generateReferenceResolverFinder, ReferenceContextStrategyName, FieldReferenceDefinition,
} from '../transformers/reference_mapping'

const log = logger(module)
const { isDefined } = lowerDashValues
const { makeArray } = collections.array
type ElemLookupMapping = Record<string, Record<string, Element>>
type ElemIDToApiNameLookup = Record<string, string>
type ContextFunc = (
  instance: InstanceElement,
  elemIdToApiName: ElemIDToApiNameLookup,
) => string | undefined

const ContextStrategyLookup: Record<
  ReferenceContextStrategyName, ContextFunc
> = {
  none: () => undefined,
  instanceParent: (instance, elemIdToApiName) => {
    const parent = makeArray(instance.annotations[INSTANCE_ANNOTATIONS.PARENT])[0]
    return isReferenceExpression(parent) ? elemIdToApiName[parent.elemId.getFullName()] : undefined
  },
}

const replaceReferenceValues = (
  instance: InstanceElement,
  resolverFinder: ReferenceResolverFinder,
  elemLookupMap: ElemLookupMapping,
  fieldsWithResolvedReferences: Set<string>,
  elemIdToApiName: ElemIDToApiNameLookup,
): Values => {
  const getRefElem = (
    val: string, target: ExtendedReferenceTargetDefinition,
  ): Element | undefined => {
    const findElem = (targetType: string, value: string): Element | undefined => (
      elemLookupMap[targetType]?.[value]
    )

    const contextFunc = ContextStrategyLookup[target.parentContext ?? 'none']
    if (contextFunc === undefined) {
      return undefined
    }
    return findElem(
      target.type,
      target.lookup(val, contextFunc(instance, elemIdToApiName)),
    )
  }

  const replacePrimitive = (val: string, field: Field): Value => {
    const toValidatedReference = (
      serializer: ReferenceSerializationStrategy,
      elem: Element | undefined,
    ): ReferenceExpression | undefined => {
      if (elem === undefined) {
        return undefined
      }
      fieldsWithResolvedReferences.add(field.elemID.getFullName())
      return (serializer.serialize({
        ref: new ReferenceExpression(elem.elemID, elem),
        field,
      }) === val) ? new ReferenceExpression(elem.elemID) : undefined
    }

    const reference = resolverFinder(field)
      .filter(refResolver => refResolver.target !== undefined)
      .map(refResolver => toValidatedReference(
        refResolver.serializationStrategy,
        getRefElem(val, refResolver.target as ExtendedReferenceTargetDefinition),
      ))
      .filter(isDefined)
      .pop()

    return reference ?? val
  }

  const transformPrimitive: TransformFunc = ({ value, field }) => (
    (!_.isUndefined(field) && _.isString(value)) ? replacePrimitive(value, field) : value
  )

  return transformValues(
    {
      values: instance.value,
      type: instance.type,
      transformFunc: transformPrimitive,
      strict: false,
    }
  ) || instance.value
}

const mapApiNameToElem = (elements: Element[]): Record<string, Element> => (
  _(elements)
    .map(e => [apiName(e), e])
    .fromPairs()
    .value()
)

const groupByMetadataTypeAndApiName = (elements: Element[]): ElemLookupMapping => (
  _(elements)
    .flatMap(e => ((isObjectType(e) && isCustomObject(e))
      ? [e, ..._.values(e.fields)] : [e]))
    .groupBy(metadataType)
    .mapValues(mapApiNameToElem)
    .value()
)

const mapElemIdToApiName = (elements: Element[]): ElemIDToApiNameLookup => (
  _(elements)
    .flatMap(e => ((isObjectType(e) && isCustomObject(e))
      ? [e, ..._.values(e.fields)] : [e]))
    .map(e => [e.elemID.getFullName(), apiName(e)])
    .fromPairs()
    .value()
)

export const addReferences = (
  elements: Element[],
  defs?: FieldReferenceDefinition[]
):
void => {
  const resolverFinder = generateReferenceResolverFinder(defs)
  const elemLookup = groupByMetadataTypeAndApiName(elements)
  const fieldsWithResolvedReferences = new Set<string>()
  const elemIdToApiName = mapElemIdToApiName(elements)
  elements.filter(isInstanceElement).forEach(instance => {
    instance.value = replaceReferenceValues(
      instance,
      resolverFinder,
      elemLookup,
      fieldsWithResolvedReferences,
      elemIdToApiName,
    )
  })
  log.debug('added references in the following fields: %s', [...fieldsWithResolvedReferences])
}

/**
 * Convert field values into references, based on predefined rules.
 *
 */
const filter: FilterCreator = () => ({
  onFetch: async (elements: Element[]) => {
    addReferences(elements)
  },
})

export default filter
