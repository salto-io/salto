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
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import {
  Change, getChangeData, InstanceElement, isAdditionChange, isRemovalChange,
} from '@salto-io/adapter-api'
import { createSchemeGuard, replaceTemplatesWithValues, resolveChangeElement } from '@salto-io/adapter-utils'
import { FilterCreator } from '../filter'
import { deployChange, deployChanges } from '../deployment'
import { ARTICLE_TYPE_NAME } from '../constants'
import { addRemovalChangesId } from './help_center_section_and_category'
import { lookupFunc } from './field_references'
import { removeTitleAndBody } from './help_center_fetch_article'
import { prepRef } from './article_body'

const log = logger(module)
const { awu } = collections.asynciterable

const TRANSLATION_SCHEMA = Joi.object({
  locale: Joi.object().required(),
  body: [Joi.string(), Joi.object()],
  title: Joi.string().required(),
}).unknown(true).required()

export type TranslationType = {
  title: string
  body?: string
  locale: { id: string }
}

export const isTranslation = createSchemeGuard<TranslationType>(
  TRANSLATION_SCHEMA, 'Received an invalid value for translation'
)

const addTranslationValues = async (change: Change<InstanceElement>): Promise<void> => {
  const resolvedChange = await resolveChangeElement(change, lookupFunc)
  const currentLocale = getChangeData(resolvedChange).value.source_locale
  const translation = getChangeData(resolvedChange).value.translations
    .filter(isTranslation)
    .find((tran: TranslationType) => tran.locale?.id === currentLocale)
  if (translation !== undefined) {
    getChangeData(change).value.title = translation.title
    getChangeData(change).value.body = translation.body ?? ''
  }
}

/**
 * Deploys articles
 */
const filterCreator: FilterCreator = ({ config, client }) => ({
  preDeploy: async (changes: Change<InstanceElement>[]): Promise<void> => {
    await awu(changes)
      .filter(isAdditionChange)
      .filter(change => getChangeData(change).elemID.typeName === ARTICLE_TYPE_NAME)
      .forEach(async change => {
        // We add the title and the resolved body values for articles creation
        await addTranslationValues(change)
        const instance = getChangeData(change)
        try {
          replaceTemplatesWithValues(
            { values: [instance.value], fieldName: 'body' },
            {},
            prepRef,
          )
        } catch (e) {
          log.error('Error parsing article body value in deployment', e)
        }
      })
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

  onDeploy: async (changes: Change<InstanceElement>[]): Promise<void> => {
    changes
      .filter(change => getChangeData(change).elemID.typeName === ARTICLE_TYPE_NAME)
      .forEach(change => removeTitleAndBody(getChangeData(change)))
  },
})

export default filterCreator
