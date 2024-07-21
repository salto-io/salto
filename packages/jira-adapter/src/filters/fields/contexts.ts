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
import { client as clientUtils, resolveValues } from '@salto-io/adapter-components'
import { logger } from '@salto-io/logging'
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { defaultDeployChange } from '../../deployment/standard_deployment'
import { getLookUpName } from '../../reference_mapping'
import JiraClient from '../../client/client'
import { setContextOptions, setOptionTypeDeploymentAnnotations } from './context_options'
import { setDefaultValueTypeDeploymentAnnotations, updateDefaultValues } from './default_values'
import { setContextField } from './issues_and_projects'
import { setFieldDeploymentAnnotations } from '../../utils'
import { getAssetsContextId } from '../assets/assets_object_field_configuration'
import { JiraConfig } from '../../config/config'

const FIELDS_TO_IGNORE = ['defaultValue', 'options', 'isGlobalContext', 'AssetsObjectFieldConfiguration']

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

const deployAssetObjectContext = async (
  change: Change<InstanceElement>,
  client: JiraClient,
  config: JiraConfig,
): Promise<void> => {
  if (!config.fetch.enableAssetsObjectFieldConfiguration) {
    return
  }
  const instance = getChangeData(change)
  if (isRemovalChange(change) || instance.value.assetsObjectFieldConfiguration === undefined) {
    return
  }
  const { workspaceId } = instance.value.assetsObjectFieldConfiguration
  // we insert the workspaceId to the instance in assetsObjectFieldConfigurationFilter
  if (workspaceId === undefined) {
    log.error('Skip deployment of assetsObjectFieldConfiguration because workspaceId is undefined')
    throw new Error(
      `assetsObjectFieldConfiguration won't be deployed for instance ${instance.elemID.getFullName()}, due to error with the workspaceId. The context might be deployed partially.`,
    )
  }

  const assetContextId = getAssetsContextId(instance)
  const resolvedInstance = await resolveValues(instance, getLookUpName)
  try {
    await client.putPrivate({
      url: `rest/servicedesk/cmdb/latest/fieldconfig/${assetContextId}`,
      data: resolvedInstance.value.assetsObjectFieldConfiguration,
    })
  } catch (e) {
    log.error(`Failed to deploy asset object field configuration for instance ${instance.elemID.getFullName()}: ${e}`)
    throw new Error(
      `Failed to deploy asset object field configuration for instance ${instance.elemID.getFullName()}. The context might be deployed partially.`,
    )
  }
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
  await deployAssetObjectContext(change, client, config)
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
  setFieldDeploymentAnnotations(contextType, 'isGlobalContext')
  await setDefaultValueTypeDeploymentAnnotations(contextType)
  setFieldDeploymentAnnotations(contextType, 'issueTypeIds')
  await setOptionTypeDeploymentAnnotations(contextType)
}
