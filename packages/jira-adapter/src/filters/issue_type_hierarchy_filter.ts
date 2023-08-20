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

import { Change, InstanceElement, ReadOnlyElementsSource, getChangeData, isAdditionChange, isInstanceChange } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { ISSUE_TYPE_NAME } from '../constants'
import { FilterCreator } from '../filter'
import { isFreeLicense } from '../utils'

const { awu } = collections.asynciterable

const isRelevantChange = async (change: Change<InstanceElement>, elementsSource: ReadOnlyElementsSource):
    Promise<boolean> => {
  if (await isFreeLicense(elementsSource) === false
  && isAdditionChange(change) && change.data.after.value.hierarchyLevel > 0) {
    return true
  }
  return false
}

const filter: FilterCreator = ({ elementsSource }) => {
  const ISSUE_TYPE_TO_HIERARCHY_LEVEL: Record<string, number> = {}
  return {
    name: 'issueTypeHierarchyFilter',
    preDeploy: async changes => {
      await awu(changes)
        .filter(isInstanceChange)
        .filter(isAdditionChange)
        .filter(change => getChangeData(change).elemID.typeName === ISSUE_TYPE_NAME)
        .filter(change => isRelevantChange(change, elementsSource))
        .map(getChangeData)
        .forEach(instance => {
          ISSUE_TYPE_TO_HIERARCHY_LEVEL[instance.elemID.getFullName()] = instance.value.hierarchyLevel
          instance.value.hierarchyLevel = 0
        })
    },
    onDeploy: async changes => {
      await awu(changes)
        .filter(isInstanceChange)
        .filter(isAdditionChange)
        .map(getChangeData)
        .filter(instance => instance.elemID.typeName === ISSUE_TYPE_NAME)
        .filter(instance => Object.keys(ISSUE_TYPE_TO_HIERARCHY_LEVEL).includes(instance.elemID.getFullName()))
        .forEach(instance => {
          instance.value.hierarchyLevel = ISSUE_TYPE_TO_HIERARCHY_LEVEL[instance.elemID.getFullName()]
        })
    },
  }
}

export default filter
