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
import { isResolvedReferenceExpression } from '@salto-io/adapter-utils'
import {
  ReferenceExpression,
  isAdditionOrModificationChange,
  getChangeData,
  isInstanceChange,
} from '@salto-io/adapter-api'
import { FilterCreator } from '../../filter'
import { SCRIPTED_FIELD_TYPE } from '../../constants'

// This filter is used to add the issue type names to the scripted fields
const filter: FilterCreator = ({ config }) => ({
  name: 'scriptedFieldsIssueTypesFilter',
  preDeploy: async changes => {
    if (!config.fetch.enableScriptRunnerAddon) {
      return
    }
    changes
      .filter(isAdditionOrModificationChange)
      .filter(isInstanceChange)
      .map(getChangeData)
      .filter(instance => instance.elemID.typeName === SCRIPTED_FIELD_TYPE)
      .filter(instance => instance.value.issueTypes !== undefined)
      .forEach(instance => {
        instance.value.issueTypeIds = instance.value.issueTypes
          .filter(isResolvedReferenceExpression)
          .map((issueTypeId: ReferenceExpression) => issueTypeId.value.value.id)
      })
  },
  onDeploy: async changes => {
    if (!config.fetch.enableScriptRunnerAddon) {
      return
    }

    changes
      .filter(isAdditionOrModificationChange)
      .filter(isInstanceChange)
      .map(getChangeData)
      .filter(instance => instance.elemID.typeName === SCRIPTED_FIELD_TYPE)
      .forEach(instance => {
        delete instance.value.issueTypeIds
      })
  },
})
export default filter
