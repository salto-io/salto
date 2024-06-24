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
import {
  Change,
  DeployResult,
  getChangeData,
  InstanceElement,
  isAdditionChange,
  isInstanceElement,
  toChange,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { getParents } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../filter'
import { removedTranslationParentId } from './guide_section_and_category'
import { ARTICLE_TRANSLATION_TYPE_NAME, GUIDE_LANGUAGE_SETTINGS_TYPE_NAME, TRANSLATION_TYPE_NAMES } from '../constants'
import { deployChange, deployChanges } from '../deployment'

const log = logger(module)
const { awu } = collections.asynciterable

const isDefaultTranslationAddition = (
  change: Change<InstanceElement>,
  languageSettingsByIds: Record<string, InstanceElement>,
): boolean => {
  if (!isAdditionChange(change) || !TRANSLATION_TYPE_NAMES.includes(getChangeData(change).elemID.typeName)) {
    return false
  }
  const data = getChangeData(change)
  const currentLocale = data.value.locale
  const parents = getParents(data) // the parent is not a reference expression
  return parents.some(parent => {
    const sourceLocaleName = parent.source_locale?.elemID.name
    if (sourceLocaleName === undefined) {
      log.warn(`could not get name from source locale for parent of ${data.elemID.getFullName()}`)
      return false
    }
    const sourceLocaleInstance = languageSettingsByIds[sourceLocaleName]
    if (!isInstanceElement(sourceLocaleInstance)) {
      log.warn(`could not get sourceLocaleInstance for parent of ${data.elemID.getFullName()}`)
      return false
    }
    return sourceLocaleInstance.value.locale === currentLocale
  })
}

const parentRemoved = (change: Change<InstanceElement>): boolean => {
  if (!TRANSLATION_TYPE_NAMES.includes(getChangeData(change).elemID.typeName)) {
    return false
  }
  // the parent is not a reference expression
  return removedTranslationParentId.includes(getParents(getChangeData(change))[0].id)
}

const needToOmit = (change: Change<InstanceElement>, languageSettingsByIds: Record<string, InstanceElement>): boolean =>
  isDefaultTranslationAddition(change, languageSettingsByIds) || parentRemoved(change)

/**
 * a different filter is needed for the default translation and translations for which the parent
 * has been removed, as they are deployed during the deployment of the parent itself. Therefore,
 * this filter marks translations as successfully deployed without actually deploying them.
 * For addition of default article translation, as we deploy the article with a temporary title and body,
 * we transform the change to a modification change and deploy it in this way.
 * The rest of the translations will be deployed in the default deploy filter.
 */
const filterCreator: FilterCreator = ({ config, client, elementsSource }) => ({
  name: 'guideTranslationFilter',
  deploy: async (changes: Change<InstanceElement>[]) => {
    const translationInstances = changes.filter(change =>
      TRANSLATION_TYPE_NAMES.includes(getChangeData(change).elemID.typeName),
    )
    if (_.isEmpty(translationInstances)) {
      log.debug('there are no translation instances, not running guideTranslationFilter')
      return {
        deployResult: {
          appliedChanges: [],
          errors: [],
        },
        leftoverChanges: changes,
      }
    }
    const guideLanguageSettingsInstances = await awu(await elementsSource.list())
      .filter(id => id.typeName === GUIDE_LANGUAGE_SETTINGS_TYPE_NAME)
      .map(async id => elementsSource.get(id))
      .toArray()
    log.debug(`there are ${guideLanguageSettingsInstances.length} guide language setting instances`)
    const languageSettingsByIds = _.keyBy(guideLanguageSettingsInstances, instance => instance.elemID.name)
    const [translationChangesToIgnore, leftoverChanges] = _.partition(changes, change =>
      needToOmit(change, languageSettingsByIds),
    )
    // split default article translation addition changes out of changes to ignore
    const [defaultArticleTranslationAdditionChanges, otherTranslationChanges] = _.partition(
      translationChangesToIgnore,
      change =>
        getChangeData(change).elemID.typeName === ARTICLE_TRANSLATION_TYPE_NAME &&
        isDefaultTranslationAddition(change, languageSettingsByIds),
    )

    // creating modification changes from the addition of default article translations
    const defaultArticleTranslationModificationChanges = defaultArticleTranslationAdditionChanges
      .map(getChangeData)
      .map(instance => toChange({ before: instance, after: instance }))

    // deploy the created modification changes
    const articleTranslationDeployResult = await deployChanges(
      defaultArticleTranslationModificationChanges,
      async change => {
        await deployChange(change, client, config.apiDefinitions)
      },
    )
    const successfulModificationDeployChangesSet = new Set(
      articleTranslationDeployResult.appliedChanges.map(change => getChangeData(change).elemID.name),
    )

    // filtering from the addition changes only the changes for which the deploy of the modification was successful
    const successfulAdditionDeployChanges = defaultArticleTranslationAdditionChanges.filter(change =>
      successfulModificationDeployChangesSet.has(getChangeData(change).elemID.name),
    )

    const deployResult: DeployResult = {
      appliedChanges: otherTranslationChanges.concat(successfulAdditionDeployChanges),
      errors: articleTranslationDeployResult.errors,
    }
    return { deployResult, leftoverChanges }
  },
})
export default filterCreator
