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
import { collections, values as lowerdashValues } from '@salto-io/lowerdash'
import { transformValues, TransformFunc } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { Element, Values, Field, InstanceElement, ReferenceExpression } from '@salto-io/adapter-api'
import { FilterCreator } from '../filter'
import { apiName, isInstanceOfCustomObject } from '../transformers/transformer'
import { FIELD_ANNOTATIONS, CUSTOM_OBJECT_ID_FIELD } from '../constants'
import { isLookupField, isMasterDetailField } from './utils'

const { makeArray } = collections.array
const { isDefined } = lowerdashValues
const { DefaultMap } = collections.map

const log = logger(module)

const serializeInternalID = (typeName: string, id: string): string =>
  (`${typeName}&${id}`)

const serializeInstanceInternalID = (instance: InstanceElement): string =>
  serializeInternalID(apiName(instance.type, true), instance.value[CUSTOM_OBJECT_ID_FIELD])

const createInternalToInstance = (instances: InstanceElement[]): Record<string, InstanceElement> =>
  (_.keyBy(instances, serializeInstanceInternalID))

const shouldReplaceFieldVal = (field: Field): boolean => (
  isLookupField(field) || isMasterDetailField(field)
)

const replaceLookupsWithReferencesAndCreateRefMap = (
  instances: InstanceElement[],
  internalToInstance: Record<string, InstanceElement>,
): {
  reverseRefsMap: collections.map.DefaultMap<string, Set<string>>
  referenceToNothing: Set<InstanceElement>
} => {
  const internalToReferencedFrom = new DefaultMap<string, Set<string>>(() => new Set())
  const referenceToNothing = new Set<InstanceElement>()
  const replaceLookups = (
    instance: InstanceElement
  ): Values => {
    const transformFunc: TransformFunc = ({ value, field }) => {
      if (_.isUndefined(field) || !shouldReplaceFieldVal(field)) {
        return value
      }
      const refTo = makeArray(field?.annotations?.[FIELD_ANNOTATIONS.REFERENCE_TO])
      const refTarget = refTo
        .map(typeName => internalToInstance[serializeInternalID(typeName, value)])
        .filter(isDefined)
        .pop()
      if (refTarget === undefined) {
        referenceToNothing.add(instance)
        return value
      }
      internalToReferencedFrom.get(serializeInstanceInternalID(refTarget))
        .add(serializeInstanceInternalID(instance))
      return new ReferenceExpression(refTarget.elemID)
    }

    return transformValues(
      {
        values: instance.value,
        type: instance.type,
        transformFunc,
        strict: false,
      }
    ) ?? instance.value
  }

  instances.forEach((instance, index) => {
    instance.value = replaceLookups(instance)
    if (index > 0 && index % 500 === 0) {
      log.debug(`Replaced lookup with references for ${index} instances`)
    }
  })
  return {
    reverseRefsMap: internalToReferencedFrom, referenceToNothing,
  }
}

const getIllegalRefsFrom = (
  referencesToNothing: Set<InstanceElement>,
  duplicates: InstanceElement[],
  reverseRefsMap: collections.map.DefaultMap<string, Set<string>>,
): Set<string> => {
  const illegalRefsFromSet = new Set<string>()
  const illegalRefsTargets = [
    ...[...referencesToNothing].flatMap(serializeInstanceInternalID),
    ...duplicates.flatMap(serializeInstanceInternalID),
  ]
  while (illegalRefsTargets.length > 0) {
    const currentBrokenRef = illegalRefsTargets.pop()
    if (currentBrokenRef === undefined) {
      break
    }
    const refsToCurrentIllegal = [...reverseRefsMap.get(currentBrokenRef)]
    refsToCurrentIllegal.filter(r => !illegalRefsFromSet.has(r))
      .forEach(newIllegalRefFrom => {
        illegalRefsTargets.push(newIllegalRefFrom)
        illegalRefsFromSet.add(newIllegalRefFrom)
      })
  }
  return illegalRefsFromSet
}

const filter: FilterCreator = () => ({
  onFetch: async (elements: Element[]) => {
    const customObjectInstances = elements.filter(isInstanceOfCustomObject)
    const internalToInstance = createInternalToInstance(customObjectInstances)
    const { reverseRefsMap, referenceToNothing } = replaceLookupsWithReferencesAndCreateRefMap(
      customObjectInstances,
      internalToInstance,
    )
    const instancesWithDuplicateElemID = Object
      .values(_.groupBy(customObjectInstances, instance => instance.elemID.getFullName()))
      .filter(instances => instances.length > 1)
      .flat()
    const illegalRefsFrom = getIllegalRefsFrom(
      referenceToNothing, instancesWithDuplicateElemID, reverseRefsMap,
    )
    const invalidInstances = new Set(
      [
        ...illegalRefsFrom,
        ...[...referenceToNothing].flatMap(serializeInstanceInternalID),
        ...instancesWithDuplicateElemID.flatMap(serializeInstanceInternalID),
      ]
    )
    _.remove(
      elements,
      element =>
        (isInstanceOfCustomObject(element)
        && invalidInstances.has(serializeInstanceInternalID(element))),
    )
  },
})

export default filter
