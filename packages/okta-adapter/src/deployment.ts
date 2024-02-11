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
import Joi from 'joi'
import { Change, ChangeDataType, DeployResult, getChangeData, InstanceElement, isAdditionChange, isModificationChange, ModificationChange, isEqualValues, AdditionChange, ElemID, createSaltoElementError, isSaltoError, SaltoError } from '@salto-io/adapter-api'
import { config as configUtils, deployment, elements as elementUtils, client as clientUtils, fetch as fetchUtils } from '@salto-io/adapter-components'
import { createSchemeGuard } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { values, collections } from '@salto-io/lowerdash'
import OktaClient from './client/client'
import { ACTIVE_STATUS, INACTIVE_STATUS } from './constants'
import { OktaStatusActionName, OktaSwaggerApiConfig } from './config'

const log = logger(module)

const { createUrl } = fetchUtils.resource
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

type ResponseWithStatus = {
  status: string
}

const OKTA_ERROR_SCHEMA = Joi.object({
  errorSummary: Joi.string().required(),
  errorCauses: Joi.array().items(Joi.object({
    errorSummary: Joi.string().required(),
  }).unknown(true).optional()),
}).unknown(true)

const RESPONSE_WITH_STATUS = Joi.object({
  status: Joi.string().valid(ACTIVE_STATUS, INACTIVE_STATUS).allow(),
}).unknown(true)

const isOktaError = createSchemeGuard<OktaError>(OKTA_ERROR_SCHEMA, 'Received an invalid error')

const isResponseWithStatus = createSchemeGuard<ResponseWithStatus>(RESPONSE_WITH_STATUS, 'Response does not have a valid status field')

export const getOktaError = (elemID: ElemID, error: Error): Error => {
  if (!(error instanceof clientUtils.HTTPError)) {
    return error
  }
  const { status, data } = error.response
  const baseErrorMessage = `(status code: ${status})`
  if (isOktaError(data)) {
    const { errorSummary, errorCauses } = data
    const oktaErrorMessage = _.isEmpty(errorCauses) ? errorSummary : `${errorSummary}. More info: ${errorCauses.map(c => c.errorSummary).join(',')}`
    log.error(`Deployment of ${elemID.getFullName()} failed. ${oktaErrorMessage} ${baseErrorMessage}`)
    error.message = `${oktaErrorMessage} ${baseErrorMessage}`
    return error
  }
  log.error(`Deployment of ${elemID.getFullName()} failed. ${error.message} ${baseErrorMessage}`)
  error.message = `${error.message} ${baseErrorMessage}`
  return error
}

export const isActivationChange = ({ before, after }: {before: string; after: string}): boolean =>
  before === INACTIVE_STATUS && after === ACTIVE_STATUS

export const isDeactivationChange = ({ before, after }: {before: string; after: string}): boolean =>
  before === ACTIVE_STATUS && after === INACTIVE_STATUS

export const deployStatusChange = async (
  change: Change<InstanceElement>,
  client: OktaClient,
  apiDefinitions: OktaSwaggerApiConfig,
  operation: OktaStatusActionName,
): Promise<void> => {
  const deployRequests = apiDefinitions.types?.[getChangeData(change).elemID.typeName]?.deployRequests
  const instance = getChangeData(change)
  const endpoint = operation === 'activate'
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

export const assignServiceIdToAdditionChange = (
  response: deployment.ResponseResult,
  change: AdditionChange<InstanceElement>,
  apiDefinitions: configUtils.AdapterApiConfig,
): void => {
  if (!Array.isArray(response)) {
    const serviceIdField = apiDefinitions.types[getChangeData(change).elemID.typeName]?.transformation?.serviceIdField ?? 'id'
    if (response?.[serviceIdField] !== undefined) {
      getChangeData(change).value[serviceIdField] = response[serviceIdField]
    }
  } else {
    log.warn('Received unexpected response, could not assign service id to change: %o', response)
  }
}

/**
 * Deploy change with the standard "add", "modify", "remove" endpoints
 */
export const defaultDeployChange = async (
  change: Change<InstanceElement>,
  client: OktaClient,
  apiDefinitions: OktaSwaggerApiConfig,
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
    const response = await deployment.deployChange({
      change: changeToDeploy,
      client,
      endpointDetails: deployRequests,
      fieldsToIgnore,
      queryParams,
      allowedStatusCodesOnRemoval: [404],
    })

    if (isAdditionChange(change)) {
      assignServiceIdToAdditionChange(response, change, apiDefinitions)
    }
    return response
  } catch (err) {
    throw getOktaError(getChangeData(change).elemID, err)
  }
}

/**
 * Deploy change with "add", "modify", "remove", "activation" and "deactivation" endpoints
 */
export const defaultDeployWithStatus = async (
  change: Change<InstanceElement>,
  client: OktaClient,
  apiDefinitions: OktaSwaggerApiConfig,
  fieldsToIgnore?: string[],
  queryParams?: Record<string, string>,
): Promise<deployment.ResponseResult> => {
  try {
    // If the instance is deactivated,
    // we should first change the status as some instances can not be changed in status 'ACTIVE'
    if (isModificationChange(change)
      && isDeactivationChange({ before: change.data.before.value.status, after: change.data.after.value.status })) {
      await deployStatusChange(change, client, apiDefinitions, 'deactivate')
    }
    const response = await defaultDeployChange(
      change,
      client,
      apiDefinitions,
      fieldsToIgnore,
      queryParams
    )

    // Update status for the created instance if necessary
    if (isAdditionChange(change) && isResponseWithStatus(response)) {
      const changeStatus = getChangeData(change).value.status
      if (isActivationChange({ before: response.status, after: changeStatus })) {
        log.debug(`Instance ${getChangeData(change).elemID.getFullName()} created in status ${INACTIVE_STATUS}, changing to ${ACTIVE_STATUS}`)
        await deployStatusChange(change, client, apiDefinitions, 'activate')
      } else if (isDeactivationChange({ before: response.status, after: changeStatus })) {
        log.debug(`Instance ${getChangeData(change).elemID.getFullName()} created in status ${ACTIVE_STATUS}, changing to ${INACTIVE_STATUS}`)
        await deployStatusChange(change, client, apiDefinitions, 'deactivate')
      }
    }

    // If the instance is activated, we should first make the changes and then change the status
    if (isModificationChange(change)
      && isActivationChange({ before: change.data.before.value.status, after: change.data.after.value.status })) {
      await deployStatusChange(change, client, apiDefinitions, 'activate')
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
    const url = fetchUtils.request.replaceArgs(deployRequest.url, paramValues)
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

export const deployChanges = async <T extends Change<ChangeDataType>>(
  changes: T[],
  deployChangeFunc: (change: T) => Promise<void | T>
): Promise<DeployResult> => {
  const result = await Promise.all(changes.map(async (change): Promise<T | SaltoError> => {
    try {
      const res = await deployChangeFunc(change)
      return res !== undefined ? res : change
    } catch (err) {
      return createSaltoElementError({
        message: err.message,
        severity: 'Error',
        elemID: getChangeData(change).elemID,
      })
    }
  }))
  const [errors, appliedChanges] = _.partition(result, isSaltoError)
  return { errors, appliedChanges }
}
