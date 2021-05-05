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
import { Element, Values, Field, InstanceElement, ReferenceExpression, SaltoError } from '@salto-io/adapter-api'
import { FilterCreator } from '../filter'
import { apiName, isInstanceOfCustomObject } from '../transformers/transformer'
import { FIELD_ANNOTATIONS, CUSTOM_OBJECT_ID_FIELD } from '../constants'
import { isLookupField, isMasterDetailField } from './utils'
import { FilterResult } from '../types'

const { makeArray } = collections.array
const { isDefined } = lowerdashValues
const { DefaultMap } = collections.map

const log = logger(module)

type RefOrigin = { type: string; id: string; field?: string }
type MissingRef = {
  originType: string
  originId: string
  originField?: string
  targetType: string
  targetId: string
}

const INTERNAL_ID_SEPARATOR = '$'

const serializeInternalID = (typeName: string, id: string): string =>
  (`${typeName}${INTERNAL_ID_SEPARATOR}${id}`)

const serializeInstanceInternalID = (instance: InstanceElement): string =>
  serializeInternalID(apiName(instance.type, true), apiName(instance))

const deserializeInternalID = (internalID: string): RefOrigin => {
  const splitInternalID = internalID.split(INTERNAL_ID_SEPARATOR)
  if (splitInternalID.length !== 2) {
    throw Error(`Invalid Custom Object Instance internalID - ${internalID}`)
  }
  return {
    type: splitInternalID[0], id: splitInternalID[1],
  }
}

const createWarningFromMsg = (message: string): SaltoError =>
  ({
    message,
    severity: 'Warning',
  })

// TODO: Improve this
// This is a very initial implementation
const createWarnings = (
  instancesWithCollidingElemID: InstanceElement[],
  missingRefs: MissingRef[],
  illegalRefSources: Set<string>,
  baseUrl?: string,
): SaltoError[] => {
  const typeToElemIDtoInstances = _.mapValues(
    _.groupBy(instancesWithCollidingElemID, instance => apiName(instance.type, true)),
    instances => _.groupBy(instances, instance => instance.elemID.getFullName())
  )

  const duplicationWarnings = Object.entries(typeToElemIDtoInstances)
    .map(([type, elemIDtoInstances]) => {
      const numInstances = Object.values(elemIDtoInstances)
        .flat().length
      const header = `${type} had ${numInstances} instances that were dropped due to SaltoID collisions`
      const collisionMsgs = Object.entries(elemIDtoInstances)
        .map(([elemID, instances]) => `SaltoID ${elemID} collided for these instances -
        ${instances.map(instance =>
    (baseUrl
      ? `\t* ${baseUrl}/${instance.value[CUSTOM_OBJECT_ID_FIELD]}`
      : `\t* Instance with Id - ${instance.value[CUSTOM_OBJECT_ID_FIELD]}`)).join('\n')}`)
      return createWarningFromMsg([
        header,
        '',
        ...collisionMsgs,
      ].join('\n'))
    })

  const missingRefsWarnings = Object.entries(
    _.groupBy(missingRefs, missingRef => missingRef.targetType)
  ).map(([type, typeMissingRefs]) => (createWarningFromMsg(`Type ${type} has references to instances that does not exist from:
  ${typeMissingRefs.map(missingRef => `\t* Instance of type ${missingRef.originType} with Id ${missingRef.originId}, from field ${missingRef.originField}`).join('\n')}
  `)))

  const typeToIDsSources = _.mapValues(
    _.groupBy([...illegalRefSources].map(deserializeInternalID), source => source.type),
    sources => sources.map(source => source.id),
  )

  const illegalOriginsWarnings = Object.entries(typeToIDsSources)
    .map(([type, ids]) =>
      createWarningFromMsg(`Dropped ${ids.length} instances of type ${type} as a side effect of other dropped elements`))

  return [
    ...duplicationWarnings,
    ...missingRefsWarnings,
    ...illegalOriginsWarnings,
  ]
}

const isReferenceField = (field?: Field): boolean => (
  isDefined(field) && (isLookupField(field) || isMasterDetailField(field))
)

const replaceLookupsWithRefsAndCreateRefMap = (
  instances: InstanceElement[],
  internalToInstance: Record<string, InstanceElement>,
): {
  reverseReferencesMap: collections.map.DefaultMap<string, Set<string>>
  // typeToMissingRefOrigins: collections.map.DefaultMap<string, Set<RefOrigin>>
  missingRefs: MissingRef[]
} => {
  const reverseReferencesMap = new DefaultMap<string, Set<string>>(() => new Set())
  // const typeToMissingRefOrigins = new DefaultMap<string, Set<RefOrigin>>(() => new Set())
  const missingRefs: MissingRef[] = []
  const replaceLookups = (
    instance: InstanceElement
  ): Values => {
    const transformFunc: TransformFunc = ({ value, field }) => {
      if (!isReferenceField(field)) {
        return value
      }
      const refTo = makeArray(field?.annotations?.[FIELD_ANNOTATIONS.REFERENCE_TO])
      const refTarget = refTo
        .map(typeName => internalToInstance[serializeInternalID(typeName, value)])
        .filter(isDefined)
        .pop()
      if (refTarget === undefined) {
        if (!_.isEmpty(value) && (field?.annotations?.[FIELD_ANNOTATIONS.CREATABLE]
            || field?.annotations?.[FIELD_ANNOTATIONS.UPDATEABLE])) {
          const missingRefsToTargets = refTo.map(targetName => ({
            originType: apiName(instance.type, true),
            originId: instance.value[CUSTOM_OBJECT_ID_FIELD],
            originField: field.name,
            targetType: targetName,
            targetId: instance.value[field.name],
          }))
          missingRefs.concat(missingRefsToTargets)
        }
        return value
      }
      reverseReferencesMap.get(serializeInstanceInternalID(refTarget))
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
  return { reverseReferencesMap, missingRefs }
}

const getIllegalRefSources = (
  initialIllegalRefTargets: Set<string>,
  reverseRefsMap: collections.map.DefaultMap<string, Set<string>>,
): Set<string> => {
  const illegalRefSources = new Set<string>()
  const illegalRefTargets = [
    ...initialIllegalRefTargets,
  ]
  while (illegalRefTargets.length > 0) {
    const currentBrokenRef = illegalRefTargets.pop()
    if (currentBrokenRef === undefined) {
      break
    }
    const refsToCurrentIllegal = [...reverseRefsMap.get(currentBrokenRef)]
    refsToCurrentIllegal.filter(r => !illegalRefSources.has(r))
      .forEach(newIllegalRefFrom => {
        illegalRefTargets.push(newIllegalRefFrom)
        illegalRefSources.add(newIllegalRefFrom)
      })
  }
  return illegalRefSources
}

const filter: FilterCreator = ({ client }) => ({
  onFetch: async (elements: Element[]): Promise<FilterResult> => {
    const customObjectInstances = elements.filter(isInstanceOfCustomObject)
    const internalToInstance = _.keyBy(customObjectInstances, serializeInstanceInternalID)
    const { reverseReferencesMap, missingRefs } = replaceLookupsWithRefsAndCreateRefMap(
      customObjectInstances,
      internalToInstance,
    )
    const instancesWithCollidingElemID = Object
      .values(_.groupBy(
        customObjectInstances,
        instance => instance.elemID.getFullName(),
      ))
      .filter(instances => instances.length > 1)
      .flat()
    const missingRefOriginInternalIDs = new Set(
      missingRefs
        .map(missingRef => serializeInternalID(missingRef.originType, missingRef.originId))
    )
    const instWithDupElemIDInterIDs = new Set(
      instancesWithCollidingElemID.flatMap(serializeInstanceInternalID)
    )
    const illegalRefTargets = new Set(
      [
        ...missingRefOriginInternalIDs, ...instWithDupElemIDInterIDs,
      ]
    )
    const illegalRefSources = getIllegalRefSources(illegalRefTargets, reverseReferencesMap)
    const invalidInstances = new Set(
      [
        ...illegalRefSources,
        ...illegalRefTargets,
      ]
    )
    _.remove(
      elements,
      element =>
        (isInstanceOfCustomObject(element)
        && invalidInstances.has(serializeInstanceInternalID(element))),
    )
    const baseUrl = await client.getUrl()
    return {
      errors: createWarnings(
        instancesWithCollidingElemID,
        missingRefs,
        illegalRefSources,
        baseUrl?.origin,
      ),
    }
  },
})

export default filter
