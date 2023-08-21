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
import { collections, values as lowerdashValues, promises } from '@salto-io/lowerdash'
import {
  transformValues,
  TransformFunc,
  getAndLogCollisionWarnings,
  getInstanceDesc,
  createWarningFromMsg,
  getInstancesWithCollidingElemID,
  safeJsonStringify,
} from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import {
  Element,
  Values,
  Field,
  InstanceElement,
  ReferenceExpression,
  SaltoError,
  ElemID,
  CORE_ANNOTATIONS,
} from '@salto-io/adapter-api'
import { FilterResult, RemoteFilterCreator } from '../filter'
import { apiName, isInstanceOfCustomObject } from '../transformers/transformer'
import { FIELD_ANNOTATIONS, SALESFORCE } from '../constants'
import { isLookupField, isMasterDetailField, safeApiName } from './utils'
import { DataManagement } from '../fetch_profile/data_management'

const { makeArray } = collections.array
const { isDefined } = lowerdashValues
const { DefaultMap } = collections.map
const { keyByAsync } = collections.asynciterable
const { removeAsync } = promises.array
type RefOrigin = { type: string; id: string; field?: Field }
type MissingRef = {
  origin: RefOrigin
  targetId: string
}
const { awu } = collections.asynciterable

const log = logger(module)

const INTERNAL_ID_SEPARATOR = '$'
const MAX_BREAKDOWN_ELEMENTS = 10

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

const createWarnings = async (
  instancesWithCollidingElemID: InstanceElement[],
  instancesWithEmptyIds: InstanceElement[],
  missingRefs: MissingRef[],
  illegalRefSources: Set<string>,
  dataManagement: DataManagement,
  baseUrl?: string,
): Promise<SaltoError[]> => {
  const createOmittedInstancesWarning = async (
    originTypeName: string,
    missingRefsFromOriginType: MissingRef[],
  ): Promise<SaltoError> => {
    const typesOfMissingRefsTargets: string[] = _(missingRefsFromOriginType)
      .map(missingRef => missingRef.origin.field?.annotations[FIELD_ANNOTATIONS.REFERENCE_TO])
      .filter(isDefined)
      .uniq()
      .value()
    const numMissingInstances = _.uniqBy(missingRefsFromOriginType, missingRef => missingRef.targetId).length
    const header = `${numMissingInstances} records of the ${originTypeName} object were not fetched, along with their child records of the ${typesOfMissingRefsTargets.join(', ')} objects.\n\nHere are the relevant records:`
    const perMissingInstanceMsgs = missingRefs
      .map(missingRef => `${getInstanceDesc(missingRef.origin.id, baseUrl)} relates to ${getInstanceDesc(missingRef.targetId, baseUrl)}`)
      .slice(0, MAX_BREAKDOWN_ELEMENTS)

    const epilogue = `This is most likely because ${originTypeName} has a relationship to ${typesOfMissingRefsTargets.join(', ')}, yet ${typesOfMissingRefsTargets.join(', ')} hasn't been included in your data fetch configuration.

Please follow the instructions here [new intercom article] to resolve this issue. `
    const overflowMsg = numMissingInstances > MAX_BREAKDOWN_ELEMENTS ? ['', `... and ${numMissingInstances - MAX_BREAKDOWN_ELEMENTS} more missing Instances`] : []
    return createWarningFromMsg([
      header,
      '',
      ...perMissingInstanceMsgs,
      ...overflowMsg,
      '',
      epilogue,
    ].join('\n'))
  }


  const collisionWarnings = await getAndLogCollisionWarnings({
    adapterName: SALESFORCE,
    baseUrl,
    instances: instancesWithCollidingElemID,
    configurationName: 'data management',
    getIdFieldsByType: dataManagement.getObjectIdsFields,
    getTypeName: async instance => apiName(await instance.getType(), true),
    idFieldsName: 'saltoIDSettings',
    getInstanceName: instance => apiName(instance),
    docsUrl: 'https://help.salto.io/en/articles/6927217-salto-for-salesforce-cpq-support',
  })
  const instanceWithEmptyIdWarnings = await awu(instancesWithEmptyIds)
    // In case of collisions, there's already a warning on the Element
    .filter(instance => !instancesWithCollidingElemID.includes(instance))
    .map(async instance => {
      const typeName = await safeApiName(await instance.getType()) ?? 'Unknown'
      return createWarningFromMsg(
        [
          `Omitted Instance of type ${typeName} due to empty Salto ID.`,
          `Current Salto ID configuration for ${typeName} is defined as ${safeJsonStringify(dataManagement.getObjectIdsFields(typeName))}`,
          `Instance Service Url: ${getInstanceDesc(await serializeInstanceInternalID(instance), baseUrl)}`,
        ].join('\n')
      )
    })
    .toArray()

  const originTypeToMissingRef = _.groupBy(missingRefs, missingRef => missingRef.origin.type)

  const missingRefsWarnings = await awu(Object.entries(originTypeToMissingRef))
    .map(([originType, missingRefsFromType]) => createOmittedInstancesWarning(originType, missingRefsFromType))
    .toArray()

  const typesOfIllegalRefSources = _.uniq([...illegalRefSources]
    .map(deserializeInternalID)
    .map(source => source.type))

  const illegalOriginsWarnings = illegalRefSources.size === 0 ? [] : [createWarningFromMsg(`Omitted ${illegalRefSources.size} instances due to the previous SaltoID collisions and/or missing instances.
  Types of the omitted instances are: ${typesOfIllegalRefSources.join(', ')}.`)]

  return [
    ...collisionWarnings,
    ...instanceWithEmptyIdWarnings,
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
        if (!_.isEmpty(value)
            && (field?.annotations?.[FIELD_ANNOTATIONS.CREATABLE] || field?.annotations?.[FIELD_ANNOTATIONS.UPDATEABLE])
            && field?.annotations?.[CORE_ANNOTATIONS.HIDDEN_VALUE] !== true) {
          missingRefs.push({
            origin: {
              type: await apiName(await instance.getType(), true),
              id: await apiName(instance),
              field,
            },
            targetId: instance.value[field.name],
          })
        }

        return value
      }
      reverseReferencesMap.get(await serializeInstanceInternalID(refTarget))
        .add(await serializeInstanceInternalID(instance))
      return new ReferenceExpression(refTarget.elemID)
    }

    return await transformValues(
      {
        values: instance.value,
        type: await instance.getType(),
        transformFunc,
        strict: false,
        allowEmpty: true,
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

const filter: RemoteFilterCreator = ({ client, config }) => ({
  name: 'customObjectInstanceReferencesFilter',
  remote: true,
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
    const instancesWithCollidingElemID = getInstancesWithCollidingElemID(customObjectInstances)
    const instancesWithEmptyId = customObjectInstances.filter(instance => instance.elemID.name === ElemID.CONFIG_NAME)
    const missingRefOriginInternalIDs = new Set(
      missingRefs
        .map(missingRef => serializeInternalID(missingRef.origin.type, missingRef.origin.id))
    )
    const instWithDupElemIDInterIDs = new Set(
      await Promise.all(instancesWithCollidingElemID.map(serializeInstanceInternalID))
    )
    const instancesWithEmptyIdInternalIDs = new Set(
      await Promise.all(instancesWithEmptyId.map(serializeInstanceInternalID))
    )
    const illegalRefTargets = new Set(
      [
        ...missingRefOriginInternalIDs, ...instWithDupElemIDInterIDs, ...instancesWithEmptyIdInternalIDs,
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
    return {
      errors: await createWarnings(
        instancesWithCollidingElemID,
        instancesWithEmptyId,
        missingRefs,
        illegalRefSources,
        dataManagement,
        baseUrl?.origin,
      ),
    }
  },
})

export default filter
