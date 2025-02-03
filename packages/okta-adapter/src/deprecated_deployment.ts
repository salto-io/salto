/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
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
  isEqualValues,
  AdditionChange,
  ElemID,
  isSaltoError,
  SaltoError,
  isRemovalChange,
  isServiceId,
} from '@salto-io/adapter-api'
import {
  deployment,
  elements as elementUtils,
  client as clientUtils,
  fetch as fetchUtils,
} from '@salto-io/adapter-components'
import { createSchemeGuard, createSaltoElementError } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { promises } from '@salto-io/lowerdash'
import { ACTIVE_STATUS, INACTIVE_STATUS, NETWORK_ZONE_TYPE_NAME } from './constants'
import { OktaSwaggerApiConfig } from './config'
import { StatusActionName } from './definitions/types'
import { isDeactivationChange } from './definitions/deploy/utils/status'

const log = logger(module)

const { createUrl } = fetchUtils.resource

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

export const isActivation = ({ before, after }: { before: string; after: string }): boolean =>
  before === INACTIVE_STATUS && after === ACTIVE_STATUS

export const isDeactivation = ({ before, after }: { before: string; after: string }): boolean =>
  before === ACTIVE_STATUS && after === INACTIVE_STATUS

const DEACTIVATE_BEFORE_REMOVAL_TYPES = new Set([NETWORK_ZONE_TYPE_NAME])
const shouldDeactivateBeforeRemoval = (change: Change<InstanceElement>): boolean =>
  isRemovalChange(change) && DEACTIVATE_BEFORE_REMOVAL_TYPES.has(getChangeData(change).elemID.typeName)

const deployStatusChange = async (
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

/**
 * Deploy change with the standard "add", "modify", "remove" endpoints
 */
const defaultDeployChange = async (
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

  if (apiDefinitions.types[getChangeData(change).elemID.typeName] === undefined) {
    throw new Error(`No deployment configuration found for type ${getChangeData(change).elemID.typeName}`)
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
      if (isActivation({ before: response.status, after: changeStatus })) {
        log.debug(
          `Instance ${getChangeData(change).elemID.getFullName()} created in status ${INACTIVE_STATUS}, changing to ${ACTIVE_STATUS}`,
        )
        await deployStatusChange(change, client, apiDefinitions, 'activate')
      } else if (isDeactivation({ before: response.status, after: changeStatus })) {
        log.debug(
          `Instance ${getChangeData(change).elemID.getFullName()} created in status ${ACTIVE_STATUS}, changing to ${INACTIVE_STATUS}`,
        )
        await deployStatusChange(change, client, apiDefinitions, 'deactivate')
      }
    }

    // If the instance is activated, we should first make the changes and then change the status
    if (
      isModificationChange(change) &&
      isActivation({ before: change.data.before.value.status, after: change.data.after.value.status })
    ) {
      await deployStatusChange(change, client, apiDefinitions, 'activate')
    }

    return response
  } catch (err) {
    throw getOktaError(getChangeData(change).elemID, err)
  }
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
          detailedMessage: err.message,
          severity: 'Error',
          elemID: getChangeData(change).elemID,
        })
      }
    }),
  )
  const [errors, appliedChanges] = _.partition(result, isSaltoError)
  return { errors, appliedChanges }
}
