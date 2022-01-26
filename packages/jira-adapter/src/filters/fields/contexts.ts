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
import { AdditionChange, Change, CORE_ANNOTATIONS, getChangeData, InstanceElement, isAdditionChange, isListType, isObjectType, isRemovalChange, ObjectType, ReferenceExpression } from '@salto-io/adapter-api'
import { config, client as clientUtils } from '@salto-io/adapter-components'
import { logger } from '@salto-io/logging'
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { defaultDeployChange } from '../../deployment'
import JiraClient from '../../client/client'
import { setContextOptions, setOptionTypeDeploymentAnnotations } from './context_options'
import { setDefaultValueTypeDeploymentAnnotations, updateDefaultValues } from './default_values'
import { setContextField } from './issues_and_projects'
import { setDeploymentAnnotations } from '../../utils'

const FIELDS_TO_IGNORE = ['defaultValue', 'options']

const log = logger(module)


export const getContextType = async (fieldType: ObjectType):
Promise<ObjectType> => {
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

export const deployContextChange = async (
  change: Change<InstanceElement>,
  client: JiraClient,
  apiDefinitions: config.AdapterApiConfig,
): Promise<void> => {
  try {
    await defaultDeployChange({
      change,
      client,
      apiDefinitions,
      // 'issueTypeIds', 'projectIds' can be deployed in the same endpoint as create
      // but for modify there are different endpoints for them
      fieldsToIgnore: isAdditionChange(change) ? FIELDS_TO_IGNORE : [...FIELDS_TO_IGNORE, 'issueTypeIds', 'projectIds'],
    })
  } catch (err) {
    if (isRemovalChange(change)
      && err instanceof clientUtils.HTTPError
      && Array.isArray(err.response.data.errorMessages)
      && err.response.data.errorMessages.includes('The custom field was not found.')
    ) {
      return
    }
    throw err
  }

  await setContextField({ contextChange: change, fieldName: 'issueTypeIds', endpoint: 'issuetype', client })
  await setContextField({ contextChange: change, fieldName: 'projectIds', endpoint: 'project', client })
  await setContextOptions(change, client)
  await updateDefaultValues(change, client)
}

export const getContexts = async (
  fieldChange: AdditionChange<InstanceElement>,
  contextType: ObjectType,
  client: JiraClient,
): Promise<InstanceElement[]> => {
  const fieldInstance = getChangeData(fieldChange)
  const resp = await client.getSinglePage({ url: `/rest/api/3/field/${fieldInstance.value.id}/contexts` })
  if (!Array.isArray(resp.data.values)) {
    log.warn(`Received unexpected response from Jira when querying contexts for instance ${getChangeData(fieldChange).elemID.getFullName()}: ${safeJsonStringify(resp.data.values)}`)
    throw new Error(`Received unexpected response from Jira when querying contexts for instance ${getChangeData(fieldChange).elemID.getFullName()}`)
  }
  return resp.data.values.map(values => new InstanceElement(
    values.id,
    contextType,
    values,
    undefined,
    {
      [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(fieldInstance.elemID, fieldInstance)],
    }
  ))
}

export const setContextDeploymentAnnotations = async (
  contextType: ObjectType,
): Promise<void> => {
  await setDefaultValueTypeDeploymentAnnotations(contextType)
  setDeploymentAnnotations(contextType, 'projectIds')
  setDeploymentAnnotations(contextType, 'issueTypeIds')
  await setOptionTypeDeploymentAnnotations(contextType)
}
