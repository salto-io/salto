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
  Field, Element, isInstanceElement, Value, Values,
  ReferenceExpression,
  InstanceElement,
  INSTANCE_ANNOTATIONS,
  isObjectType,
} from '@salto-io/adapter-api'
import { TransformFunc, transformValues } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { values as lowerDashValues } from '@salto-io/lowerdash'
import { parentApiName } from './utils'
import { apiName, metadataType, isCustomObject } from '../transformers/transformer'
import { FilterCreator } from '../filter'
import {
  ReferenceSerializationStrategy,
  ExtendedReferenceTargetDefinition,
  ReferenceResolverFinder,
  generateReferenceResolverFinder,
  ReferenceContextStrategyName,
} from '../transformers/reference_mapping'

const log = logger(module)
const { isDefined } = lowerDashValues
type ElemLookupMapping = Record<string, Record<string, Element>>

type ContextFunc = (instance: InstanceElement, ...strategyArgs: string[]) => string[]
const ContextStrategyLookup: Record<
  ReferenceContextStrategyName, ContextFunc
> = {
  none: () => [],
  instanceParent: instance => (isDefined(instance.annotations[INSTANCE_ANNOTATIONS.PARENT])
    ? [parentApiName(instance)]
    : []
  ),
}

const replaceReferenceValues = (
  instance: InstanceElement,
  resolverFinder: ReferenceResolverFinder,
  elemLookupMap: ElemLookupMapping,
  fieldsWithResolvedReferences: Set<string>,
): Values => {
  const getRefElem = (
    val: string, target: ExtendedReferenceTargetDefinition,
  ): Element | undefined => {
    const findElem = (targetType: string, value: string): Element | undefined => (
      elemLookupMap[targetType]?.[value]
    )

    const contextFunc = ContextStrategyLookup[target.strategy]
    if (!contextFunc) {
      return undefined
    }
    return findElem(
      target.metadataType,
      target.lookup(val, ...contextFunc(instance, ...(target.name ? [target.name] : []))),
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
      const ref = new ReferenceExpression(elem.elemID, elem)
      return (serializer.serialize({ ref, field }) === val) ? ref : undefined
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

export const groupByMetadataTypeAndApiName = (elements: Element[]): ElemLookupMapping => (
  _(elements)
    .map<Element[]>(e => ((isObjectType(e) && isCustomObject(e))
      ? [e, ..._.values(e.fields)] : [e]))
    .flatten()
    .groupBy(metadataType)
    .mapValues(mapApiNameToElem)
    .value()
)

export const addReferences = (
  elements: Element[],
):
void => {
  const resolverFinder = generateReferenceResolverFinder()
  const elemLookup = groupByMetadataTypeAndApiName(elements)
  const fieldsWithResolvedReferences = new Set<string>()
  elements.filter(isInstanceElement).forEach(instance => {
    instance.value = replaceReferenceValues(
      instance,
      resolverFinder,
      elemLookup,
      fieldsWithResolvedReferences,
    )
  })
  log.debug('added references in the following fields: $s', [...fieldsWithResolvedReferences])
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
