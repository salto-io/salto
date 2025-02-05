/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  AdditionChange,
  Change,
  CORE_ANNOTATIONS,
  getChangeData,
  InstanceElement,
  isAdditionChange,
  isListType,
  isObjectType,
  isRemovalChange,
  ObjectType,
  ReadOnlyElementsSource,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import { client as clientUtils } from '@salto-io/adapter-components'
import { logger } from '@salto-io/logging'
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { defaultDeployChange } from '../../deployment/standard_deployment'
import JiraClient from '../../client/client'
import { setContextOptions, setOptionTypeDeploymentAnnotations } from './context_options'
import { setDefaultValueTypeDeploymentAnnotations, updateDefaultValues } from './default_values'
import { setContextField } from './issues_and_projects'
import { setFieldDeploymentAnnotations } from '../../utils'
import { deployAssetObjectContext } from '../assets/assets_object_field_configuration'
import { JiraConfig } from '../../config/config'

const FIELDS_TO_IGNORE = ['defaultValue', 'options', 'AssetsObjectFieldConfiguration']

const log = logger(module)

export const getContextType = async (fieldType: ObjectType): Promise<ObjectType> => {
  const contextMapType = await fieldType.fields.contexts.getType()
  if (!isListType(contextMapType)) {
    throw new Error(`type of ${fieldType.fields.contexts.elemID.getFullName()} is not a list type`)
  }

  const contextType = await contextMapType.getInnerType()
  if (!isObjectType(contextType)) {
    throw new Error(`inner type of ${fieldType.fields.contexts.elemID.getFullName()} is not an object type`)
  }

  return contextType
}

export const deployContextChange = async ({
  change,
  client,
  config,
  paginator,
  elementsSource,
}: {
  change: Change<InstanceElement>
  client: JiraClient
  config: JiraConfig
  paginator?: clientUtils.Paginator
  elementsSource?: ReadOnlyElementsSource
}): Promise<void> => {
  const fieldsToIgnore = isAdditionChange(change)
    ? FIELDS_TO_IGNORE
    : [...FIELDS_TO_IGNORE, 'issueTypeIds', 'projectIds']

  try {
    await defaultDeployChange({
      change,
      client,
      apiDefinitions: config.apiDefinitions,
      // 'issueTypeIds' can be deployed in the same endpoint as create
      // but for modify there are different endpoints for them
      fieldsToIgnore,
      elementsSource,
    })
  } catch (err) {
    if (isRemovalChange(change) && err instanceof clientUtils.HTTPError && err.response.status === 404) {
      return
    }
    throw err
  }

  await setContextField({
    contextChange: change,
    fieldName: 'issueTypeIds',
    endpoint: 'issuetype',
    client,
    elementsSource,
  })
  await setContextField({ contextChange: change, fieldName: 'projectIds', endpoint: 'project', client, elementsSource })
  if (!config.fetch.splitFieldContextOptions) {
    await setContextOptions(change, client, elementsSource, paginator)
    await updateDefaultValues(change, client, config, elementsSource)
  }
  await deployAssetObjectContext(change, client, config, elementsSource)
}

export const getContexts = async (
  fieldChange: AdditionChange<InstanceElement>,
  contextType: ObjectType,
  client: JiraClient,
): Promise<InstanceElement[]> => {
  const fieldInstance = getChangeData(fieldChange)
  const resp = await client.get({ url: `/rest/api/3/field/${fieldInstance.value.id}/context` })
  if (!Array.isArray(resp.data.values)) {
    log.warn(
      `Received unexpected response from Jira when querying contexts for instance ${getChangeData(fieldChange).elemID.getFullName()}: ${safeJsonStringify(resp.data.values)}`,
    )
    throw new Error(
      `Received unexpected response from Jira when querying contexts for instance ${getChangeData(fieldChange).elemID.getFullName()}`,
    )
  }
  return resp.data.values.map(
    values =>
      new InstanceElement(values.id, contextType, values, undefined, {
        [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(fieldInstance.elemID, fieldInstance)],
      }),
  )
}

export const setContextDeploymentAnnotations = async (contextType: ObjectType): Promise<void> => {
  setFieldDeploymentAnnotations(contextType, 'projectIds')
  await setDefaultValueTypeDeploymentAnnotations(contextType)
  setFieldDeploymentAnnotations(contextType, 'issueTypeIds')
  await setOptionTypeDeploymentAnnotations(contextType)
}
