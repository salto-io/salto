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
import Joi from 'joi'
import { Change, ChangeDataType, DeployResult, getChangeData, InstanceElement, isAdditionChange, isModificationChange, isEqualValues, ModificationChange, AdditionChange, ElemID } from '@salto-io/adapter-api'
import { config as configUtils, deployment, elements as elementUtils, client as clientUtils } from '@salto-io/adapter-components'
import { createSchemeGuard } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { values, collections } from '@salto-io/lowerdash'
import OktaClient from './client/client'
import { ACTIVE_STATUS, INACTIVE_STATUS } from './constants'
import { OktaActionName, OktaApiConfig } from './config'

const log = logger(module)

const { createUrl } = elementUtils
const { awu } = collections.asynciterable
const { isDefined } = values

const isStringArray = (
  value: unknown,
): value is string[] => _.isArray(value) && value.every(_.isString)

type OktaError = {
  errorSummary: string
  errorCauses: {
    errorSummary: string
  }[]
}

const OKTA_ERROR_SCHEMA = Joi.object({
  errorSummary: Joi.string().required(),
  errorCauses: Joi.array().items(Joi.object({
    errorSummary: Joi.string().required(),
  }).unknown(true).optional()),
}).unknown(true)

const isOktaError = createSchemeGuard<OktaError>(OKTA_ERROR_SCHEMA, 'Received an invalid error')

const getOktaError = (elemID: ElemID, error: Error): Error => {
  if (!(error instanceof clientUtils.HTTPError)) {
    return error
  }
  const { status, data } = error.response
  const baseErrorMessage = `Deployment of ${elemID.typeName} instance ${elemID.name} failed with status code ${status}:`
  if (isOktaError(data)) {
    const { errorSummary, errorCauses } = data
    const oktaErrorMessage = _.isEmpty(errorCauses) ? errorSummary : `${errorSummary}. More info: ${errorCauses.map(c => c.errorSummary).join(',')}`
    log.error(`${baseErrorMessage} ${oktaErrorMessage}`)
    return new Error(`${baseErrorMessage} ${oktaErrorMessage}`)
  }
  log.error(`${baseErrorMessage} ${error}`)
  return new Error(`${baseErrorMessage} ${error}`)
}

const isActivationChange = (change: ModificationChange<InstanceElement>): boolean => {
  const statusBefore = change.data.before.value.status
  const statusAfter = change.data.after.value.status
  return statusBefore === INACTIVE_STATUS && statusAfter === ACTIVE_STATUS
}

const isDeactivationChange = (change: ModificationChange<InstanceElement>): boolean => {
  const statusBefore = change.data.before.value.status
  const statusAfter = change.data.after.value.status
  return statusBefore === ACTIVE_STATUS && statusAfter === INACTIVE_STATUS
}

const deployStatusChange = async (
  change: ModificationChange<InstanceElement>,
  client: OktaClient,
  deployRequests?: Partial<Record<OktaActionName, configUtils.DeployRequestConfig>>
): Promise<void> => {
  const instance = getChangeData(change)
  const endpoint = isActivationChange(change)
    ? deployRequests?.activate
    : deployRequests?.deactivate
  if (endpoint === undefined) {
    return
  }
  const url = createUrl({
    instance,
    baseUrl: endpoint.url,
    urlParamsToFields: endpoint.urlParamsToFields,
  })
  try {
    await client[endpoint.method]({ url, data: {} })
  } catch (err) {
    log.error(`Status could not be updated in instance: ${getChangeData(change).elemID.getFullName()}`, err)
    throw err
  }
}

/**
 * Deploy change with the standard "add", "modify", "remove" endpoints
 */
export const defaultDeployChange = async (
  change: Change<InstanceElement>,
  client: OktaClient,
  apiDefinitions: OktaApiConfig,
  fieldsToIgnore?: string[],
  queryParams?: Record<string, string>,
): Promise<deployment.ResponseResult> => {
  const changeToDeploy = await elementUtils.swagger.flattenAdditionalProperties(
    _.cloneDeep(change)
  )

  if (isModificationChange(changeToDeploy)) {
    const valuesBefore = (await deployment.filterIgnoredValues(
      changeToDeploy.data.before.clone(),
      fieldsToIgnore ?? [],
      [],
    )).value
    const valuesAfter = (await deployment.filterIgnoredValues(
      changeToDeploy.data.after.clone(),
      fieldsToIgnore ?? [],
      [],
    )).value

    if (isEqualValues(valuesBefore, valuesAfter)) {
      return undefined
    }
  }

  const { deployRequests } = apiDefinitions.types[getChangeData(change).elemID.typeName]
  try {
    // If the instance is deactivated,
    // we should first change the status as some instances can not be changed in status 'ACTIVE'
    if (isModificationChange(change) && isDeactivationChange(change)) {
      await deployStatusChange(change, client, deployRequests)
    }

    const response = await deployment.deployChange({
      change: changeToDeploy,
      client,
      endpointDetails: deployRequests,
      fieldsToIgnore,
      queryParams,
    })

    // If the instance is activated, we should first make the changes and then change the status
    if (isModificationChange(change) && isActivationChange(change)) {
      await deployStatusChange(change, client, deployRequests)
    }

    if (isAdditionChange(change)) {
      if (!Array.isArray(response)) {
        const serviceIdField = apiDefinitions.types[getChangeData(change).elemID.typeName]?.transformation?.serviceIdField ?? 'id'
        if (response?.[serviceIdField] !== undefined) {
          getChangeData(change).value[serviceIdField] = response[serviceIdField]
        }
      } else {
        log.warn('Received unexpected response from deployChange: %o', response)
      }
    }
    return response
  } catch (err) {
    throw getOktaError(getChangeData(change).elemID, err)
  }
}

const getValuesToAdd = (
  change: AdditionChange<InstanceElement> | ModificationChange<InstanceElement>,
  fieldName: string,
): string[] | undefined => {
  const fieldValuesAfter = _.get(getChangeData(change).value, fieldName)
  if (isModificationChange(change)) {
    const fieldValuesBefore = _.get(change.data.before.value, fieldName)
    if (fieldValuesBefore !== undefined) {
      if (isStringArray(fieldValuesAfter) && isStringArray(fieldValuesBefore)) {
        return fieldValuesAfter.filter(val => !fieldValuesBefore.includes(val))
      }
      if (fieldValuesBefore === fieldValuesAfter) {
        return undefined
      }
    }
  }
  return _.isString(fieldValuesAfter) ? [fieldValuesAfter] : fieldValuesAfter
}

const getValuesToRemove = (
  change: ModificationChange<InstanceElement>,
  fieldName: string,
): string[] | undefined => {
  const fieldValuesBefore = _.get(change.data.before.value, fieldName)
  const fieldValuesAfter = _.get(change.data.after.value, fieldName)
  if (isStringArray(fieldValuesBefore)) {
    if (isStringArray(fieldValuesAfter)) {
      return fieldValuesBefore.filter(val => !fieldValuesAfter.includes(val))
    }
    return fieldValuesBefore
  }
  return undefined
}

export const deployEdges = async (
  change: AdditionChange<InstanceElement> | ModificationChange<InstanceElement>,
  deployRequestByField: Record<string, configUtils.DeploymentRequestsByAction>,
  client: OktaClient,
): Promise<void> => {
  const instance = getChangeData(change)
  const instanceId = instance.value.id

  const deployEdge = async (
    paramValues: Record<string, string>,
    deployRequest: configUtils.DeployRequestConfig,
    fieldName: string,
  ): Promise<deployment.ResponseResult> => {
    const url = elementUtils.replaceUrlParams(deployRequest.url, paramValues)
    try {
      const response = await client[deployRequest.method]({ url, data: {} })
      return response.data
    } catch (err) {
      log.error(`Deploy values of ${fieldName} in instance ${instance.elemID.getFullName()} failed`)
      throw getOktaError(getChangeData(change).elemID, err)
    }
  }

  await awu(Object.keys(deployRequestByField)).forEach(async fieldName => {
    const fieldValuesToAdd = getValuesToAdd(change, fieldName)
    const addConfig = deployRequestByField[fieldName].add
    if (isDefined(fieldValuesToAdd) && isDefined(addConfig)) {
      await awu(fieldValuesToAdd).forEach(fieldValue =>
        deployEdge({ source: instanceId, target: fieldValue }, addConfig, fieldName))
    }

    if (isModificationChange(change)) {
      const fieldValuesToRemove = getValuesToRemove(change, fieldName)
      const removeConfig = deployRequestByField[fieldName].remove
      if (isDefined(fieldValuesToRemove) && isDefined(removeConfig)) {
        await awu(fieldValuesToRemove).forEach(fieldValue =>
          deployEdge({ source: instanceId, target: fieldValue }, removeConfig, fieldName))
      }
    }
  })
}

// TODO SALTO-2742 move to adapter components
export const deployChanges = async <T extends Change<ChangeDataType>>(
  changes: T[],
  deployChangeFunc: (change: T) => Promise<void | T[]>
): Promise<DeployResult> => {
  const result = await Promise.all(
    changes.map(async change => {
      try {
        const res = await deployChangeFunc(change)
        return res !== undefined ? res : change
      } catch (err) {
        if (!_.isError(err)) {
          throw err
        }
        return err
      }
    })
  )

  const [errors, appliedChanges] = _.partition(result.flat(), _.isError)
  return { errors, appliedChanges }
}
