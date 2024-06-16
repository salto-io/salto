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
import {
  Change,
  ChangeDataType,
  DeployResult,
  getChangeData,
  InstanceElement,
  isAdditionChange,
  isModificationChange,
  ModificationChange,
  isEqualValues,
  AdditionChange,
  ElemID,
  createSaltoElementError,
  isSaltoError,
  SaltoError,
  isRemovalChange,
  isServiceId,
} from '@salto-io/adapter-api'
import {
  config as configUtils,
  deployment,
  elements as elementUtils,
  client as clientUtils,
  fetch as fetchUtils,
  definitions as definitionUtils,
} from '@salto-io/adapter-components'
import { createSchemeGuard } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { values, collections, promises } from '@salto-io/lowerdash'
import { ACTIVE_STATUS, CUSTOM_NAME_FIELD, INACTIVE_STATUS, NETWORK_ZONE_TYPE_NAME } from './constants'
import { OktaSwaggerApiConfig } from './config'
import { StatusActionName } from './definitions/types'

const log = logger(module)

const { createUrl } = fetchUtils.resource
const { awu } = collections.asynciterable
const { isDefined } = values

const isStringArray = (value: unknown): value is string[] => _.isArray(value) && value.every(_.isString)

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
  errorCauses: Joi.array().items(
    Joi.object({
      errorSummary: Joi.string().required(),
    })
      .unknown(true)
      .optional(),
  ),
}).unknown(true)

const RESPONSE_WITH_STATUS = Joi.object({
  status: Joi.string().valid(ACTIVE_STATUS, INACTIVE_STATUS).allow(),
}).unknown(true)

const isOktaError = createSchemeGuard<OktaError>(OKTA_ERROR_SCHEMA, 'Received an invalid error')

const isResponseWithStatus = createSchemeGuard<ResponseWithStatus>(
  RESPONSE_WITH_STATUS,
  'Response does not have a valid status field',
)

export const getOktaError = (elemID: ElemID, error: Error): Error => {
  if (!(error instanceof clientUtils.HTTPError)) {
    return error
  }
  const { status, data } = error.response
  const baseErrorMessage = `(status code: ${status})`
  if (isOktaError(data)) {
    const { errorSummary, errorCauses } = data
    const oktaErrorMessage = _.isEmpty(errorCauses)
      ? errorSummary
      : `${errorSummary}. More info: ${errorCauses.map(c => c.errorSummary).join(',')}`
    log.error(`Deployment of ${elemID.getFullName()} failed. ${oktaErrorMessage} ${baseErrorMessage}`)
    error.message = `${oktaErrorMessage} ${baseErrorMessage}`
    return error
  }
  log.error(`Deployment of ${elemID.getFullName()} failed. ${error.message} ${baseErrorMessage}`)
  error.message = `${error.message} ${baseErrorMessage}`
  return error
}

export const isActivationModification = ({ before, after }: { before: string; after: string }): boolean =>
  before === INACTIVE_STATUS && after === ACTIVE_STATUS

export const isActivationChange = (change: Change<InstanceElement>): boolean =>
  isModificationChange(change) &&
  isActivationModification({ before: change.data.before.value.status, after: change.data.after.value.status })

export const isDeactivationModification = ({ before, after }: { before: string; after: string }): boolean =>
  before === ACTIVE_STATUS && after === INACTIVE_STATUS

export const isDeactivationChange = (change: Change<InstanceElement>): boolean =>
  isModificationChange(change) &&
  isDeactivationModification({ before: change.data.before.value.status, after: change.data.after.value.status })

const DEACTIVATE_BEFORE_REMOVAL_TYPES = new Set([NETWORK_ZONE_TYPE_NAME])
const shouldDeactivateBeforeRemoval = (change: Change<InstanceElement>): boolean =>
  isRemovalChange(change) && DEACTIVATE_BEFORE_REMOVAL_TYPES.has(getChangeData(change).elemID.typeName)


export const deployStatusChange = async (
  change: Change<InstanceElement>,
  client: clientUtils.HTTPWriteClientInterface & clientUtils.HTTPReadClientInterface,
  apiDefinitions: OktaSwaggerApiConfig,
  operation: StatusActionName,
): Promise<void> => {
  const deployRequests = apiDefinitions.types?.[getChangeData(change).elemID.typeName]?.deployRequests
  const instance = getChangeData(change)
  const endpoint = operation === 'activate' ? deployRequests?.activate : deployRequests?.deactivate
  if (endpoint === undefined) {
    return
  }
  const url = createUrl({
    instance,
    url: endpoint.url,
    urlParamsToFields: endpoint.urlParamsToFields,
  })
  try {
    await client[endpoint.method]({ url, data: {} })
  } catch (err) {
    log.error(`Status could not be updated in instance: ${getChangeData(change).elemID.getFullName()}`, err)
    throw err
  }
}

export const assignServiceIdToAdditionChange = async (
  response: deployment.ResponseResult,
  change: AdditionChange<InstanceElement>,
): Promise<void> => {
  if (!Array.isArray(response)) {
    const type = await getChangeData(change).getType()
    const serviceIDFieldNames = Object.keys(
      _.pickBy(
        await promises.object.mapValuesAsync(type.fields, async f => isServiceId(await f.getType())),
        val => val,
      ),
    )
    serviceIDFieldNames.forEach(fieldName => {
      if (response?.[fieldName] !== undefined) {
        getChangeData(change).value[fieldName] = response[fieldName]
      }
    })
  } else {
    log.warn('Received unexpected response, could not assign service id to change: %o', response)
  }
}

export const isInactiveCustomAppChange = (change: Change<InstanceElement>): boolean =>
  isModificationChange(change) &&
  change.data.before.value.status === INACTIVE_STATUS &&
  change.data.after.value.status === INACTIVE_STATUS &&
  // customName field only exist in custom applications
  getChangeData(change).value[CUSTOM_NAME_FIELD] !== undefined

/**
 * Deploy change with the standard "add", "modify", "remove" endpoints
 */
export const defaultDeployChange = async (
  change: Change<InstanceElement>,
  client: clientUtils.HTTPWriteClientInterface & clientUtils.HTTPReadClientInterface,
  apiDefinitions: OktaSwaggerApiConfig,
  fieldsToIgnore?: string[],
  queryParams?: Record<string, string>,
): Promise<deployment.ResponseResult> => {
  const changeToDeploy = await elementUtils.swagger.flattenAdditionalProperties(_.cloneDeep(change))

  if (isModificationChange(changeToDeploy)) {
    const valuesBefore = (
      await deployment.filterIgnoredValues(changeToDeploy.data.before.clone(), fieldsToIgnore ?? [], [])
    ).value
    const valuesAfter = (
      await deployment.filterIgnoredValues(changeToDeploy.data.after.clone(), fieldsToIgnore ?? [], [])
    ).value

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
      await assignServiceIdToAdditionChange(response, change)
    }
    return response
  } catch (err) {
    throw getOktaError(getChangeData(change).elemID, err)
  }
}

const shouldActivateAfterModification = ({
                                           change,
                                         }: definitionUtils.deploy.ChangeAndContext): boolean =>
  isModificationChange(change) &&
  isActivationModification({ before: change.data.before.value.status, after: change.data.after.value.status })

const shouldActivateAfterAddition = ({
                                       change,
                                       sharedContext,
                                     }: definitionUtils.deploy.ChangeAndContext): boolean => {
  // Update status for the created instance if necessary
  const response = sharedContext[getChangeData(change).elemID.getFullName()]
  if (isAdditionChange(change) && isResponseWithStatus(response)) {
    const changeStatus = getChangeData(change).value.status
    if (isActivationModification({ before: response.status, after: changeStatus })) {
      return true
    }
  }
  return false
}

const shouldDeactivateAfterAddition = ({
                                         change,
                                         sharedContext,
                                       }: definitionUtils.deploy.ChangeAndContext): boolean => {
  const response = sharedContext[getChangeData(change).elemID.getFullName()]
  if (isAdditionChange(change) && isResponseWithStatus(response)) {
    const changeStatus = getChangeData(change).value.status
    if (isDeactivationModification({ before: response.status, after: changeStatus })) {
      return true
    }
  }
  return false
}


export const shouldActivateAfterChange = (changeAndContext: definitionUtils.deploy.ChangeAndContext): boolean =>
  shouldActivateAfterAddition(changeAndContext) || shouldActivateAfterModification(changeAndContext)

export const shouldDeactivateAfterChange = (changeAndContext: definitionUtils.deploy.ChangeAndContext): boolean =>
  shouldDeactivateAfterAddition(changeAndContext)

export const shouldDeactivateBeforeChange = ({ change }: definitionUtils.deploy.ChangeAndContext): boolean =>
  isDeactivationChange(change) || shouldDeactivateBeforeRemoval(change)

/**
 * Deploy change with "add", "modify", "remove", "activation" and "deactivation" endpoints
 */
export const defaultDeployWithStatus = async (
  change: Change<InstanceElement>,
  client: clientUtils.HTTPWriteClientInterface & clientUtils.HTTPReadClientInterface,
  apiDefinitions: OktaSwaggerApiConfig,
  fieldsToIgnore?: string[],
  queryParams?: Record<string, string>,
): Promise<deployment.ResponseResult> => {
  try {
    // some changes can't be applied when status is ACTIVE, so we need to deactivate them first
    if (isDeactivationChange(change) || shouldDeactivateBeforeRemoval(change)) {
      await deployStatusChange(change, client, apiDefinitions, 'deactivate')
    }
    const response = await defaultDeployChange(change, client, apiDefinitions, fieldsToIgnore, queryParams)

    // Update status for the created instance if necessary
    if (isAdditionChange(change) && isResponseWithStatus(response)) {
      const changeStatus = getChangeData(change).value.status
      if (isActivationModification({ before: response.status, after: changeStatus })) {
        log.debug(
          `Instance ${getChangeData(change).elemID.getFullName()} created in status ${INACTIVE_STATUS}, changing to ${ACTIVE_STATUS}`,
        )
        await deployStatusChange(change, client, apiDefinitions, 'activate')
      } else if (isDeactivationModification({ before: response.status, after: changeStatus })) {
        log.debug(
          `Instance ${getChangeData(change).elemID.getFullName()} created in status ${ACTIVE_STATUS}, changing to ${INACTIVE_STATUS}`,
        )
        await deployStatusChange(change, client, apiDefinitions, 'deactivate')
      }
    }

    // If the instance is activated, we should first make the changes and then change the status
    if (isActivationChange(change)) {
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

const getValuesToRemove = (change: ModificationChange<InstanceElement>, fieldName: string): string[] | undefined => {
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
  client: clientUtils.HTTPWriteClientInterface & clientUtils.HTTPReadClientInterface,
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
        deployEdge({ source: instanceId, target: fieldValue }, addConfig, fieldName),
      )
    }

    if (isModificationChange(change)) {
      const fieldValuesToRemove = getValuesToRemove(change, fieldName)
      const removeConfig = deployRequestByField[fieldName].remove
      if (isDefined(fieldValuesToRemove) && isDefined(removeConfig)) {
        await awu(fieldValuesToRemove).forEach(fieldValue =>
          deployEdge({ source: instanceId, target: fieldValue }, removeConfig, fieldName),
        )
      }
    }
  })
}

export const deployChanges = async <T extends Change<ChangeDataType>>(
  changes: T[],
  deployChangeFunc: (change: T) => Promise<void | T>,
): Promise<DeployResult> => {
  const result = await Promise.all(
    changes.map(async (change): Promise<T | SaltoError> => {
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
    }),
  )
  const [errors, appliedChanges] = _.partition(result, isSaltoError)
  return { errors, appliedChanges }
}
