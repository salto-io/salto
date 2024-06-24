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
  Change,
  getChangeData,
  InstanceElement,
  isModificationChange,
  ReadOnlyElementsSource,
} from '@salto-io/adapter-api'
import { getParents } from '@salto-io/adapter-utils'
import { client as clientUtils, resolveChangeElement, resolveValues } from '@salto-io/adapter-components'
import { getLookUpName } from '../../reference_mapping'
import { getDiffIds } from '../../diff'

// Works for issuesIds and projectsIds
export const setContextField = async ({
  contextChange,
  fieldName,
  endpoint,
  client,
  elementsSource,
}: {
  contextChange: Change<InstanceElement>
  fieldName: string
  endpoint: string
  client: clientUtils.HTTPWriteClientInterface
  elementsSource?: ReadOnlyElementsSource
}): Promise<void> => {
  const resolvedChange = await resolveChangeElement(contextChange, getLookUpName, resolveValues, elementsSource)
  if (!isModificationChange(resolvedChange)) {
    // In create the issue types and projects ids are created
    // with the same request the context is created with
    // In remove, all the values are removed with the same request
    // so no need to do anything here
    return
  }
  const contextInstance = getChangeData(resolvedChange)

  const { addedIds, removedIds } = getDiffIds(
    resolvedChange.data.before.value[fieldName] ?? [],
    contextInstance.value[fieldName] ?? [],
  )

  const fieldId = getParents(contextInstance)[0].id

  if (addedIds.length !== 0) {
    await client.put({
      url: `/rest/api/3/field/${fieldId}/context/${contextInstance.value.id}/${endpoint}`,
      data: {
        [fieldName]: addedIds,
      },
    })
  }

  if (removedIds.length !== 0) {
    await client.post({
      url: `/rest/api/3/field/${fieldId}/context/${contextInstance.value.id}/${endpoint}/remove`,
      data: {
        [fieldName]: removedIds,
      },
    })
  }
}
