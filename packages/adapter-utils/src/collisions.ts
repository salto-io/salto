/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { CORE_ANNOTATIONS, InstanceElement, SaltoError } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { ERROR_MESSAGES } from './errors'
import { inspectValue } from './utils'

const log = logger(module)
const { groupByAsync } = collections.asynciterable

type InstanceDetail = {
  name: string
  serviceUrl?: string | undefined
}

export const groupInstancesByTypeAndElemID = async (
  instances: InstanceElement[],
  getTypeName: (instance: InstanceElement) => Promise<string>,
): Promise<Record<string, Record<string, InstanceElement[]>>> =>
  _.mapValues(await groupByAsync(instances, getTypeName), typeInstances =>
    _.groupBy(typeInstances, instance => instance.elemID.name),
  )

export const createWarningFromMsg = ({
  message,
  detailedMessage,
}: {
  message: string
  detailedMessage: string
}): SaltoError => ({
  message,
  detailedMessage,
  severity: 'Warning',
})

const getInstanceDescWithServiceUrl = (instanceDetail: InstanceDetail, baseUrl?: string): string =>
  baseUrl
    ? `${baseUrl}/${instanceDetail.name}`
    : `Instance with Id - ${instanceDetail.name}${instanceDetail.serviceUrl ? `. View in the service - ${instanceDetail.serviceUrl}` : ''}`

export const getInstanceDesc = (instanceId: string, baseUrl?: string): string =>
  getInstanceDescWithServiceUrl({ name: instanceId }, baseUrl)

export const getInstancesWithCollidingElemID = (instances: InstanceElement[]): InstanceElement[] =>
  Object.values(_.groupBy(instances, instance => instance.elemID.getFullName()))
    .filter(groupedInstances => groupedInstances.length > 1)
    .flat()

const getTextWithLinkToService = ({
  instanceName,
  adapterName,
  url,
}: {
  instanceName: string
  adapterName: string
  url?: string
}): string => (url !== undefined ? `${instanceName} - open in ${adapterName}: ${url}` : instanceName)

const getInstancesWithLinksToService = (instances: InstanceElement[], adapterName: string): string =>
  instances.map(instance =>
    getTextWithLinkToService({
      instanceName: instance.annotations[CORE_ANNOTATIONS.ALIAS] ?? instance.elemID.name,
      adapterName,
      url: instance.annotations[CORE_ANNOTATIONS.SERVICE_URL],
    }),
  ).join(`,
`)

const createWarningMessages = ({
  elemIDtoInstances,
  adapterName,
  addChildrenMessage,
}: {
  elemIDtoInstances: Record<string, InstanceElement[]>
  adapterName: string
  addChildrenMessage?: boolean
}): string[] =>
  Object.entries(elemIDtoInstances).map(
    ([
      elemId,
      collideInstances,
    ]) => `${collideInstances.length} ${adapterName} elements ${addChildrenMessage ? 'and their child elements ' : ''}were not fetched, as they were mapped to a single ID ${elemId}:
${getInstancesWithLinksToService(collideInstances, adapterName)} .

Usually, this happens because of duplicate configuration names in the service. Make sure these element names are unique, and try fetching again.
Learn about additional ways to resolve this issue at https://help.salto.io/en/articles/6927157-salto-id-collisions .`,
  )

export const getCollisionWarnings = ({
  instances,
  adapterName,
  addChildrenMessage,
}: {
  instances: InstanceElement[]
  adapterName: string
  addChildrenMessage?: boolean
}): SaltoError[] => {
  if (instances.length === 0) {
    return []
  }
  const elemIDtoInstances = _.pickBy(
    _.groupBy(instances, instance => instance.elemID.getFullName()),
    collideInstances => collideInstances.length > 1,
  )

  Object.entries(elemIDtoInstances).forEach(([elemID, collideInstances]) => {
    const relevantInstanceValues = collideInstances.map(instance => _.pickBy(instance.value, val => val != null))
    const relevantInstanceValuesStr = relevantInstanceValues.map(instValues => inspectValue(instValues)).join('\n')
    log.debug(`Omitted instances with colliding ElemID ${elemID} with values - 
${relevantInstanceValuesStr}`)
  })

  const warningMessages = createWarningMessages({
    elemIDtoInstances,
    adapterName,
    addChildrenMessage,
  })
  return warningMessages.map(warningMessage =>
    createWarningFromMsg({
      message: ERROR_MESSAGES.ID_COLLISION,
      detailedMessage: warningMessage,
    }),
  )
}
