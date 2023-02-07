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
import { Change, getChangeData, InstanceElement, isAdditionChange, isInstanceChange, isInstanceElement } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { applyFunctionToChangeData } from '@salto-io/adapter-utils'
import { FilterCreator } from '../filter'
import { ISSUE_TYPE_NAME } from '../constants'

const { awu } = collections.asynciterable

const STANDARD_TYPE = 'standard'
const SUBTASK_TYPE = 'subtask'
const STANDARD_HIERARCHY_LEVEL = 0
const SUBTASK_HIERARCHY_LEVEL = -1

/**
 * Align the DC issue types values with the Cloud
 */
const filter: FilterCreator = ({ client }) => ({
  name: 'issueTypeFilter',
  onFetch: async elements => {
    const issueTypes = elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === ISSUE_TYPE_NAME)

    if (client.isDataCenter) {
      issueTypes.forEach(instance => {
        instance.value.hierarchyLevel = instance.value.subtask ? SUBTASK_HIERARCHY_LEVEL : STANDARD_HIERARCHY_LEVEL
      })
    }

    issueTypes.forEach(issueType => { delete issueType.value.subtask })
  },

  preDeploy: async changes => {
    if (!client.isDataCenter) {
      return
    }

    await awu(changes)
      .filter(isInstanceChange)
      .filter(isAdditionChange)
      .filter(change => getChangeData(change).elemID.typeName === ISSUE_TYPE_NAME)
      .forEach(change =>
        applyFunctionToChangeData<Change<InstanceElement>>(
          change,
          instance => {
            instance.value.type = instance.value.hierarchyLevel === SUBTASK_HIERARCHY_LEVEL
              ? SUBTASK_TYPE
              : STANDARD_TYPE
            delete instance.value.hierarchyLevel
            return instance
          }
        ))
  },

  onDeploy: async changes => {
    if (!client.isDataCenter) {
      return
    }

    await awu(changes)
      .filter(isInstanceChange)
      .filter(isAdditionChange)
      .filter(change => getChangeData(change).elemID.typeName === ISSUE_TYPE_NAME)
      .forEach(change =>
        applyFunctionToChangeData<Change<InstanceElement>>(
          change,
          instance => {
            instance.value.hierarchyLevel = instance.value.type === SUBTASK_TYPE
              ? SUBTASK_HIERARCHY_LEVEL
              : STANDARD_HIERARCHY_LEVEL
            delete instance.value.type
            return instance
          }
        ))
  },
})

export default filter
