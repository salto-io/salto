/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { CORE_ANNOTATIONS, ElemID, InstanceElement, SaltoError } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { inspectValue } from './utils'

const { groupByAsync } = collections.asynciterable
const log = logger(module)

const MAX_BREAKDOWN_ELEMENTS = 10
const MAX_BREAKDOWN_DETAILS_ELEMENTS = 3

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

const getCollisionBreakdownTitle = (collidingInstanceName: string): string =>
  collidingInstanceName === ElemID.CONFIG_NAME
    ? 'Instances with empty name (Due to no values in any of the provided ID fields)'
    : collidingInstanceName

const getInstancesDetailsMsg = (
  instanceDetails: InstanceDetail[],
  baseUrl?: string,
  maxBreakdownDetailsElements = MAX_BREAKDOWN_DETAILS_ELEMENTS,
): string => {
  const instancesToPrint = instanceDetails.slice(0, maxBreakdownDetailsElements)
  const instancesMsgs = instancesToPrint.map(instanceDetail => getInstanceDescWithServiceUrl(instanceDetail, baseUrl))
  const overFlowSize = instanceDetails.length - maxBreakdownDetailsElements
  const overFlowMsg = overFlowSize > 0 ? [`${overFlowSize} more instances`] : []
  return [...instancesMsgs, ...overFlowMsg].map(msg => `\t* ${msg}`).join('\n')
}

export const getInstancesWithCollidingElemID = (instances: InstanceElement[]): InstanceElement[] =>
  Object.values(_.groupBy(instances, instance => instance.elemID.getFullName()))
    .filter(groupedInstances => groupedInstances.length > 1)
    .flat()

const logInstancesWithCollidingElemID = async (
  typeToElemIDtoInstances: Record<string, Record<string, InstanceElement[]>>,
): Promise<void> => {
  Object.entries(typeToElemIDtoInstances).forEach(([type, elemIDtoInstances]) => {
    const instancesCount = Object.values(elemIDtoInstances).flat().length
    log.debug(`Omitted ${instancesCount} instances of type ${type} due to Salto ID collisions`)
    Object.entries(elemIDtoInstances).forEach(([elemID, elemIDInstances]) => {
      const relevantInstanceValues = elemIDInstances.map(instance => _.pickBy(instance.value, val => val != null))
      const relevantInstanceValuesStr = relevantInstanceValues.map(instValues => inspectValue(instValues)).join('\n')
      log.debug(`Omitted instances of type ${type} with colliding ElemID ${elemID} with values - 
  ${relevantInstanceValuesStr}`)
    })
  })
}

const getCollisionMessages = async ({
  elemIDtoInstances,
  getInstanceName,
  baseUrl,
  maxBreakdownElements,
  maxBreakdownDetailsElements,
}: {
  elemIDtoInstances: Record<string, InstanceElement[]>
  getInstanceName: (instance: InstanceElement) => Promise<string>
  baseUrl?: string
  maxBreakdownElements: number
  maxBreakdownDetailsElements: number
}): Promise<string[]> => {
  const collisionsToDisplay = Object.entries(elemIDtoInstances).slice(0, maxBreakdownElements)
  const collisionMessages = await Promise.all(
    collisionsToDisplay.map(async ([elemID, collisionInstances]) => {
      const instanceDetails = await Promise.all(
        collisionInstances.map(async instance => ({
          name: await getInstanceName(instance),
          serviceUrl:
            typeof instance.annotations[CORE_ANNOTATIONS.SERVICE_URL] === 'string'
              ? instance.annotations[CORE_ANNOTATIONS.SERVICE_URL]
              : undefined,
        })),
      )
      return `- ${getCollisionBreakdownTitle(elemID)}:
${getInstancesDetailsMsg(instanceDetails, baseUrl, maxBreakdownDetailsElements)}`
    }),
  )
  return collisionMessages
}

const createMarkdownLinkOrText = ({ text, url }: { text: string; url?: string }): string =>
  url !== undefined ? `[${text}](${url})` : text

const getInstancesMarkdownLinks = (instances: InstanceElement[]): string =>
  instances
    .map(instance =>
      createMarkdownLinkOrText({
        text: instance.annotations[CORE_ANNOTATIONS.ALIAS] ?? instance.elemID.name,
        url: instance.annotations[CORE_ANNOTATIONS.SERVICE_URL],
      }),
    )
    .join(', ')

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
${getInstancesMarkdownLinks(collideInstances)}

Usually, this happens because of duplicate configuration names in the service. Make sure these element names are unique, and try fetching again.
${createMarkdownLinkOrText({ text: 'Learn about additional ways to resolve this issue', url: 'https://help.salto.io/en/articles/6927157-salto-id-collisions' })}`,
  )

// after SALTO-7088 is done, this function will replace getAndLogCollisionWarnings
export const getCollisionWarnings = ({
  instances,
  addChildrenMessage,
}: {
  instances: InstanceElement[]
  addChildrenMessage?: boolean
}): SaltoError[] => {
  if (instances.length === 0) {
    return []
  }
  const adapterName = instances[0].elemID.adapter
  const elemIDtoInstances = _.pickBy(
    _.groupBy(instances, instance => instance.elemID.getFullName()),
    collideInstances => collideInstances.length > 1,
  )
  const warningMessages = createWarningMessages({
    elemIDtoInstances,
    adapterName,
    addChildrenMessage,
  })
  return warningMessages.map(warningMessage =>
    createWarningFromMsg({
      message: 'Some elements were not fetched due to Salto ID collisions',
      detailedMessage: warningMessage,
    }),
  )
}

export const getAndLogCollisionWarnings = async ({
  instances,
  getTypeName,
  getInstanceName,
  getIdFieldsByType,
  adapterName,
  configurationName,
  idFieldsName,
  maxBreakdownElements = MAX_BREAKDOWN_ELEMENTS,
  maxBreakdownDetailsElements = MAX_BREAKDOWN_DETAILS_ELEMENTS,
  baseUrl,
  docsUrl,
  addChildrenMessage,
}: {
  instances: InstanceElement[]
  getTypeName: (instance: InstanceElement) => Promise<string>
  getInstanceName: (instance: InstanceElement) => Promise<string>
  getIdFieldsByType: (type: string) => string[]
  adapterName: string
  configurationName: string
  idFieldsName: string
  maxBreakdownElements?: number
  maxBreakdownDetailsElements?: number
  baseUrl?: string
  docsUrl?: string
  addChildrenMessage?: boolean
}): Promise<SaltoError[]> => {
  const typeToElemIDtoInstances = await groupInstancesByTypeAndElemID(instances, getTypeName)
  await logInstancesWithCollidingElemID(typeToElemIDtoInstances)
  return Promise.all(
    Object.entries(typeToElemIDtoInstances).map(async ([type, elemIDtoInstances]) => {
      const childMessage = addChildrenMessage === true ? 'and all their child instances ' : ''
      const numInstances = Object.values(elemIDtoInstances).flat().length
      const header = `Omitted ${numInstances} instances ${childMessage}of ${type} due to Salto ID collisions.
Current Salto ID configuration for ${type} is defined as [${getIdFieldsByType(type).join(', ')}].`

      const collisionsHeader = 'Breakdown per colliding Salto ID:'
      const collisionMessages = await getCollisionMessages({
        elemIDtoInstances,
        getInstanceName,
        baseUrl,
        maxBreakdownElements,
        maxBreakdownDetailsElements,
      })
      const epilogue = `To resolve these collisions please take one of the following actions and fetch again:
\t1. Change ${type}'s ${idFieldsName} to include all fields that uniquely identify the type's instances.
\t2. Delete duplicate instances from your ${adapterName} account.

Alternatively, you can exclude ${type} from the ${configurationName} configuration in ${adapterName}.nacl`
      const elemIDCount = Object.keys(elemIDtoInstances).length
      const overflowMsg =
        elemIDCount > maxBreakdownElements
          ? ['', `And ${elemIDCount - maxBreakdownElements} more colliding Salto IDs`]
          : []
      const linkToDocsMsg = docsUrl ? ['', `Learn more at: ${docsUrl}`] : []
      const message = [
        header,
        '',
        collisionsHeader,
        ...collisionMessages,
        ...overflowMsg,
        '',
        epilogue,
        ...linkToDocsMsg,
      ].join('\n')

      return createWarningFromMsg({
        message,
        detailedMessage: message,
      })
    }),
  )
}
