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
import { Change, getChangeData, InstanceElement, isModificationChange, ObjectType } from '@salto-io/adapter-api'
import { resolveChangeElement } from '@salto-io/adapter-utils'
import { client as clientUtils } from '@salto-io/adapter-components'
import { getLookUpName } from '../../references'
import { setDeploymentAnnotations } from './utils'

// Works for issuesIds and projectsIds
export const setContextField = async (
  contextChange: Change<InstanceElement>,
  fieldName: string,
  endpoint: string,
  parentField: InstanceElement,
  client: clientUtils.HTTPWriteClientInterface
): Promise<void> => {
  const resolvedChange = await resolveChangeElement(contextChange, getLookUpName)
  if (!isModificationChange(resolvedChange)) {
    // In create the issue types and projects ids are created
    // with the same request the context is created with
    // In remove, all the values are removed with the same request
    // so no need to do anything here
    return
  }
  const contextInstance = getChangeData(resolvedChange)
  const afterIds = new Set(contextInstance.value[fieldName] ?? [])
  const beforeIds = new Set(resolvedChange.data.before.value[fieldName] ?? [])

  const addedIds = Array.from(afterIds).filter(id => !beforeIds.has(id))
  const removedIds = Array.from(beforeIds).filter(id => !afterIds.has(id))

  if (addedIds.length !== 0) {
    await client.put({
      url: `/rest/api/3/field/${parentField.value.id}/context/${contextInstance.value.id}/${endpoint}`,
      data: {
        [fieldName]: addedIds,
      },
    })
  }

  if (removedIds.length !== 0) {
    await client.post({
      url: `/rest/api/3/field/${parentField.value.id}/context/${contextInstance.value.id}/${endpoint}/remove`,
      data: {
        [fieldName]: removedIds,
      },
    })
  }
}

export const setProjectsDeploymentAnnotations = (contextType: ObjectType): void => setDeploymentAnnotations(contextType, 'projectIds')

export const setIssueTypesDeploymentAnnotations = (contextType: ObjectType): void => setDeploymentAnnotations(contextType, 'issueTypeIds')
