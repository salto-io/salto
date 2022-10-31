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
  Change, getChangeData, InstanceElement, isAdditionChange, isRemovalChange, ReferenceExpression,
} from '@salto-io/adapter-api'
import { createSchemeGuard } from '@salto-io/adapter-utils'
import { FilterCreator } from '../filter'
import { deployChange, deployChanges } from '../deployment'
import { ARTICLE_TYPE_NAME } from '../constants'
import { addRemovalChangesId } from './help_center_section_and_category'

const TRANSLATION_SCHEMA = Joi.object({
  locale: Joi.object().required(),
  body: Joi.string(),
  title: Joi.string().required(),
}).unknown(true).required()

export type TranslationType = {
  title: string
  body?: string
  locale: ReferenceExpression
}

export const isTranslation = createSchemeGuard<TranslationType>(
  TRANSLATION_SCHEMA, 'Received an invalid value for translation'
)

const addTranslationValues = (change: Change<InstanceElement>): void => {
  const currentLocale = getChangeData(change).value.source_locale
  const translation = getChangeData(change).value.translations
    .filter(isTranslation) // the translation is not a reference it is already the value
    .find((tran: TranslationType) => tran.locale.value.value.id === currentLocale)
  if (translation !== undefined) {
    getChangeData(change).value.name = translation.title
    getChangeData(change).value.description = translation.body ?? ''
  }
}

/**
 * Deploys articles
 */
const filterCreator: FilterCreator = ({ config, client }) => ({
  preDeploy: async (changes: Change<InstanceElement>[]): Promise<void> => {
    changes
      .filter(isAdditionChange)
      .filter(change => getChangeData(change).elemID.typeName === ARTICLE_TYPE_NAME)
      .forEach(addTranslationValues)
  },

  deploy: async (changes: Change<InstanceElement>[]) => {
    const [articleChanges, leftoverChanges] = _.partition(
      changes,
      change =>
        (getChangeData(change).elemID.typeName === ARTICLE_TYPE_NAME)
        && !isRemovalChange(change),
    )
    addRemovalChangesId(articleChanges)
    const deployResult = await deployChanges(
      articleChanges,
      async change => {
        await deployChange(
          change, client, config.apiDefinitions, ['translations'],
        )
      },
    )
    return { deployResult, leftoverChanges }
  },
})

export default filterCreator
