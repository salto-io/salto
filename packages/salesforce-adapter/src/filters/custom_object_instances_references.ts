/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
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
  inspectValue,
} from '@salto-io/adapter-utils'
import { references } from '@salto-io/adapter-components'
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
  isObjectType,
  ObjectType,
  isInstanceElement,
} from '@salto-io/adapter-api'
import { FilterResult, RemoteFilterCreator } from '../filter'
import { apiName, isInstanceOfCustomObject } from '../transformers/transformer'
import { FIELD_ANNOTATIONS, KEY_PREFIX, KEY_PREFIX_LENGTH, SALESFORCE } from '../constants'
import {
  apiNameSync,
  buildElementsSourceForFetch,
  instanceInternalId,
  isInstanceOfCustomObjectSync,
  isReadOnlyField,
  isReferenceField,
  referenceFieldTargetTypes,
  safeApiName,
} from './utils'
import { DataManagement } from '../types'

const { awu } = collections.asynciterable
const { isDefined } = lowerdashValues
const { DefaultMap } = collections.map
const { keyByAsync } = collections.asynciterable
const { removeAsync } = promises.array
const { mapValuesAsync } = promises.object
const { createMissingValueReference } = references
type RefOrigin = { type: string; id: string; field?: Field }
type MissingRef = {
  origin: RefOrigin
  targetId: string
}

const log = logger(module)

const INTERNAL_ID_SEPARATOR = '$'
const MAX_BREAKDOWN_ELEMENTS = 10

const serializeInternalID = (typeName: string, id: string): string => `${typeName}${INTERNAL_ID_SEPARATOR}${id}`

const serializeInstanceInternalID = async (instance: InstanceElement): Promise<string> =>
  serializeInternalID(await apiName(await instance.getType(), true), instanceInternalId(instance))

const deserializeInternalID = (internalID: string): RefOrigin => {
  const splitInternalID = internalID.split(INTERNAL_ID_SEPARATOR)
  if (splitInternalID.length !== 2) {
    throw Error(`Invalid Custom Object Instance internalID - ${internalID}`)
  }
  return {
    type: splitInternalID[0],
    id: splitInternalID[1],
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
      .flatMap(
        (missingRef: MissingRef): (string | ReferenceExpression)[] =>
          missingRef.origin.field?.annotations[FIELD_ANNOTATIONS.REFERENCE_TO],
      )
      .filter(isDefined)
      .map((referenceTo: string | ReferenceExpression): string =>
        // Ideally we would use the API name, but we don't have it here and reconstructing it is overkill for a warning
        _.isString(referenceTo) ? referenceTo : referenceTo.elemID.getFullName(),
      )
      .sortBy()
      .sortedUniq()
      .value()
    const numMissingInstances = _.uniqBy(missingRefsFromOriginType, missingRef => missingRef.targetId).length
    const header = `Your Salto environment is configured to manage records of the ${originTypeName} object. ${numMissingInstances} ${originTypeName} records were not fetched because they have a lookup relationship to one of the following objects:`
    const perTargetTypeMsgs = typesOfMissingRefsTargets.join('\n')
    const perInstancesPreamble = 'and these objects are not part of your Salto configuration.\n\nHere are the records:'
    const perMissingInstanceMsgs = missingRefs
      .filter(missingRef => missingRef.origin.type === originTypeName)
      .map(
        missingRef =>
          `${getInstanceDesc(missingRef.origin.id, baseUrl)} relates to ${getInstanceDesc(missingRef.targetId, baseUrl)}`,
      )
      .slice(0, MAX_BREAKDOWN_ELEMENTS)
      .sort() // this effectively sorts by origin instance ID

    const epilogue =
      'To resolve this issue, follow the steps outlined here: https://help.salto.io/en/articles/8283155-data-records-were-not-fetched'
    const overflowMsg =
      numMissingInstances > MAX_BREAKDOWN_ELEMENTS
        ? ['', `... and ${numMissingInstances - MAX_BREAKDOWN_ELEMENTS} more missing records`]
        : []
    const message = [
      header,
      '',
      perTargetTypeMsgs,
      '',
      perInstancesPreamble,
      '',
      ...perMissingInstanceMsgs,
      ...overflowMsg,
      '',
      epilogue,
    ].join('\n')
    return createWarningFromMsg({
      message,
      detailedMessage: message,
    })
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
      const typeName = (await safeApiName(await instance.getType())) ?? 'Unknown'
      const message = [
        `Omitted Instance of type ${typeName} due to empty Salto ID.`,
        `Current Salto ID configuration for ${typeName} is defined as ${safeJsonStringify(dataManagement.getObjectIdsFields(typeName))}`,
        `Instance Service Url: ${getInstanceDesc(await serializeInstanceInternalID(instance), baseUrl)}`,
      ].join('\n')
      return createWarningFromMsg({
        message,
        detailedMessage: message,
      })
    })
    .toArray()

  const originTypeToMissingRef = _.groupBy(missingRefs, missingRef => missingRef.origin.type)

  const missingRefsWarnings = await awu(Object.entries(originTypeToMissingRef))
    .map(([originType, missingRefsFromType]) => createOmittedInstancesWarning(originType, missingRefsFromType))
    .toArray()

  const typesOfIllegalRefSources = _.uniq([...illegalRefSources].map(deserializeInternalID).map(source => source.type))
  const message = `Omitted ${illegalRefSources.size} instances due to the previous SaltoID collisions and/or missing instances.
  Types of the omitted instances are: ${typesOfIllegalRefSources.join(', ')}.`
  const illegalOriginsWarnings =
    illegalRefSources.size === 0 ? [] : [createWarningFromMsg({ message, detailedMessage: message })]

  return [...collisionWarnings, ...instanceWithEmptyIdWarnings, ...missingRefsWarnings, ...illegalOriginsWarnings]
}

const replaceLookupsWithRefsAndCreateRefMap = async (
  referenceSources: InstanceElement[],
  internalIdToReferenceTarget: Record<string, InstanceElement>,
  internalToTypeName: (internalId: string) => string,
  dataManagement: DataManagement,
): Promise<{
  reverseReferencesMap: collections.map.DefaultMap<string, Set<string>>
  missingRefs: MissingRef[]
}> => {
  const reverseReferencesMap = new DefaultMap<string, Set<string>>(() => new Set())
  const missingRefs: MissingRef[] = []
  const fieldsWithUnknownTargetType = new DefaultMap<string, Set<string>>(() => new Set())
  const replaceLookups = async (instance: InstanceElement): Promise<Values> => {
    const transformFunc: TransformFunc = async ({ value, field }) => {
      if (!isReferenceField(field) || !_.isString(value)) {
        return value
      }
      const refTo = referenceFieldTargetTypes(field)

      const refTarget = refTo
        .map(targetTypeName => internalIdToReferenceTarget[serializeInternalID(targetTypeName, value)])
        .filter(isDefined)
        .pop()

      if (refTarget === undefined) {
        if (_.isEmpty(value)) {
          return value
        }
        if (isReadOnlyField(field) || field?.annotations?.[CORE_ANNOTATIONS.HIDDEN_VALUE] === true) {
          return value
        }

        const targetTypeName = refTo.length === 1 ? refTo[0] : internalToTypeName(value)

        if (targetTypeName === undefined) {
          fieldsWithUnknownTargetType.get(field.elemID.getFullName()).add(value)
        }

        const brokenRefBehavior = dataManagement.brokenReferenceBehaviorForTargetType(targetTypeName)
        switch (brokenRefBehavior) {
          case 'InternalId': {
            return value
          }
          case 'BrokenReference': {
            return createMissingValueReference(new ElemID(SALESFORCE, targetTypeName, 'instance'), value)
          }
          case 'ExcludeInstance': {
            missingRefs.push({
              origin: {
                type: await apiName(await instance.getType(), true),
                id: await apiName(instance),
                field,
              },
              targetId: instance.value[field.name],
            })
            return value
          }
          default: {
            throw new Error('Unrecognized broken refs behavior. Is the configuration valid?')
          }
        }
      }

      reverseReferencesMap
        .get(await serializeInstanceInternalID(refTarget))
        .add(await serializeInstanceInternalID(instance))
      return new ReferenceExpression(refTarget.elemID)
    }

    return (
      (await transformValues({
        values: instance.value,
        type: await instance.getType(),
        transformFunc,
        strict: false,
        allowEmptyArrays: true,
        allowEmptyObjects: true,
      })) ?? instance.value
    )
  }

  if (fieldsWithUnknownTargetType.size > 0) {
    log.warn(
      'The following fields have multiple %s annotations and contained internal IDs with an unknown key prefix. The default broken references behavior was used for them.',
      FIELD_ANNOTATIONS.REFERENCE_TO,
    )
    fieldsWithUnknownTargetType.forEach((internalIds, fieldElemId) => {
      log.warn('Field %s: %o', fieldElemId, internalIds)
    })
  }

  await awu(referenceSources).forEach(async (instance, index) => {
    instance.value = await replaceLookups(instance)
    if (index > 0 && index % 500 === 0) {
      log.debug(`Replaced lookup with references for ${index} instances`)
    }
  })

  return { reverseReferencesMap, missingRefs }
}

const replaceLookupsWithRefsAndCreateRefMapV2 = async ({
  referenceSources,
  internalIdToReferenceTarget,
  internalToTypeName,
  dataManagement,
  instancesWithCollidingElemID,
  instancesWithEmptyId,
}: {
  referenceSources: InstanceElement[]
  internalIdToReferenceTarget: Record<string, InstanceElement>
  internalToTypeName: (internalId: string) => string
  dataManagement: DataManagement
  instancesWithCollidingElemID: InstanceElement[]
  instancesWithEmptyId: InstanceElement[]
}): Promise<{
  reverseReferencesMap: collections.map.DefaultMap<string, Set<string>>
  missingRefs: MissingRef[]
}> => {
  const invalidInstancesIds = new Set(
    instancesWithCollidingElemID.concat(instancesWithEmptyId).map(instance => apiNameSync(instance)),
  )
  const reverseReferencesMap = new DefaultMap<string, Set<string>>(() => new Set())
  const missingRefs: MissingRef[] = []
  const fieldsWithUnknownTargetType = new DefaultMap<string, Set<string>>(() => new Set())
  const replaceLookups = async (instance: InstanceElement): Promise<Values> => {
    const transformFunc: TransformFunc = async ({ value, field }) => {
      if (!isReferenceField(field) || !_.isString(value)) {
        return value
      }
      const refTo = referenceFieldTargetTypes(field)

      const refTarget = refTo
        .map(targetTypeName => internalIdToReferenceTarget[serializeInternalID(targetTypeName, value)])
        .filter(isDefined)
        .pop()

      const targetTypeName = refTo.length === 1 ? refTo[0] : internalToTypeName(value)
      const brokenRefBehavior = dataManagement.brokenReferenceBehaviorForTargetType(targetTypeName)
      if (refTarget === undefined || invalidInstancesIds.has(apiNameSync(refTarget))) {
        if (_.isEmpty(value)) {
          return value
        }
        if (isReadOnlyField(field) || field?.annotations?.[CORE_ANNOTATIONS.HIDDEN_VALUE] === true) {
          return value
        }
        if (targetTypeName === undefined) {
          fieldsWithUnknownTargetType.get(field.elemID.getFullName()).add(value)
        }

        switch (brokenRefBehavior) {
          case 'InternalId': {
            return value
          }
          case 'BrokenReference': {
            return createMissingValueReference(new ElemID(SALESFORCE, targetTypeName, 'instance'), value)
          }
          case 'ExcludeInstance': {
            missingRefs.push({
              origin: {
                type: await apiName(await instance.getType(), true),
                id: await apiName(instance),
                field,
              },
              targetId: instance.value[field.name],
            })
            return value
          }
          default: {
            throw new Error('Unrecognized broken refs behavior. Is the configuration valid?')
          }
        }
      }

      if (brokenRefBehavior === 'ExcludeInstance') {
        reverseReferencesMap
          .get(await serializeInstanceInternalID(refTarget))
          .add(await serializeInstanceInternalID(instance))
      }
      return new ReferenceExpression(refTarget.elemID)
    }

    return (
      (await transformValues({
        values: instance.value,
        type: await instance.getType(),
        transformFunc,
        strict: false,
        allowEmptyArrays: true,
        allowEmptyObjects: true,
      })) ?? instance.value
    )
  }

  if (fieldsWithUnknownTargetType.size > 0) {
    log.warn(
      'The following fields have multiple %s annotations and contained internal IDs with an unknown key prefix. The default broken references behavior was used for them.',
      FIELD_ANNOTATIONS.REFERENCE_TO,
    )
    fieldsWithUnknownTargetType.forEach((internalIds, fieldElemId) => {
      log.warn('Field %s: %o', fieldElemId, internalIds)
    })
  }

  await awu(referenceSources).forEach(async (instance, index) => {
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
  const illegalRefTargets = [...initialIllegalRefTargets]
  while (illegalRefTargets.length > 0) {
    const currentBrokenRef = illegalRefTargets.pop()
    if (currentBrokenRef === undefined) {
      break
    }
    const refsToCurrentIllegal = [...reverseRefsMap.get(currentBrokenRef)]
    refsToCurrentIllegal
      .filter(r => !illegalRefSources.has(r))
      .forEach(newIllegalRefFrom => {
        illegalRefTargets.push(newIllegalRefFrom)
        illegalRefSources.add(newIllegalRefFrom)
      })
  }
  return illegalRefSources
}

const buildCustomObjectPrefixKeyMap = async (elements: Element[]): Promise<Record<string, string>> => {
  const objectTypes = elements.filter(isObjectType)
  const objectTypesWithKeyPrefix = objectTypes.filter(objectType => isDefined(objectType.annotations[KEY_PREFIX]))

  log.debug('%d/%d object types have a key prefix', objectTypesWithKeyPrefix.length, objectTypes.length)

  const typeMap = _.keyBy(objectTypesWithKeyPrefix, objectType => objectType.annotations[KEY_PREFIX] as string)
  return mapValuesAsync(typeMap, async (objectType: ObjectType) => apiName(objectType))
}

const filter: RemoteFilterCreator = ({ client, config }) => ({
  name: 'customObjectInstanceReferencesFilter',
  remote: true,
  onFetch: async (elements: Element[]): Promise<FilterResult> => {
    const { dataManagement } = config.fetchProfile
    if (dataManagement === undefined) {
      return {}
    }
    const fetchedInstances = elements.filter(isInstanceElement)
    const fetchedCustomObjectInstances = fetchedInstances.filter(isInstanceOfCustomObjectSync)
    const instancesWithCollidingElemID = getInstancesWithCollidingElemID(fetchedInstances)
    const instancesWithEmptyId = fetchedCustomObjectInstances.filter(
      instance => instance.elemID.name === ElemID.CONFIG_NAME,
    )
    // In the partial fetch case, a fetched element may reference an element that was not fetched but exists in the workspace
    const elementsSource = buildElementsSourceForFetch(elements, config)
    const allElements = await awu(await elementsSource.getAll()).toArray()
    const allInstances = allElements.filter(isInstanceElement)
    const internalToInstance = await keyByAsync(allInstances, serializeInstanceInternalID)
    const internalIdPrefixToType = await buildCustomObjectPrefixKeyMap(allElements)
    const { reverseReferencesMap, missingRefs } = config.fetchProfile.isFeatureEnabled('improvedDataBrokenReferences')
      ? await replaceLookupsWithRefsAndCreateRefMapV2({
          referenceSources: fetchedCustomObjectInstances,
          internalIdToReferenceTarget: internalToInstance,
          internalToTypeName: (internalId: string): string =>
            internalIdPrefixToType[internalId.slice(0, KEY_PREFIX_LENGTH)],
          dataManagement,
          instancesWithCollidingElemID,
          instancesWithEmptyId,
        })
      : await replaceLookupsWithRefsAndCreateRefMap(
          fetchedCustomObjectInstances,
          internalToInstance,
          internalId => internalIdPrefixToType[internalId.slice(0, KEY_PREFIX_LENGTH)],
          dataManagement,
        )
    const missingRefOriginInternalIDs = new Set(
      missingRefs.map(missingRef => serializeInternalID(missingRef.origin.type, missingRef.origin.id)),
    )
    const instWithDupElemIDInterIDs = new Set(
      await Promise.all(instancesWithCollidingElemID.map(serializeInstanceInternalID)),
    )
    const instancesWithEmptyIdInternalIDs = new Set(
      await Promise.all(instancesWithEmptyId.map(serializeInstanceInternalID)),
    )
    const illegalRefTargets = new Set([
      ...missingRefOriginInternalIDs,
      ...instWithDupElemIDInterIDs,
      ...instancesWithEmptyIdInternalIDs,
    ])
    const illegalRefSources = getIllegalRefSources(illegalRefTargets, reverseReferencesMap)
    const invalidInstances = new Set([...illegalRefSources, ...illegalRefTargets])
    log.trace('invalidInstances: %s', inspectValue(invalidInstances))
    log.trace('missingRefs: %s', inspectValue(missingRefOriginInternalIDs))
    log.trace('instancesWithCollidingElemID: %s', inspectValue(instWithDupElemIDInterIDs))
    log.trace('instancesWithEmptyId: %s', inspectValue(instancesWithEmptyIdInternalIDs))
    log.trace('reverseReferencesMap: %s', inspectValue(reverseReferencesMap))

    await removeAsync(
      elements,
      async element =>
        (await isInstanceOfCustomObject(element)) &&
        invalidInstances.has(await serializeInstanceInternalID(element as InstanceElement)),
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
