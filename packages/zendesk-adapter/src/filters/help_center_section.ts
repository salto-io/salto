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
  Change,
  Element,
  getChangeData,
  InstanceElement,
  isInstanceElement,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import Joi from 'joi'
import { createSchemeGuard } from '@salto-io/adapter-utils'
import { FilterCreator } from '../filter'
import { deployChange, deployChanges } from '../deployment'

const SECTION_TYPE_NAME = 'section'

type TranslationType = InstanceElement &{
    title: string
    body?: string
    locale: string
}

export type sectionType = InstanceElement & {
  locale: string
}

const TRANSLATION_SCHEMA = Joi.object({
  locale: Joi.string().required(),
  body: Joi.string(),
  title: Joi.string().required(),
}).unknown(true).required()

export const isTranslation = createSchemeGuard<TranslationType>( // TODO
  TRANSLATION_SCHEMA, 'Received an invalid value for translation'
)

const addTranslationValues = (change: Change<InstanceElement>): void => {
  const currentLocale = getChangeData(change).value.source_locale
  const translation = getChangeData(change).value.translations
    .filter(isTranslation)
    .find((tran:TranslationType) => tran.locale === currentLocale)
  if (translation) {
    getChangeData(change).value.name = translation.title
    getChangeData(change).value.description = translation.body ?? ''
  }
}

const filterCreator: FilterCreator = ({ client, config }) => ({
  onFetch: async (elements: Element[]): Promise<void> => {
    elements
      .filter(isInstanceElement)
      .filter(obj => obj.elemID.typeName === SECTION_TYPE_NAME)
      .forEach(obj => {
        delete obj.value.name
        delete obj.value.description
      })
  },
  preDeploy: async (changes: Change<InstanceElement>[]): Promise<void> => {
    changes
      .filter(change => getChangeData(change).elemID.typeName === SECTION_TYPE_NAME)
      .forEach(addTranslationValues)
  },
  deploy: async (changes: Change<InstanceElement>[]) => {
    const [sectionChanges, leftoverChanges] = _.partition(
      changes,
      change => getChangeData(change).elemID.typeName === SECTION_TYPE_NAME,
    )
    const deployResult = await deployChanges(
      sectionChanges,
      async change => {
        await deployChange(change, client, config.apiDefinitions, ['translations'])
      }
    )
    return { deployResult, leftoverChanges }
  },
  onDeploy: async (changes: Change<InstanceElement>[]): Promise<void> => {
    changes
      .filter(change => getChangeData(change).elemID.typeName === SECTION_TYPE_NAME)
      .forEach(change => {
        delete getChangeData(change).value.name
        delete getChangeData(change).value.description
      })
  },
})

export default filterCreator
