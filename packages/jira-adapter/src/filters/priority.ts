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
import { CORE_ANNOTATIONS, Element, getChangeData, isAdditionOrModificationChange, isInstanceChange, Change, ChangeDataType } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { findObject, setFieldDeploymentAnnotations } from '../utils'
import { FilterCreator } from '../filter'
import { PRIORITY_TYPE_NAME } from '../constants'
import { removeDomainPrefix } from './avatars'

const log = logger(module)
const filter: FilterCreator = ({ client, config }) => ({
  onFetch: async (elements: Element[]) => {
    if (!config.client.usePrivateAPI) {
      log.debug('Skipping priority filter because private API is not enabled')
      return
    }

    const priorityType = findObject(elements, PRIORITY_TYPE_NAME)
    if (priorityType === undefined) {
      return
    }
    priorityType.annotations[CORE_ANNOTATIONS.CREATABLE] = true
    priorityType.annotations[CORE_ANNOTATIONS.UPDATABLE] = true
    setFieldDeploymentAnnotations(priorityType, 'id')
    setFieldDeploymentAnnotations(priorityType, 'statusColor')
    setFieldDeploymentAnnotations(priorityType, 'description')
    setFieldDeploymentAnnotations(priorityType, 'iconUrl')
    setFieldDeploymentAnnotations(priorityType, 'name')
  },

  preDeploy: async (changes: Change<ChangeDataType>[]) => {
    changes.filter(isInstanceChange)
      .filter(isAdditionOrModificationChange)
      .filter(change => getChangeData(change).elemID.typeName === PRIORITY_TYPE_NAME)
      .forEach(change => {
        change.data.after.value.iconUrl = new URL(
          getChangeData(change).value.iconUrl.toString(), client.baseUrl
        ).href
      })
  },

  onDeploy: async (changes: Change<ChangeDataType>[]) => {
    changes.filter(isInstanceChange)
      .filter(isAdditionOrModificationChange)
      .filter(change => getChangeData(change).elemID.typeName === PRIORITY_TYPE_NAME)
      .forEach(change => {
        change.data.after.value.iconUrl = removeDomainPrefix(
          getChangeData(change).value.iconUrl, client.baseUrl
        )
      })
  },
})

export default filter
