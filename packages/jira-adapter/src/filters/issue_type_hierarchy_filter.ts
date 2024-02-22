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

import { getChangeData, isAdditionChange, isInstanceChange } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { ISSUE_TYPE_NAME } from '../constants'
import { FilterCreator } from '../filter'
import { isJiraSoftwareFreeLicense } from '../utils'

const { awu } = collections.asynciterable

const filter: FilterCreator = ({ elementsSource }) => {
  const IssueTypeTohierarchyLevel: Record<string, number> = {}
  return {
    name: 'issueTypeHierarchyFilter',
    preDeploy: async changes => {
      const isLicenseFree = await isJiraSoftwareFreeLicense(elementsSource)
      if (isLicenseFree) {
        return
      }

      await awu(changes)
        .filter(isInstanceChange)
        .filter(isAdditionChange)
        .map(getChangeData)
        .filter(instance => instance.elemID.typeName === ISSUE_TYPE_NAME)
        .filter(instance => instance.value.hierarchyLevel > 0)
        .forEach(instance => {
          IssueTypeTohierarchyLevel[instance.elemID.getFullName()] = instance.value.hierarchyLevel
          instance.value.hierarchyLevel = 0
        })
    },
    onDeploy: async changes => {
      await awu(changes)
        .filter(isInstanceChange)
        .map(getChangeData)
        .filter(instance => Object.keys(IssueTypeTohierarchyLevel).includes(instance.elemID.getFullName()))
        .forEach(instance => {
          instance.value.hierarchyLevel = IssueTypeTohierarchyLevel[instance.elemID.getFullName()]
        })
    },
  }
}

export default filter
