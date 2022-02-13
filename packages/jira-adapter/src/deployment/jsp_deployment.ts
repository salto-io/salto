/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { AdditionChange, Change, DeployResult, getChangeData, InstanceElement, isAdditionChange, isInstanceChange, isModificationChange, isRemovalChange, Values } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { resolveValues, safeJsonStringify } from '@salto-io/adapter-utils'
import { deployment } from '@salto-io/adapter-components'
import { collections } from '@salto-io/lowerdash'
import { JSP_API_HEADERS, PRIVATE_API_HEADERS } from '../constants'
import { deployChanges } from './deployment'
import JiraClient from '../client/client'
import { getLookUpName } from '../reference_mapping'

const { awu } = collections.asynciterable

const log = logger(module)

export type DeployUrls = {
  addUrl: string
  modifyUrl: string
  removeUrl?: string
  queryUrl: string
}

const deployChange = async (
  change: Change<InstanceElement>,
  client: JiraClient,
  urls: DeployUrls
): Promise<void> => {
  const instance = await deployment.filterUndeployableValues(
    await resolveValues(getChangeData(change), getLookUpName),
    change.action,
  )

  if (isAdditionChange(change)) {
    await client.post({
      url: urls.addUrl,
      headers: JSP_API_HEADERS,
      data: new URLSearchParams(instance.value),
    })
  }

  if (isModificationChange(change)) {
    await client.post({
      url: urls.modifyUrl,
      headers: JSP_API_HEADERS,
      data: new URLSearchParams(instance.value),
    })
  }

  if (isRemovalChange(change)) {
    if (urls.removeUrl === undefined) {
      throw new Error(`Remove ${instance.elemID.getFullName()} is not supported`)
    }
    await client.post({
      url: urls.removeUrl,
      headers: JSP_API_HEADERS,
      data: new URLSearchParams({
        ...instance.value,
        confirm: 'true',
      }),
    })
  }
}

const queryServiceValues = async (client: JiraClient, urls: DeployUrls): Promise<Values[]> => {
  const response = await client.getSinglePage({
    url: urls.queryUrl,
    headers: PRIVATE_API_HEADERS,
  })
  if (!Array.isArray(response.data)) {
    throw new Error(`Expected array of values in response, got ${safeJsonStringify(response.data)}`)
  }
  return response.data
}

const addIdsToResults = async (
  appliedChanges: AdditionChange<InstanceElement>[],
  serviceValues: Values[],
): Promise<void> => {
  const nameToId = Object.fromEntries(
    serviceValues.map(values => [values.name, values.id])
  )

  appliedChanges.forEach(change => {
    getChangeData(change).value.id = nameToId[getChangeData(change).value.name]
  })
}

type ServiceValuesTransformer = (serviceValues: Values, currentInstance: InstanceElement) => Values

const verifyDeployment = async (
  serviceValues: Values[],
  deployResult: DeployResult,
  serviceValuesTransformer: ServiceValuesTransformer
): Promise<void> => {
  const idToValues = _.keyBy(serviceValues, value => value.id)

  const deployedInstances = await awu(deployResult.appliedChanges)
    .filter(isInstanceChange)
    .map(change => deployment.filterUndeployableValues(getChangeData(change), change.action))
    .map(instance => resolveValues(instance, getLookUpName))
    .toArray()

  const invalidChanges = _.remove(
    deployResult.appliedChanges,
    (change, index) => {
      const instance = deployedInstances[index]

      if (instance.value.id === undefined) {
        log.warn(`Failed to deploy ${instance.elemID.getFullName()}, id is undefined`)
        return true
      }

      if (isRemovalChange(change)) {
        if (instance.value.id in idToValues) {
          log.warn(`Failed to deploy ${instance.elemID.getFullName()}, id is still exist in the service`)
          return true
        }
        return false
      }

      const serviceValue = serviceValuesTransformer(idToValues[instance.value.id], instance)

      if (!_.isMatch(serviceValue, instance.value)) {
        log.warn(`Failed to deploy ${instance.elemID.getFullName()}, the deployment values  ${safeJsonStringify(instance.value)} do not match the service values ${safeJsonStringify(serviceValue)}`)
        return true
      }

      return false
    }
  )

  deployResult.errors = [
    ...deployResult.errors,
    ...invalidChanges.map(change => new Error(`Failed to deploy ${getChangeData(change).elemID.getFullName()}`)),
  ]
}

export const deployWithJspEndpoints = async (
  changes: Change<InstanceElement>[],
  client: JiraClient,
  urls: DeployUrls,
  serviceValuesTransformer: ServiceValuesTransformer = _.identity
): Promise<DeployResult> => {
  const deployResult = await deployChanges(
    changes,
    change => deployChange(
      change,
      client,
      urls,
    )
  )

  if (deployResult.appliedChanges.length !== 0) {
    try {
      const serviceValues = await queryServiceValues(client, urls)
      await addIdsToResults(
        deployResult.appliedChanges.filter(isInstanceChange).filter(isAdditionChange),
        serviceValues
      )
      await verifyDeployment(serviceValues, deployResult, serviceValuesTransformer)
    } catch (err) {
      log.error(`Failed to query service values: ${err.message}`)
      deployResult.errors = [
        ...deployResult.errors,
        ...deployResult.appliedChanges.map(change => new Error(`Failed to deploy ${getChangeData(change).elemID.getFullName()}`)),
      ]
      deployResult.appliedChanges = []
    }
  }

  return deployResult
}
