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
import { Change, Element, getChangeData, isAdditionChange, isInstanceChange, isInstanceElement } from '@salto-io/adapter-api'
import { FilterCreator } from '../filter'

const PROJECT_TYPE_NAME = 'Project'

/**
 * Restructures Project type to fit the deployment endpoint
 */
const filter: FilterCreator = () => ({
  onFetch: async (elements: Element[]) => {
    elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === PROJECT_TYPE_NAME)
      .forEach(instance => {
        instance.value.leadAccountId = instance.value.lead?.accountId
        delete instance.value.lead

        instance.value.workflowScheme = instance.value.workflowScheme?.workflowScheme
          ?.id?.toString()
        instance.value.issueTypeScreenScheme = instance.value.issueTypeScreenScheme
          ?.issueTypeScreenScheme?.id
        instance.value.fieldConfigurationScheme = instance.value.fieldConfigurationScheme
          ?.fieldConfigurationScheme?.id

        instance.value.notificationScheme = instance.value.notificationScheme?.id?.toString()
        instance.value.permissionScheme = instance.value.permissionScheme?.id?.toString()
      })
  },

  onDeploy: async (changes: Change<Element>[]) => {
    changes
      .filter(isAdditionChange)
      .filter(isInstanceChange)
      .map(getChangeData)
      .filter(instance => instance.elemID.typeName === PROJECT_TYPE_NAME)
      .forEach(instance => {
        instance.value.id = instance.value.id?.toString()
      })
  },
})

export default filter
