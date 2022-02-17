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
import { deployChanges } from './standard_deployment'
import JiraClient from '../client/client'
import { getLookUpName } from '../reference_mapping'
import { JspUrls } from '../config'

const { awu } = collections.asynciterable

const log = logger(module)

type NameIdObject = {
  name: unknown
  id: unknown
}

const deployChange = async (
  change: Change<InstanceElement>,
  client: JiraClient,
  urls: JspUrls
): Promise<void> => {
  const instance = await deployment.filterUndeployableValues(
    await resolveValues(getChangeData(change), getLookUpName),
    change.action,
  )

  if (isAdditionChange(change)) {
    await client.jspPost({
      url: urls.add,
      data: instance.value,
    })
  }

  if (isModificationChange(change)) {
    await client.jspPost({
      url: urls.modify,
      data: instance.value,
    })
  }

  if (isRemovalChange(change)) {
    if (urls.remove === undefined) {
      throw new Error(`Remove ${instance.elemID.getFullName()} is not supported`)
    }
    await client.jspPost({
      url: urls.remove,
      data: {
        ...instance.value,
        confirm: 'true',
      },
    })
  }
}

const isNameIdObject = (obj: unknown): obj is NameIdObject =>
  typeof obj === 'object' && obj !== null && 'name' in obj && 'id' in obj

const queryServiceValues = async (client: JiraClient, urls: JspUrls)
: Promise<NameIdObject[]> => {
  const response = await client.getPrivate({
    url: urls.query,
  })
  if (!Array.isArray(response.data)) {
    throw new Error(`Expected array of values in response, got ${safeJsonStringify(response.data)}`)
  }
  return response.data.filter((obj): obj is NameIdObject => {
    if (!isNameIdObject(obj)) {
      log.warn(`Received unexpected response ${safeJsonStringify(obj)} from query ${urls.query}`)
      return false
    }
    return true
  })
}

const addIdsToResults = async (
  appliedChanges: AdditionChange<InstanceElement>[],
  serviceValues: NameIdObject[],
): Promise<void> => {
  const nameToId = Object.fromEntries(
    serviceValues.map(value => [value.name, value.id])
  )

  appliedChanges.forEach(change => {
    getChangeData(change).value.id = nameToId[getChangeData(change).value.name]
  })
}

type ServiceValuesTransformer = (serviceValues: Values, currentInstance: InstanceElement) => Values

const verifyDeployment = async (
  serviceValues: NameIdObject[],
  deployResult: DeployResult,
  serviceValuesTransformer: ServiceValuesTransformer
): Promise<void> => {
  const idToValues = _.keyBy(serviceValues, value => value.id)

  const deployedInstances = _.keyBy(
    await awu(deployResult.appliedChanges)
      .filter(isInstanceChange)
      .map(change => deployment.filterUndeployableValues(getChangeData(change), change.action))
      .map(instance => resolveValues(instance, getLookUpName))
      .toArray(),
    instance => instance.elemID.getFullName()
  )

  const invalidChanges = _.remove(
    deployResult.appliedChanges,
    change => {
      const instance = deployedInstances[getChangeData(change).elemID.getFullName()]

      if (instance === undefined) {
        log.warn(`Failed to deploy ${getChangeData(change).elemID.getFullName()}, not an instance`)
        return true
      }

      if (instance.value.id === undefined) {
        log.warn(`Failed to deploy ${instance.elemID.getFullName()}, id is undefined`)
        return true
      }

      if (isRemovalChange(change)) {
        if (instance.value.id in idToValues) {
          log.warn(`Failed to remove ${instance.elemID.getFullName()}, id still exists in the service`)
          return true
        }
        return false
      }

      const serviceValue = serviceValuesTransformer(
        idToValues[instance.value.id] as Values,
        instance,
      )

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

/**
 * Deploy changes by sending post request to JSP pages in Jira
 * Because these pages does not return an indication of success or failure,
 * we need to pass a query url to check if the change was deployed
 *
 * This won't work with oauth creds
 */
export const deployWithJspEndpoints = async ({
  changes,
  client,
  urls,
  serviceValuesTransformer = _.identity,
} : {
  changes: Change<InstanceElement>[]
  client: JiraClient
  urls: JspUrls
  serviceValuesTransformer?: ServiceValuesTransformer
}
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
      log.error(`Failed to query service values: ${err}`)
      deployResult.errors = [
        ...deployResult.errors,
        ...deployResult.appliedChanges.map(change => new Error(`Failed to deploy ${getChangeData(change).elemID.getFullName()}`)),
      ]
      deployResult.appliedChanges = []
    }
  }

  return deployResult
}
