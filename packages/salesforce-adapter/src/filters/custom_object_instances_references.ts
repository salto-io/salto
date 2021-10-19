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
import { collections, values as lowerdashValues, promises } from '@salto-io/lowerdash'
import { transformValues, TransformFunc, safeJsonStringify } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { Element, Values, Field, InstanceElement, ReferenceExpression, SaltoError } from '@salto-io/adapter-api'
import { FilterCreator, FilterResult } from '../filter'
import { apiName, isInstanceOfCustomObject, isCustomObject } from '../transformers/transformer'
import { FIELD_ANNOTATIONS, KEY_PREFIX, KEY_PREFIX_LENGTH } from '../constants'
import { addElementParentReference, isLookupField, isMasterDetailField } from './utils'
import { DataManagement } from '../fetch_profile/data_management'

const { makeArray } = collections.array
const { isDefined } = lowerdashValues
const { DefaultMap } = collections.map
const { keyByAsync } = collections.asynciterable
const { removeAsync } = promises.array
const { mapValuesAsync } = promises.object
type RefOrigin = { type: string; id: string; field?: string }
type MissingRef = {
  origin: RefOrigin
  targetId: string
}
const { groupByAsync, awu } = collections.asynciterable

const log = logger(module)


const INTERNAL_ID_SEPARATOR = '$'
const MAX_BREAKDOWN_ELEMENTS = 10
const MAX_BREAKDOWN_DETAILS_ELEMENTS = 3

const serializeInternalID = (typeName: string, id: string): string =>
  (`${typeName}${INTERNAL_ID_SEPARATOR}${id}`)

const serializeInstanceInternalID = async (instance: InstanceElement): Promise<string> => (
  serializeInternalID(await apiName(await instance.getType(), true), await apiName(instance))
)

const deserializeInternalID = (internalID: string): RefOrigin => {
  const splitInternalID = internalID.split(INTERNAL_ID_SEPARATOR)
  if (splitInternalID.length !== 2) {
    throw Error(`Invalid Custom Object Instance internalID - ${internalID}`)
  }
  return {
    type: splitInternalID[0], id: splitInternalID[1],
  }
}

const groupInstancesByTypeAndElemID = async (
  instances: InstanceElement[],
): Promise<Record<string, Record<string, InstanceElement[]>>> =>
  (_.mapValues(
    await groupByAsync(instances, async instance => apiName(await instance.getType(), true)),
    typeInstances => _.groupBy(typeInstances, instance => instance.elemID.name)
  ))

const logInstancesWithCollidingElemID = async (instances: InstanceElement[]): Promise<void> => {
  const typeToElemIDtoInstances = await groupInstancesByTypeAndElemID(instances)
  Object.entries(typeToElemIDtoInstances).forEach(([type, elemIDtoInstances]) => {
    const instancesCount = Object.values(elemIDtoInstances).flat().length
    log.debug(`Omitted ${instancesCount} instances of type ${type} due to Salto ID collisions`)
    Object.entries(elemIDtoInstances).forEach(([elemID, elemIDInstances]) => {
      const relevantInstanceValues = elemIDInstances
        .map(instance => _.pickBy(instance.value, val => !_.isEmpty(val)))
      const relevantInstanceValuesStr = relevantInstanceValues
        .map(instValues => safeJsonStringify(instValues, undefined, 2)).join('\n')
      log.debug(`Omitted instances of type ${type} with colliding ElemID ${elemID} with values - 
  ${relevantInstanceValuesStr}`)
    })
  })
}

const createWarningFromMsg = (message: string): SaltoError =>
  ({
    message,
    severity: 'Warning',
  })

const getInstanceDesc = (instanceId: string, baseUrl?: string): string =>
  (baseUrl ? `${baseUrl}/${instanceId}` : `Instance with Id - ${instanceId}`)

const getInstancesDetailsMsg = (instanceIds: string[], baseUrl?: string): string => {
  const instancesToPrint = instanceIds.slice(0, MAX_BREAKDOWN_DETAILS_ELEMENTS)
  const instancesMsgs = instancesToPrint.map(instanceId => getInstanceDesc(instanceId, baseUrl))
  const overFlowSize = instanceIds.length - MAX_BREAKDOWN_DETAILS_ELEMENTS
  const overFlowMsg = overFlowSize > 0 ? [`${overFlowSize} more instances`] : []
  return [
    ...instancesMsgs,
    ...overFlowMsg,
  ].map(msg => `\t* ${msg}`).join('\n')
}

const createWarnings = async (
  instancesWithCollidingElemID: InstanceElement[],
  missingRefs: MissingRef[],
  illegalRefSources: Set<string>,
  customObjectPrefixKeyMap: Record<string, string>,
  dataManagement: DataManagement,
  baseUrl?: string,
): Promise<SaltoError[]> => {
  const typeToElemIDtoInstances = await groupInstancesByTypeAndElemID(instancesWithCollidingElemID)

  const collisionWarnings = await Promise.all(Object.entries(typeToElemIDtoInstances)
    .map(async ([type, elemIDtoInstances]) => {
      const numInstances = Object.values(elemIDtoInstances)
        .flat().length
      const header = `Omitted ${numInstances} instances of ${type} due to Salto ID collisions. 
Current Salto ID configuration for ${type} is defined as [${dataManagement.getObjectIdsFields(type).join(', ')}].`

      const collisionsHeader = 'Breakdown per colliding Salto ID:'
      const collisionsToDisplay = Object.entries(elemIDtoInstances).slice(0, MAX_BREAKDOWN_ELEMENTS)
      const collisionMsgs = await Promise.all(collisionsToDisplay
        .map(async ([elemID, instances]) => `- ${elemID}:
${getInstancesDetailsMsg(await Promise.all(instances.map(instance => apiName(instance))), baseUrl)}`))
      const epilogue = `To resolve these collisions please take one of the following actions and fetch again:
\t1. Change ${type}'s saltoIDSettings to include all fields that uniquely identify the type's instances.
\t2. Delete duplicate instances from your Salesforce account.
         
Alternatively, you can exclude ${type} from the data management configuration in salesforce.nacl`
      const elemIDCount = Object.keys(elemIDtoInstances).length
      const overflowMsg = elemIDCount > MAX_BREAKDOWN_ELEMENTS ? ['', `And ${elemIDCount - MAX_BREAKDOWN_ELEMENTS} more colliding Salto IDs`] : []
      return createWarningFromMsg([
        header,
        '',
        collisionsHeader,
        ...collisionMsgs,
        ...overflowMsg,
        '',
        epilogue,
      ].join('\n'))
    }))

  const typeToInstanceIdToMissingRefs = _.mapValues(
    _.groupBy(
      missingRefs,
      missingRef => customObjectPrefixKeyMap[missingRef.targetId.substring(0, KEY_PREFIX_LENGTH)],
    ),
    typeMissingRefs => _.groupBy(typeMissingRefs, missingRef => missingRef.targetId)
  )

  const missingRefsWarnings = Object.entries(typeToInstanceIdToMissingRefs)
    .map(([type, instanceIdToMissingRefs]) => {
      const numMissingInstances = Object.keys(instanceIdToMissingRefs).length
      const header = `Identified references to ${numMissingInstances} missing instances of ${type}`
      const perMissingInstToDisplay = Object.entries(instanceIdToMissingRefs)
        .slice(0, MAX_BREAKDOWN_ELEMENTS)
      const perMissingInstanceMsgs = perMissingInstToDisplay
        .map(([instanceId, instanceMissingRefs]) => `${getInstanceDesc(instanceId, baseUrl)} referenced from -
  ${getInstancesDetailsMsg(instanceMissingRefs.map(instanceMissingRef => instanceMissingRef.origin.id), baseUrl)}`)
      const epilogue = `To resolve this issue please edit the salesforce.nacl file to include ${type} instances in the data management configuration and fetch again.

      Alternatively, you can exclude the referring types from the data management configuration in salesforce.nacl`
      const missingInstCount = Object.keys(instanceIdToMissingRefs).length
      const overflowMsg = missingInstCount > MAX_BREAKDOWN_ELEMENTS ? ['', `And ${missingInstCount - MAX_BREAKDOWN_ELEMENTS} more missing Instances`] : []
      return createWarningFromMsg([
        header,
        '',
        ...perMissingInstanceMsgs,
        ...overflowMsg,
        '',
        epilogue,
      ].join('\n'))
    })

  const typesOfIllegalRefSources = _.uniq([...illegalRefSources]
    .map(deserializeInternalID)
    .map(source => source.type))

  const illegalOriginsWarnings = illegalRefSources.size === 0 ? [] : [createWarningFromMsg(`Omitted ${illegalRefSources.size} instances due to the previous SaltoID collisions and/or missing instances.
  Types of the omitted instances are: ${typesOfIllegalRefSources.join(', ')}.`)]

  return [
    ...collisionWarnings,
    ...missingRefsWarnings,
    ...illegalOriginsWarnings,
  ]
}

const isReferenceField = (field?: Field): field is Field => (
  isDefined(field) && (isLookupField(field) || isMasterDetailField(field))
)

const replaceLookupsWithRefsAndCreateRefMap = async (
  instances: InstanceElement[],
  internalToInstance: Record<string, InstanceElement>,
  dataManagement: DataManagement,
): Promise<{
  reverseReferencesMap: collections.map.DefaultMap<string, Set<string>>
  missingRefs: MissingRef[]
}> => {
  const reverseReferencesMap = new DefaultMap<string, Set<string>>(() => new Set())
  const missingRefs: MissingRef[] = []
  const replaceLookups = async (
    instance: InstanceElement
  ): Promise<Values> => {
    const transformFunc: TransformFunc = async ({ value, field }) => {
      if (!isReferenceField(field)) {
        return value
      }
      const refTo = makeArray(field?.annotations?.[FIELD_ANNOTATIONS.REFERENCE_TO])
      const ignoredRefTo = refTo.filter(typeName => dataManagement.shouldIgnoreReference(typeName))
      if (!_.isEmpty(refTo) && ignoredRefTo.length === refTo.length) {
        log.debug(
          'Ignored reference to type/s %s from instance - %s',
          ignoredRefTo.join(', '),
          instance.elemID.getFullName(),
        )
        return value
      }
      if (!_.isEmpty(ignoredRefTo)) {
        log.warn(
          'Not ignoring reference to type/s %s from instance - %s because some of the refTo is legal (refTo = %s)',
          ignoredRefTo.join(', '),
          instance.elemID.getFullName(),
          refTo.join(', '),
        )
      }
      const refTarget = refTo
        .map(typeName => internalToInstance[serializeInternalID(typeName, value)])
        .filter(isDefined)
        .pop()
      if (refTarget === undefined) {
        if (!_.isEmpty(value) && (field?.annotations?.[FIELD_ANNOTATIONS.CREATABLE]
            || field?.annotations?.[FIELD_ANNOTATIONS.UPDATEABLE])) {
          missingRefs.push({
            origin: {
              type: await apiName(await instance.getType(), true),
              id: await apiName(instance),
              field: field.name,
            },
            targetId: instance.value[field.name],
          })
        }

        return value
      }
      reverseReferencesMap.get(await serializeInstanceInternalID(refTarget))
        .add(await serializeInstanceInternalID(instance))
      addElementParentReference(instance, refTarget)
      return new ReferenceExpression(refTarget.elemID)
    }

    return await transformValues(
      {
        values: instance.value,
        type: await instance.getType(),
        transformFunc,
        strict: false,
      }
    ) ?? instance.value
  }

  await awu(instances).forEach(async (instance, index) => {
    instance.value = await replaceLookups(instance)
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

const buildCustomObjectPrefixKeyMap = async (
  elements: Element[]
): Promise<Record<string, string>> => {
  const customObjects = await awu(elements)
    .filter(isCustomObject)
    .filter(customObject => isDefined(customObject.annotations[KEY_PREFIX]))
    .toArray()
  const keyPrefixToCustomObject = _.keyBy(
    customObjects,
    customObject => customObject.annotations[KEY_PREFIX] as string,
  )
  return mapValuesAsync(
    keyPrefixToCustomObject,
    // Looking at Salesforce's keyPrefix results duplicate types with
    // the same prefix exist but are not relevant/important to differentiate between
    keyCustomObject => apiName(keyCustomObject),
  )
}

const filter: FilterCreator = ({ client, config }) => ({
  onFetch: async (elements: Element[]): Promise<FilterResult> => {
    const { dataManagement } = config.fetchProfile
    if (dataManagement === undefined) {
      return {}
    }
    const customObjectInstances = await awu(elements).filter(isInstanceOfCustomObject)
      .toArray() as InstanceElement[]
    const internalToInstance = await keyByAsync(customObjectInstances, serializeInstanceInternalID)
    const { reverseReferencesMap, missingRefs } = await replaceLookupsWithRefsAndCreateRefMap(
      customObjectInstances,
      internalToInstance,
      dataManagement,
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
        .map(missingRef => serializeInternalID(missingRef.origin.type, missingRef.origin.id))
    )
    const instWithDupElemIDInterIDs = new Set(
      await Promise.all(instancesWithCollidingElemID.map(serializeInstanceInternalID))
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
    await removeAsync(
      elements,
      async element =>
        (await isInstanceOfCustomObject(element)
        && invalidInstances.has(await serializeInstanceInternalID(element as InstanceElement))),
    )
    const baseUrl = await client.getUrl()
    const customObjectPrefixKeyMap = await buildCustomObjectPrefixKeyMap(elements)
    await logInstancesWithCollidingElemID(instancesWithCollidingElemID)
    return {
      errors: await createWarnings(
        instancesWithCollidingElemID,
        missingRefs,
        illegalRefSources,
        customObjectPrefixKeyMap,
        dataManagement,
        baseUrl?.origin,
      ),
    }
  },
})

export default filter
