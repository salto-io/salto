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
  AdditionChange,
  Change, getChangeData, InstanceElement, isAdditionChange, isInstanceChange, ModificationChange,
} from '@salto-io/adapter-api'
import { createSchemeGuard } from '@salto-io/adapter-utils'
import { config as configUtils, client as clientUtils } from '@salto-io/adapter-components'
import { collections } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../../filter'
import { deployChange, deployChanges } from '../../deployment'

const { toArrayAsync } = collections.asynciterable
const { makeArray } = collections.array

const log = logger(module)

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

const getTranslations = async (
  paginator: clientUtils.Paginator,
  requestConfig: configUtils.FetchRequestConfig
): Promise<Record<string, Translation[]>> => {
  const translations = (await toArrayAsync(
    paginator(requestConfig, page => makeArray(page) as clientUtils.ResponseValue[])
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

/**
 * Deploys Zendesk Guide' translations
 */
export const createTranslationFilterCreator = (
  { parentTypeName, childTypeName }: TranslationFilterFilterCreatorParams
): FilterCreator => ({ config, client, paginator }) => ({
  deploy: async (changes: Change<InstanceElement>[]) => {
    const fixAdditionChanges = async (additionChanges: AdditionChange<InstanceElement>[]):
      Promise<(AdditionChange<InstanceElement> | ModificationChange<InstanceElement>)[]> => {
      if (_.isEmpty(additionChanges)) {
        return []
      }
      const localeToTranslations = await getTranslations(
        paginator,
        config.apiDefinitions
          .types[childTypeName].request as configUtils.FetchRequestConfig
      )
      return additionChanges.map(change => {
        const { locale } = getChangeData(change).value
        const translations = Object.prototype.hasOwnProperty.call(localeToTranslations, locale)
          ? localeToTranslations[locale]
          : undefined
        if (translations === undefined) {
          return change
        }
        getChangeData(change).value.id = translations[0].id
        const translation = getChangeData(change)
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
    const [translationAdditionChanges, translationNonAdditionChanges] = _.partition(
      translationChanges,
      isAdditionChange
    )
    const fixedAdditionChanges = await fixAdditionChanges(translationAdditionChanges)
    const deployTranslationsResult = await deployChanges(
      [...fixedAdditionChanges, ...translationNonAdditionChanges],
      async change => {
        await deployChange(change, client, config.apiDefinitions)
      }
    )
    log.info('TEST')
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
