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
import _ from 'lodash'
import Joi from 'joi'
import {
  AdditionChange, Change, getChangeData, InstanceElement, isAdditionChange,
  isAdditionOrModificationChange, isInstanceChange, isRemovalChange, ModificationChange,
} from '@salto-io/adapter-api'
import { createSchemeGuard, getParents } from '@salto-io/adapter-utils'
import { config as configUtils, client as clientUtils } from '@salto-io/adapter-components'
import { collections } from '@salto-io/lowerdash'
import { FilterCreator } from '../../filter'
import { deployChange, deployChanges } from '../../deployment'

const { toArrayAsync } = collections.asynciterable
const { makeArray } = collections.array

type TranslationFilterFilterCreatorParams = {
  parentTypeName: string
  childTypeName: string
}

type Translation = {
  id: number
  locale: string
}

const TRANSLATION_SCHEME = Joi.array().items(
  Joi.object({
    id: Joi.number().required(),
    locale: Joi.string().required(),
  }).unknown(true)
)

const isTranslations = createSchemeGuard<Translation[]>(TRANSLATION_SCHEME, 'Found an invalid translation')

const getTranslations = async ({
  paginator, requestConfig, categoryId,
}: {
  paginator: clientUtils.Paginator
  requestConfig: configUtils.FetchRequestConfig
  categoryId: number
}): Promise<Record<string, Translation[]>> => {
  const fixedRequestConfig = {
    ...requestConfig,
    url: `/help_center/categories/${categoryId}/translations`,
  }
  const translations = (await toArrayAsync(
    paginator(fixedRequestConfig, page => makeArray(page) as clientUtils.ResponseValue[])
  )).flat().flatMap(response => response.translations)
  if (!isTranslations(translations)) {
    throw new Error('Failed to deploy translations, since we got invalid translations values from the service')
  }
  const localeToTranslations = _.groupBy(
    translations,
    translation => translation.locale
  )
  const multipleTranslationsPerLocale = _.pickBy(
    localeToTranslations, localeTranslations => localeTranslations.length > 1
  )
  if (!_.isEmpty(multipleTranslationsPerLocale)) {
    throw new Error(
      `Failed to deploy translations, since we got duplicate translations per locales for the following locales: ${
        Object.keys(multipleTranslationsPerLocale).join(', ')}`
    )
  }
  return localeToTranslations
}

const addIdToTranslation = (
  translation: InstanceElement,
  categoryId: number,
  translationId: number,
): void => {
  translation.value.id = translationId
  const parents = getParents(translation)
  if (parents.length === 1) {
    parents[0].id = categoryId
  }
}

/**
 * Deploys Zendesk Guide' translations
 */
export const createTranslationFilterCreator = (
  { parentTypeName, childTypeName }: TranslationFilterFilterCreatorParams
): FilterCreator => ({ config, client, paginator }) => ({
  deploy: async (changes: Change<InstanceElement>[]) => {
    const fixAdditionChanges = async (
      additionChanges: AdditionChange<InstanceElement>[],
      parent: InstanceElement
    ): Promise<(AdditionChange<InstanceElement> | ModificationChange<InstanceElement>)[]> => {
      if (_.isEmpty(additionChanges)) {
        return []
      }
      const categoryId = parent.value.id
      const localeToTranslations = await getTranslations({
        paginator,
        requestConfig: config.apiDefinitions
          .types[childTypeName].request as configUtils.FetchRequestConfig,
        categoryId,
      })
      return additionChanges.map(change => {
        const { locale } = getChangeData(change).value
        const translations = Object.prototype.hasOwnProperty.call(localeToTranslations, locale)
          ? localeToTranslations[locale]
          : undefined
        if (translations === undefined) {
          return change
        }
        const translation = getChangeData(change)
        addIdToTranslation(translation, categoryId, translations[0].id)
        return { action: 'modify', data: { after: translation, before: translation } }
      })
    }
    const [relevantChanges, leftoverChanges] = _.partition(
      changes,
      change => [parentTypeName, childTypeName]
        .includes(getChangeData(change).elemID.typeName),
    )
    const [parentChanges, translationChanges] = _.partition(
      relevantChanges,
      change => getChangeData(change).elemID.typeName === parentTypeName
    )

    const deployParentResult = await deployChanges(
      parentChanges,
      async change => {
        await deployChange(change, client, config.apiDefinitions, ['translations'])
      }
    )
    if (!_.isEmpty(parentChanges.filter(isRemovalChange))) {
      return {
        deployResult: {
          appliedChanges: deployParentResult.appliedChanges.concat(translationChanges),
          errors: deployParentResult.errors,
        },
        leftoverChanges,
      }
    }
    const [translationAdditionChanges, translationNonAdditionChanges] = _.partition(
      translationChanges,
      isAdditionChange
    )
    const fixedAdditionChanges = _.isEmpty(deployParentResult.appliedChanges
      .filter(isInstanceChange)
      .filter(isAdditionOrModificationChange))
      ? translationAdditionChanges
      : await fixAdditionChanges(
        translationAdditionChanges,
        // There can be only one appliedChange, because there cannot be two
        // deployed categories with the same id (the group change id is the id of the category)
        getChangeData(deployParentResult.appliedChanges[0]) as InstanceElement
      )
    const deployTranslationsResult = await deployChanges(
      [...fixedAdditionChanges, ...translationNonAdditionChanges],
      async change => {
        await deployChange(change, client, config.apiDefinitions)
      }
    )
    const appliedAdditionTranslations = translationAdditionChanges
      .filter(change => getChangeData(change).value.id)
      .concat(deployTranslationsResult.appliedChanges
        .filter(isInstanceChange).filter(isAdditionChange))
    return {
      deployResult: {
        appliedChanges: deployParentResult.appliedChanges.concat(appliedAdditionTranslations),
        errors: deployParentResult.errors.concat(deployTranslationsResult.errors),
      },
      leftoverChanges,
    }
  },
})
