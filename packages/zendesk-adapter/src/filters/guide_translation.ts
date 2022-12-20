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
import { removedTranslationParentId } from './guide_section_and_category'

export const TRANSLATIONS_TYPE_NAME = ['section_translation', 'category_translation', 'article_translation']

const isDefaultTranslationAddition = (change: Change<InstanceElement>): boolean => {
  if (
    !isAdditionChange(change)
    || (!TRANSLATIONS_TYPE_NAME.includes(getChangeData(change).elemID.typeName))
  ) {
    return false
  }
  const data = getChangeData(change)
  const currentLocale = data.value.locale
  const parents = getParents(data) // the parent is not a reference expression
  return parents.some(parent => parent.source_locale?.value.value.locale === currentLocale)
}

const parentRemoved = (change: Change<InstanceElement>): boolean => {
  if (!TRANSLATIONS_TYPE_NAME.includes(getChangeData(change).elemID.typeName)) {
    return false
  }
  // the parent is not a reference expression
  return removedTranslationParentId.includes(getParents(getChangeData(change))[0].id)
}

const needToOmit = (change: Change<InstanceElement>): boolean =>
  isDefaultTranslationAddition(change) || parentRemoved(change)

/**
 * a different filter is needed for the default translation and translations for which the section
 * has been removed, as they are deployed during the deployment of the section itself. Therefore,
 * this filter marks these translations as successfully deployed without actually deploying them.
 * The rest of the translations will be deployed in the default deploy filter.
 */
const filterCreator: FilterCreator = () => ({
  deploy: async (changes: Change<InstanceElement>[]) => {
    const [translationChangesToIgnore, leftoverChanges] = _.partition(
      changes,
      needToOmit,
    )
    const deployResult: DeployResult = {
      appliedChanges: translationChangesToIgnore,
      errors: [],
    }
    return { deployResult, leftoverChanges }
  },
})
export default filterCreator
