/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import {
  Change,
  ChangeDataType,
  DeployResult,
  getChangeData,
  InstanceElement,
  isAdditionChange,
  isRemovalChange,
  isSaltoError,
  SaltoError,
  Values,
} from '@salto-io/adapter-api'
import { config as configUtils, deployment, client as clientUtils } from '@salto-io/adapter-components'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import ZendeskClient from './client/client'
import { getZendeskError } from './errors'
import { ZendeskApiConfig } from './config'

const log = logger(module)
const { awu } = collections.asynciterable

export const addId = ({
  change,
  apiDefinitions,
  response,
  dataField,
  addAlsoOnModification = false,
}: {
  change: Change<InstanceElement>
  apiDefinitions: configUtils.AdapterApiConfig
  response: deployment.ResponseResult
  dataField?: string
  addAlsoOnModification?: boolean
}): void => {
  const { transformation } = apiDefinitions.types[getChangeData(change).elemID.typeName]
  if (isAdditionChange(change) || addAlsoOnModification) {
    if (Array.isArray(response)) {
      log.warn(
        'Received an array for the response of the deploy. Not updating the id of the element. Action: add. ID: %s',
        getChangeData(change).elemID.getFullName(),
      )
      return
    }
    const transformationConfig = configUtils.getConfigWithDefault(
      transformation,
      apiDefinitions.typeDefaults.transformation,
    )
    const idField = transformationConfig.serviceIdField ?? 'id'
    const idValue = dataField ? (response?.[dataField] as Values)?.[idField] : response?.[idField]
    if (idValue !== undefined) {
      getChangeData(change).value[idField] = idValue
    }
  }
}

const getMatchedChild = ({
  change,
  response,
  childFieldName,
  dataField,
  childUniqueFieldName,
}: {
  change: Change<InstanceElement>
  response: clientUtils.ResponseValue
  childFieldName: string
  childUniqueFieldName: string
  dataField?: string
}): clientUtils.ResponseValue | undefined => {
  const childrenResponse = ((dataField !== undefined ? response[dataField] : response) as Values)?.[childFieldName]
  if (childrenResponse) {
    if (_.isArray(childrenResponse) && childrenResponse.every(_.isPlainObject)) {
      return childrenResponse.find(
        child =>
          child[childUniqueFieldName] &&
          child[childUniqueFieldName] === getChangeData(change).value[childUniqueFieldName],
      )
    }
    log.warn(`Received invalid response for ${childFieldName} in ${getChangeData(change).elemID.getFullName()}`)
  }
  return undefined
}
export const addIdsToChildrenUponAddition = ({
  response,
  parentChange,
  childrenChanges,
  apiDefinitions,
  childFieldName,
  childUniqueFieldName,
}: {
  response: deployment.ResponseResult
  parentChange: Change<InstanceElement>
  childrenChanges: Change<InstanceElement>[]
  apiDefinitions: ZendeskApiConfig
  childFieldName: string
  childUniqueFieldName: string
}): Change<InstanceElement>[] => {
  const { deployRequests } = apiDefinitions.types[getChangeData(parentChange).elemID.typeName]
  childrenChanges.filter(isAdditionChange).forEach(change => {
    if (response && !_.isArray(response)) {
      const dataField = deployRequests?.add?.deployAsField
      const child = getMatchedChild({
        change,
        response,
        dataField,
        childFieldName,
        childUniqueFieldName,
      })
      if (child) {
        addId({
          change,
          apiDefinitions,
          response: child,
        })
      }
    }
  })
  return [parentChange, ...childrenChanges]
}

export const deployChange = async (
  change: Change<InstanceElement>,
  client: ZendeskClient,
  apiDefinitions: configUtils.AdapterApiConfig,
  fieldsToIgnore?: string[],
): Promise<deployment.ResponseResult> => {
  const { deployRequests } = apiDefinitions.types[getChangeData(change).elemID.typeName]
  try {
    const response = await deployment.deployChange({
      change,
      client,
      endpointDetails: deployRequests,
      fieldsToIgnore,
    })
    addId({
      change,
      apiDefinitions,
      response,
      dataField: deployRequests?.add?.deployAsField,
    })
    return response
  } catch (err) {
    throw getZendeskError(getChangeData(change).elemID, err)
  }
}

const deployChangesHelper = async <T extends Change<ChangeDataType>>(
  change: T,
  deployChangeFunc: (change: T) => Promise<void | T[]>,
): Promise<T[] | T | SaltoError> => {
  try {
    const res = await deployChangeFunc(change)
    return res !== undefined ? res : change
  } catch (err) {
    if (!isSaltoError(err)) {
      throw err
    }
    return err
  }
}

export const deployChanges = async <T extends Change<ChangeDataType>>(
  changes: T[],
  deployChangeFunc: (change: T) => Promise<void | T[]>,
): Promise<DeployResult> => {
  const [removalChanges, otherChanges] = _.partition(changes, isRemovalChange)
  // We want to deploy removal changes first (SALTO-4955)
  const removalResults = await Promise.all(
    removalChanges.map(async change => deployChangesHelper(change, deployChangeFunc)),
  )
  const otherResults = await Promise.all(
    otherChanges.map(async change => deployChangesHelper(change, deployChangeFunc)),
  )
  const result = [...removalResults, ...otherResults]

  const [errors, appliedChanges] = _.partition(result.flat(), isSaltoError)
  return { errors, appliedChanges }
}

export const deployChangesSequentially = async <T extends Change<ChangeDataType>>(
  changes: T[],
  deployChangeFunc: (change: T) => Promise<void | T[]>,
): Promise<DeployResult> => {
  const result = await awu(changes)
    .map(async change => deployChangesHelper(change, deployChangeFunc))
    .toArray()
  const [errors, appliedChanges] = _.partition(result.flat(), isSaltoError)
  return { errors, appliedChanges }
}

export const deployChangesByGroups = async <T extends Change<ChangeDataType>>(
  changeGroups: T[][],
  deployChangeFunc: (change: T) => Promise<void | T[]>,
): Promise<DeployResult> => {
  const deployGroupResults = await awu(changeGroups)
    .map(async changeGroup => deployChanges(changeGroup, deployChangeFunc))
    .toArray()
  return {
    errors: deployGroupResults.flatMap(res => res.errors),
    appliedChanges: deployGroupResults.flatMap(res => res.appliedChanges),
  }
}
