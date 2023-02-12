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
import { InstanceElement, isInstanceElement } from '@salto-io/adapter-api'
import JiraClient from '../../../client/client'
import { PROJECT_TYPE } from '../../../constants'
import { FilterCreator } from '../../../filter'
import { isPrioritySchemeResponse } from './priority_scheme_deploy'

const getProjectPriorityScheme = async (instance: InstanceElement, client: JiraClient): Promise<number | undefined> => {
  const response = await client.getSinglePage({
    url: `/rest/api/2/project/${instance.value.id}/priorityscheme`,
  })

  return isPrioritySchemeResponse(response.data)
    ? response.data.id
    : undefined
}

const filter: FilterCreator = ({ client }) => ({
  name: 'prioritySchemeProjectAssociationFilter',
  onFetch: async elements => {
    if (!client.isDataCenter) {
      return
    }

    await Promise.all(elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === PROJECT_TYPE)
      .map(async instance => {
        instance.value.priorityScheme = await getProjectPriorityScheme(instance, client)
      }))
  },
})

export default filter
