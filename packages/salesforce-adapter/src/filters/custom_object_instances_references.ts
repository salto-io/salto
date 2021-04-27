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
import wu from 'wu'
import { collections, values as lowerdashValues } from '@salto-io/lowerdash'
import { transformValues, TransformFunc, safeJsonStringify } from '@salto-io/adapter-utils'
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
  instancesWithDuplicateElemID: InstanceElement[],
  typeToMissingRefOrigins: collections.map.DefaultMap<string, Set<RefOrigin>>,
  illegalRefSources: Set<string>,
): SaltoError[] => {
  const typeToElemIDtoInstances = _.mapValues(
    _.groupBy(instancesWithDuplicateElemID, instance => apiName(instance.type, true)),
    instances => _.groupBy(instances, instance => instance.elemID.getFullName())
  )

  const duplicationWarnings = Object.entries(typeToElemIDtoInstances)
    .map(([type, elemIDtoInstances]) => {
      const numInstances = Object.values(elemIDtoInstances)
        .flat().length
      const header = `Dropped ${numInstances} instances of type ${type} due to SaltoID conflicts`
      const duplicatesMsgs = Object.entries(elemIDtoInstances)
        .map(([elemID, instances]) => `Conflicting SaltoID ${elemID} for instances with values - 
          ${instances.map(instance => safeJsonStringify(instance.value, undefined, 2)).join('\n')}`)
      return createWarningFromMsg([
        header,
        '',
        ...duplicatesMsgs,
      ].join('\n'))
    })

  const missingRefsWarnings = wu(typeToMissingRefOrigins.entries()).toArray()
    .map(([type, origins]) => {
      const originsArr = [...(origins as Set<RefOrigin>)] // Not sure why needed
      return createWarningFromMsg(`Type ${type} has references to instances that does not exist from:
      ${originsArr.map(origin => `    * Instance of type ${origin.type} with Id ${origin.id}, from field ${origin.field}`).join('\n')}
      `)
    })

  const typeToIDsSources = _.mapValues(
    _.groupBy([...illegalRefSources].map(deserializeInternalID), source => source.type),
    sources => sources.map(source => source.id),
  )

  const illegalOriginsWarnings = Object.entries(typeToIDsSources)
    .map(([type, ids]) =>
      createWarningFromMsg(`Type ${type} dropped instances with the following Ids due to references to other dropped instances -
      ${(ids).map(id => `    * ${id}`).join('\n')}
    `))

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
  typeToMissingRefOrigins: collections.map.DefaultMap<string, Set<RefOrigin>>
} => {
  const reverseReferencesMap = new DefaultMap<string, Set<string>>(() => new Set())
  const typeToMissingRefOrigins = new DefaultMap<string, Set<RefOrigin>>(() => new Set())
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
          refTo.forEach(targetName =>
            typeToMissingRefOrigins.get(targetName).add({
              type: apiName(instance.type, true),
              id: instance.value[CUSTOM_OBJECT_ID_FIELD],
              field: field.name,
            }))
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
  return { reverseReferencesMap, typeToMissingRefOrigins }
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

const filter: FilterCreator = () => ({
  onFetch: async (elements: Element[]): Promise<FilterResult> => {
    const customObjectInstances = elements.filter(isInstanceOfCustomObject)
    const internalToInstance = _.keyBy(customObjectInstances, serializeInstanceInternalID)
    const { reverseReferencesMap, typeToMissingRefOrigins } = replaceLookupsWithRefsAndCreateRefMap(
      customObjectInstances,
      internalToInstance,
    )
    const instancesWithDuplicateElemID = Object
      .values(_.groupBy(
        customObjectInstances,
        instance => serializeInternalID(apiName(instance.type, true), instance.elemID.getFullName())
      ))
      .filter(instances => instances.length > 1)
      .flat()
    const missingRefOriginInternalIDs = new Set(
      [...typeToMissingRefOrigins.values()]
        .flatMap(origins => [...origins].map(origin => serializeInternalID(origin.type, origin.id)))
    )
    const instWithDupElemIDInterIDs = new Set(
      instancesWithDuplicateElemID.flatMap(serializeInstanceInternalID)
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
    return {
      errors: createWarnings(
        instancesWithDuplicateElemID,
        typeToMissingRefOrigins,
        illegalRefSources,
      ),
    }
  },
})

export default filter
