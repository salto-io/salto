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
import { ElemID, InstanceElement, SaltoError } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { safeJsonStringify, elementExpressionStringifyReplacer } from './utils'

const { groupByAsync } = collections.asynciterable
const log = logger(module)

const MAX_BREAKDOWN_ELEMENTS = 10
const MAX_BREAKDOWN_DETAILS_ELEMENTS = 3

export const groupInstancesByTypeAndElemID = async (
  instances: InstanceElement[],
  getTypeName: (instance: InstanceElement) => Promise<string>,
): Promise<Record<string, Record<string, InstanceElement[]>>> =>
  (_.mapValues(
    await groupByAsync(instances, getTypeName),
    typeInstances => _.groupBy(typeInstances, instance => instance.elemID.name)
  ))


export const createWarningFromMsg = (message: string): SaltoError =>
  ({ message, severity: 'Warning' })

export const getInstanceDesc = (instanceId: string, baseUrl?: string): string =>
  (baseUrl ? `${baseUrl}/${instanceId}` : `Instance with Id - ${instanceId}`)

const getCollisionBreakdownTitle = (collidingInstanceName: string): string => (
  collidingInstanceName === ElemID.CONFIG_NAME
    ? 'Instances with empty name (Due to no values in any of the provided ID fields)'
    : collidingInstanceName
)

export const getInstancesDetailsMsg = (
  instanceIds: string[],
  baseUrl?: string,
  maxBreakdownDetailsElements = MAX_BREAKDOWN_DETAILS_ELEMENTS,
): string => {
  const instancesToPrint = instanceIds.slice(0, maxBreakdownDetailsElements)
  const instancesMsgs = instancesToPrint.map(instanceId => getInstanceDesc(instanceId, baseUrl))
  const overFlowSize = instanceIds.length - maxBreakdownDetailsElements
  const overFlowMsg = overFlowSize > 0 ? [`${overFlowSize} more instances`] : []
  return [
    ...instancesMsgs,
    ...overFlowMsg,
  ].map(msg => `\t* ${msg}`).join('\n')
}

export const getInstancesWithCollidingElemID = (instances: InstanceElement[]): InstanceElement[] =>
  Object
    .values(_.groupBy(
      instances,
      instance => instance.elemID.getFullName(),
    ))
    .filter(groupedInstances => groupedInstances.length > 1)
    .flat()

const logInstancesWithCollidingElemID = async (
  typeToElemIDtoInstances: Record<string, Record<string, InstanceElement[]>>,
  skipLogCollisionStringify?: boolean
): Promise<void> => {
  Object.entries(typeToElemIDtoInstances).forEach(([type, elemIDtoInstances]) => {
    const instancesCount = Object.values(elemIDtoInstances).flat().length
    log.debug(`Omitted ${instancesCount} instances of type ${type} due to Salto ID collisions`)
    Object.entries(elemIDtoInstances).forEach(([elemID, elemIDInstances]) => {
      // SALTO-3059
      if (skipLogCollisionStringify) {
        log.debug(`Omitted instances of type ${type} with colliding ElemID ${elemID}`)
        return
      }
      const relevantInstanceValues = elemIDInstances
        .map(instance => _.pickBy(instance.value, val => val != null))
      const relevantInstanceValuesStr = relevantInstanceValues
        .map(instValues => safeJsonStringify(instValues, elementExpressionStringifyReplacer, 2)).join('\n')
      log.debug(`Omitted instances of type ${type} with colliding ElemID ${elemID} with values - 
  ${relevantInstanceValuesStr}`)
    })
  })
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
  skipLogCollisionStringify,
  docsUrl,
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
  skipLogCollisionStringify?: boolean
  docsUrl?: string
}): Promise<SaltoError[]> => {
  const typeToElemIDtoInstances = await groupInstancesByTypeAndElemID(instances, getTypeName)
  await logInstancesWithCollidingElemID(typeToElemIDtoInstances, skipLogCollisionStringify)
  return Promise.all(Object.entries(typeToElemIDtoInstances)
    .map(async ([type, elemIDtoInstances]) => {
      const numInstances = Object.values(elemIDtoInstances)
        .flat().length
      const header = `Omitted ${numInstances} instances of ${type} due to Salto ID collisions.
Current Salto ID configuration for ${type} is defined as [${getIdFieldsByType(type).join(', ')}].`

      const collisionsHeader = 'Breakdown per colliding Salto ID:'
      const collisionsToDisplay = Object.entries(elemIDtoInstances).slice(0, maxBreakdownElements)
      const collisionMsgs = await Promise.all(collisionsToDisplay
        .map(async ([elemID, collisionInstances]) => `- ${getCollisionBreakdownTitle(elemID)}:
${getInstancesDetailsMsg(await Promise.all(collisionInstances.map(getInstanceName)), baseUrl, maxBreakdownDetailsElements)}`))
      const epilogue = `To resolve these collisions please take one of the following actions and fetch again:
\t1. Change ${type}'s ${idFieldsName} to include all fields that uniquely identify the type's instances.
\t2. Delete duplicate instances from your ${adapterName} account.

Alternatively, you can exclude ${type} from the ${configurationName} configuration in ${adapterName}.nacl`
      const elemIDCount = Object.keys(elemIDtoInstances).length
      const overflowMsg = elemIDCount > maxBreakdownElements ? ['', `And ${elemIDCount - maxBreakdownElements} more colliding Salto IDs`] : []
      const linkToDocsMsg = docsUrl ? ['', `Learn more at: ${docsUrl}`] : []
      return createWarningFromMsg([
        header,
        '',
        collisionsHeader,
        ...collisionMsgs,
        ...overflowMsg,
        '',
        epilogue,
        ...linkToDocsMsg,
      ].join('\n'))
    }))
}
