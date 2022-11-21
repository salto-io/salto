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
  BuiltinTypes, Change,
  Element, Field, getChangeData,
  InstanceElement, isInstanceChange,
  isInstanceElement, isObjectType,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import Joi from 'joi'
import { createSchemeGuardForInstance } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../filter'
import { deployChange, deployChanges } from '../deployment'
import { TRANSLATIONS_TYPE_NAME } from './guide_translation'
import { GUIDE_LANGUAGE_SETTINGS_TYPE_NAME } from '../constants'


export const GUIDE_TRANSLATION_FIELD = 'guide_translation'
const log = logger(module)

type GuideLanguageSettingsType = InstanceElement & {
  value: {
    locale: string
    name: string
    brand: number
  }
}

const GUIDE_LANGUAGE_SETTINGS_SCHEMA = Joi.object({
  locale: Joi.string().required(),
  name: Joi.string().required(),
  brand: Joi.number().required(),
}).unknown(true).required()

const isGuideLanguageSetting = createSchemeGuardForInstance<GuideLanguageSettingsType>(
  GUIDE_LANGUAGE_SETTINGS_SCHEMA, 'Received an invalid value for guide_language_translation'
)

const brandAndLocale = (brand: number, locale: string): string => `${brand}-${locale}`

/**
 * This filter adds a field of guide_translation to all translations onFetch. The field is a
 * reference expression to guide_language_settings. The reference is added so that during deploy the
 * user will know if they need to add a language that is not currently supported.
 */
const filterCreator: FilterCreator = ({ client, config }) => ({
  onFetch: async (elements: Element[]): Promise<void> => {
    const guideTranslations: GuideLanguageSettingsType[] = elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === GUIDE_LANGUAGE_SETTINGS_TYPE_NAME)
      .filter(isGuideLanguageSetting)

    const guideTranslationsRecord: Record<string, GuideLanguageSettingsType> = _.keyBy(
      guideTranslations,
      translation => brandAndLocale(translation.value.brand, translation.value.locale)
    )

    elements
      .filter(isInstanceElement)
      .filter(instance => TRANSLATIONS_TYPE_NAME.includes(instance.elemID.typeName))
      .forEach(instance => {
        const localeName = brandAndLocale(instance.value.brand, instance.value.locale)
        const guideTranslation: GuideLanguageSettingsType = guideTranslationsRecord[localeName]
        if (guideTranslation === undefined) {
          log.debug('could not find a guide translation for brand %s and locale %s.', instance.value.brand, instance.value.locale)
          return
        }
        instance.value[GUIDE_TRANSLATION_FIELD] = new ReferenceExpression(
          guideTranslation.elemID,
          guideTranslation,
        )
      })

    elements
      .filter(isObjectType)
      .filter(obj => TRANSLATIONS_TYPE_NAME.includes(obj.elemID.typeName))
      .forEach(obj => {
        obj.fields[GUIDE_TRANSLATION_FIELD] = new Field(
          obj,
          GUIDE_TRANSLATION_FIELD,
          BuiltinTypes.STRING,
        )
      })
  },
  deploy: async (changes: Change<InstanceElement>[]) => {
    const [translationChanges, leftoverChanges] = _.partition(
      changes,
      change => isInstanceChange(change)
        && TRANSLATIONS_TYPE_NAME.includes(getChangeData(change).elemID.typeName),
    )
    const deployResult = await deployChanges(
      translationChanges,
      async change => {
        await deployChange(change, client, config.apiDefinitions, [GUIDE_TRANSLATION_FIELD])
      }
    )
    return { deployResult, leftoverChanges }
  },
})
export default filterCreator
