/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import {
  Change,
  ElemID,
  getChangeData,
  InstanceElement,
  ReadOnlyElementsSource,
  isAdditionOrModificationChange,
  isRemovalChange,
} from '@salto-io/adapter-api'
import { applyFunctionToChangeDataSync, inspectValue } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { createUrl } from '../fetch/resource'
import { HTTPError, HTTPReadClientInterface, HTTPWriteClientInterface } from '../client/http_client'
import { DeploymentRequestsByAction } from '../config_deprecated'
import { ResponseValue } from '../client'
import { filterIgnoredValues, filterUndeployableValues } from './filtering'
import { recursiveNaclCase } from '../fetch/element'

const log = logger(module)

export type ResponseResult = ResponseValue | ResponseValue[] | undefined

/**
 * Deploy a single change to the service using the given details
 *
 * @param change The change to deploy. The change is expected to be fully resolved
 * (meaning without any ReferenceExpression or StaticFiles)
 * @param client The client to use to make the request
 * @param endpointDetails The details of of what endpoints to use for each action
 * @param fieldsToIgnore Fields to omit for the deployment
 * @param additionalUrlVars Additional url vars to add to the request url
 * @param queryParams Query params to add to the request url
 * @returns: The response data of the request
 */
export const deployChange = async ({
  change,
  client,
  endpointDetails,
  fieldsToIgnore = [],
  additionalUrlVars,
  queryParams,
  elementsSource,
  allowedStatusCodesOnRemoval = [],
}: {
  change: Change<InstanceElement>
  client: HTTPWriteClientInterface & HTTPReadClientInterface
  endpointDetails?: DeploymentRequestsByAction
  fieldsToIgnore?: string[] | ((path: ElemID) => boolean)
  additionalUrlVars?: Record<string, string>
  queryParams?: Record<string, string>
  elementsSource?: ReadOnlyElementsSource
  allowedStatusCodesOnRemoval?: number[]
}): Promise<ResponseResult> => {
  const instance = getChangeData(
    applyFunctionToChangeDataSync(change, changeInstance => {
      changeInstance.value = recursiveNaclCase(changeInstance.value, true)
      return changeInstance
    }),
  )
  log.debug(`Starting deploying instance ${instance.elemID.getFullName()} with action '${change.action}'`)
  const endpoint = endpointDetails?.[change.action]
  if (endpoint === undefined) {
    throw new Error(`No endpoint of type ${change.action} for ${instance.elemID.typeName}`)
  }
  const valuesToDeploy = (
    await filterIgnoredValues(
      await filterUndeployableValues(getChangeData(change), change.action, elementsSource),
      fieldsToIgnore,
      endpoint.fieldsToIgnore,
      elementsSource,
    )
  ).value

  const url = createUrl({
    instance,
    url: endpoint.url,
    urlParamsToFields: endpoint.urlParamsToFields,
    additionalUrlVars,
  })
  const data = endpoint.deployAsField ? { [endpoint.deployAsField]: valuesToDeploy } : valuesToDeploy

  if (_.isEmpty(valuesToDeploy) && isAdditionOrModificationChange(change)) {
    return undefined
  }
  log.trace(
    `deploying instance ${instance.elemID.getFullName()} with params ${inspectValue({ method: endpoint.method, url, queryParams }, { compact: true, depth: 6 })}`,
  )
  try {
    const response = await client[endpoint.method]({
      url,
      data: endpoint.omitRequestBody ? undefined : data,
      queryParams,
    })
    return response.data
  } catch (error) {
    if (
      isRemovalChange(change) &&
      error instanceof HTTPError &&
      allowedStatusCodesOnRemoval.includes(error.response.status)
    ) {
      log.debug('%s was deleted and therefore marked as deployed', getChangeData(change).elemID.getFullName())
      return undefined
    }
    throw error
  }
}
