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
import { removedSectionId } from './help_center_section'

const SECTION_TRANSLATION_TYPE_NAME = 'section_translation'

const isDefaultTranslationAddition = (change: Change<InstanceElement>): boolean => {
  if (
    !isAdditionChange(change)
    || (getChangeData(change).elemID.typeName !== SECTION_TRANSLATION_TYPE_NAME)
  ) {
    return false
  }
  const data = getChangeData(change)
  const currentLocale = data.value.locale
  const parents = getParents(data)
  return parents.find(parent => parent.source_locale?.value.value.id === currentLocale) ?? false
}

const sectionParentRemoved = (change: Change<InstanceElement>): boolean => {
  if (getChangeData(change).elemID.typeName !== SECTION_TRANSLATION_TYPE_NAME) {
    return false
  }
  return removedSectionId.includes(getParents(getChangeData(change))[0].id)
}

const needToOmit = (change: Change<InstanceElement>): boolean =>
  isDefaultTranslationAddition(change) || sectionParentRemoved(change)

/**
 * a different filter is needed for the default translation and translations for which the section
 * has been removed, as they are deployed during the deployment of the section itself. Therefore,
 * this filter marks these translations as successfully deployed without actually deploying them.
 * The rest of the translations will be deployed in the default deploy filter.
 */
const filterCreator: FilterCreator = () => ({
  deploy: async (changes: Change<InstanceElement>[]) => {
    const [sectionTranslationChangesToRemove, leftoverChanges] = _.partition(
      changes,
      needToOmit,
    )
    const deployResult: DeployResult = {
      appliedChanges: sectionTranslationChangesToRemove,
      errors: [],
    }
    return { deployResult, leftoverChanges }
  },
})
export default filterCreator
