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
import { AdditionChange, Change, DeployResult, getChangeData, InstanceElement, isAdditionChange, isInstanceChange, isModificationChange, isRemovalChange, SeverityLevel, Values } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { resolveValues, safeJsonStringify } from '@salto-io/adapter-utils'
import { deployment, client as clientUtils } from '@salto-io/adapter-components'
import { collections } from '@salto-io/lowerdash'
import { deployChanges } from './standard_deployment'
import JiraClient from '../client/client'
import { getLookUpName } from '../reference_mapping'
import { JspUrls } from '../config/config'

const { awu } = collections.asynciterable

const log = logger(module)

type NameIdObject = {
  name: unknown
  id: unknown
}

const deployChange = async (
  change: Change<InstanceElement>,
  client: JiraClient,
  urls: JspUrls,
  fieldsToIgnore: string[],
): Promise<void> => {
  const instance = await deployment.filterIgnoredValues(
    await deployment.filterUndeployableValues(
      await resolveValues(getChangeData(change), getLookUpName),
      change.action,
    ),
    fieldsToIgnore,
  )

  if (isAdditionChange(change)) {
    await client.jspPost({
      url: urls.add,
      data: instance.value,
    })
  }

  if (isModificationChange(change)) {
    if (urls.modify === undefined) {
      throw new Error(`Modify ${instance.elemID.getFullName()} is not supported`)
    }
    await client.jspPost({
      url: urls.modify,
      data: instance.value,
    })
  }

  if (isRemovalChange(change)) {
    if (urls.remove === undefined) {
      throw new Error(`Remove ${instance.elemID.getFullName()} is not supported`)
    }
    try {
      await client.jspPost({
        url: urls.remove,
        data: {
          ...instance.value,
          confirm: 'true',
          confirmed: 'true',
        },
      })
    } catch (err) {
      if (err instanceof clientUtils.HTTPError
        && err.response.status === 404
        && isRemovalChange(change)) {
        log.debug(`Received error ${err.message} for ${instance.elemID.getFullName()}. The element is already removed`)
        return
      }
      throw err
    }
  }
}

const isNameIdObject = (obj: unknown): obj is NameIdObject =>
  typeof obj === 'object' && obj !== null && 'name' in obj && 'id' in obj

const queryServiceValues = async (
  client: JiraClient,
  urls: JspUrls,
  getNameFunction?: (values: Values) => string,
  queryFunction?: () => Promise<clientUtils.ResponseValue[]>
): Promise<NameIdObject[]> => {
  if (queryFunction === undefined && urls.query === undefined) {
    throw new Error('Missing JSP query url from the configuration')
  }

  const queryFromClient = async (url: string): Promise<clientUtils.ResponseValue[]> => {
    const response = await client.getPrivate({
      url,
    })

    const data = urls.dataField !== undefined && !Array.isArray(response.data)
      ? response.data[urls.dataField]
      : response.data

    if (!Array.isArray(data)) {
      throw new Error(`Expected array of values in response, got ${safeJsonStringify(response.data)}`)
    }

    return data
  }

  const data = queryFunction !== undefined
    ? await queryFunction()
    : await queryFromClient(urls.query as string)

  const serviceValues = getNameFunction !== undefined
    ? data.map(values => ({
      ...values,
      name: getNameFunction(values),
    }))
    : data

  return serviceValues.filter((obj): obj is NameIdObject => {
    if (!isNameIdObject(obj)) {
      log.warn(`Received unexpected response ${safeJsonStringify(obj)} from query ${urls.query}`)
      return false
    }
    return true
  }) as unknown as Promise<NameIdObject[]>
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
  serviceValuesTransformer: ServiceValuesTransformer,
  fieldsToIgnore: string[],
): Promise<void> => {
  const idToValues = _.keyBy(serviceValues, value => value.id)

  const deployedInstances = _.keyBy(
    await awu(deployResult.appliedChanges)
      .filter(isInstanceChange)
      .map(change => deployment.filterUndeployableValues(getChangeData(change), change.action))
      .map(instance => resolveValues(instance, getLookUpName))
      .map(instance => deployment.filterIgnoredValues(instance, fieldsToIgnore))
      .toArray(),
    instance => instance.elemID.getFullName()
  )

  const invalidChanges = _.remove(
    deployResult.appliedChanges,
    change => {
      const instance = deployedInstances[getChangeData(change).elemID.getFullName()]

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
    ...invalidChanges.map(change => ({ message: 'Failed to deploy change', severity: 'Error' as SeverityLevel, elemID: getChangeData(change).elemID })),
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
  queryFunction,
  urls,
  serviceValuesTransformer = _.identity,
  fieldsToIgnore = [],
  getNameFunction,
} : {
  changes: Change<InstanceElement>[]
  client: JiraClient
  queryFunction?: () => Promise<clientUtils.ResponseValue[]>
  urls: JspUrls
  serviceValuesTransformer?: ServiceValuesTransformer
  fieldsToIgnore?: string[]
  getNameFunction?: (values: Values) => string
}
): Promise<DeployResult> => {
  const deployResult = await deployChanges(
    changes,
    change => deployChange(
      change,
      client,
      urls,
      fieldsToIgnore
    )
  )

  if (deployResult.appliedChanges.length !== 0) {
    try {
      const serviceValues = await queryServiceValues(client, urls, getNameFunction, queryFunction)
      await addIdsToResults(
        deployResult.appliedChanges.filter(isInstanceChange).filter(isAdditionChange),
        serviceValues
      )
      await verifyDeployment(serviceValues, deployResult, serviceValuesTransformer, fieldsToIgnore)
    } catch (err) {
      log.error(`Failed to query service values: ${err}`)
      deployResult.errors = [
        ...deployResult.errors,
        ...deployResult.appliedChanges.map(change => ({ message: 'Failed to deploy change', severity: 'Error' as SeverityLevel, elemID: getChangeData(change).elemID })),
      ]
      deployResult.appliedChanges = []
    }
  }

  return deployResult
}
