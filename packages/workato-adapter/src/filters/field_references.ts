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
import {
  Field, Element, isInstanceElement, Value, Values,
  ReferenceExpression, InstanceElement,
} from '@salto-io/adapter-api'
import { TransformFunc, transformValues } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { values as lowerDashValues } from '@salto-io/lowerdash'
import { FilterCreator } from '../filter'
import {
  ReferenceSerializationStrategy, ExtendedReferenceTargetDefinition, ReferenceResolverFinder,
  generateReferenceResolverFinder, FieldReferenceDefinition,
} from '../reference_mapping'

const log = logger(module)
const { isDefined } = lowerDashValues
type ElemLookupMapping = Record<string, Record<string, Element>>

const replaceReferenceValues = (
  instance: InstanceElement,
  resolverFinder: ReferenceResolverFinder,
  elemLookupMaps: ElemLookupMapping[],
  fieldsWithResolvedReferences: Set<string>,
): Values => {
  const getRefElem = (
    val: string | number, target: ExtendedReferenceTargetDefinition,
  ): Element | undefined => {
    const findElem = (value: string, targetType?: string): Element | undefined => (
      targetType !== undefined
        // TODO make the field we're using to look up more explicit
        ? elemLookupMaps.map(lookup => lookup[targetType]?.[value]).find(isDefined)
        : undefined
    )

    const elemParent = target.parent
    const elemType = target.type
    return findElem(
      target.lookup(val, elemParent),
      elemType,
    )
  }

  const replacePrimitive = (val: string | number, field: Field): Value => {
    const toValidatedReference = (
      serializer: ReferenceSerializationStrategy,
      elem: Element | undefined,
    ): ReferenceExpression | undefined => {
      if (elem === undefined) {
        return undefined
      }
      const res = (serializer.serialize({
        ref: new ReferenceExpression(elem.elemID, elem),
        field,
      }) === val) ? new ReferenceExpression(elem.elemID) : undefined
      if (res !== undefined) {
        fieldsWithResolvedReferences.add(field.elemID.getFullName())
      }
      return res
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
    (!_.isUndefined(field)
    && ((_.isString(value) || _.isNumber(value))))
      ? replacePrimitive(value, field)
      : value
  )

  return transformValues(
    {
      values: instance.value,
      type: instance.type,
      transformFunc: transformPrimitive,
      strict: false,
      pathID: instance.elemID,
    }
  ) ?? instance.value
}

const mapFieldToElem = (
  instances: InstanceElement[], fieldName: string,
): Record<string, Element> => (
  _(instances)
    .filter(e => e.value[fieldName] !== undefined)
    .map(e => [e.value[fieldName], e])
    .fromPairs()
    .value()
)

const groupByTypeAndField = (
  instances: InstanceElement[], fieldName: string,
): ElemLookupMapping => (
  _(instances)
    .groupBy(e => e.type.elemID.name)
    .mapValues(insts => mapFieldToElem(insts, fieldName))
    .value()
)

export const addReferences = (
  elements: Element[],
  defs?: FieldReferenceDefinition[]
): void => {
  const resolverFinder = generateReferenceResolverFinder(defs)
  const instances = elements.filter(isInstanceElement)
  const elemIDLookup = groupByTypeAndField(instances, 'id')
  const fieldsWithResolvedReferences = new Set<string>()
  instances.forEach(instance => {
    instance.value = replaceReferenceValues(
      instance,
      resolverFinder,
      [elemIDLookup],
      fieldsWithResolvedReferences,
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
