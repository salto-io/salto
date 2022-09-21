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
import {
  Change, DeployResult,
  getChangeData,
  InstanceElement, isAdditionChange,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { getParents } from '@salto-io/adapter-utils'
import { FilterCreator } from '../filter'

const isDefaultTranslationAddition = (change: Change<InstanceElement>): boolean => {
  if (!isAdditionChange(change)) {
    return false
  }
  const data = getChangeData(change)
  const currentLocale = data.value.locale
  const parents = getParents(data)
  return parents.find(parent => parent.source_locale?.value.value.id === currentLocale) ?? false
}

/**
 * a different filter is needed for the default translation as it is deployed during the deployment
 * of the section itself. Therefor, this filter removes the default translation from the
 * leftover changes.
 */
const filterCreator: FilterCreator = () => ({
  deploy: async (changes: Change<InstanceElement>[]) => {
    const [sectionDefaultTranslationChanges, leftoverChanges] = _.partition(
      changes,
      isDefaultTranslationAddition,
    )
    const deployResult: DeployResult = {
      appliedChanges: sectionDefaultTranslationChanges,
      errors: [],
    }
    return { deployResult, leftoverChanges }
  },
})
export default filterCreator
