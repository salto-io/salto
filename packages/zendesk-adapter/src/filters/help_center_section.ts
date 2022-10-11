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
  isRemovalChange,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import Joi from 'joi'
import { createSchemeGuard, createSchemeGuardForInstance } from '@salto-io/adapter-utils'
import { FilterCreator } from '../filter'
import { deployChange, deployChanges } from '../deployment'

const SECTION_TYPE_NAME = 'section'

export const removedSectionId: number[] = []

type TranslationType = InstanceElement & {
    title: string
    body?: string
    locale: string
}

export type SectionType = InstanceElement & {
  // eslint-disable-next-line camelcase
    source_locale: string
    name?: string
    description?: string
}

const TRANSLATION_SCHEMA = Joi.object({
  locale: Joi.string().required(),
  body: Joi.string(),
  title: Joi.string().required(),
}).unknown(true).required()

const SECTION_SCHEMA = Joi.object({
  source_locale: Joi.string().required(),
  name: Joi.string(),
  description: Joi.string(),
}).unknown(true).required()

export const isTranslation = createSchemeGuard<TranslationType>(
  TRANSLATION_SCHEMA, 'Received an invalid value for translation'
)

export const isSection = createSchemeGuardForInstance<SectionType>(
  SECTION_SCHEMA, 'Received an invalid value for section'
)

/**
 * This function is used to add the 'name' and 'description' fields to the section from its default
 * translation. It is needed as we omit these fields during the fetch to avoid data duplication.
 * For the deployment to work these fields need to be added back to the section instance.
 */
const addTranslationValues = (change: Change<InstanceElement>): void => {
  const currentLocale = getChangeData(change).value.source_locale
  const translation = getChangeData(change).value.translations
    .filter(isTranslation)
    .find((tran: TranslationType) => tran.locale === currentLocale)
  if (translation !== undefined) {
    getChangeData(change).value.name = translation.title
    getChangeData(change).value.description = translation.body ?? ''
  }
}

const removeNameAndDescription = (elem: InstanceElement): void => {
  if (isSection(elem)) {
    delete elem.value.name
    delete elem.value.description
  }
}

const addRemovalChangesId = (changes: Change<InstanceElement>[]): void => {
  changes
    .filter(isRemovalChange)
    .forEach(change => removedSectionId.push(getChangeData(change).value.id))
}

/**
 * This filter works as follows: onFetch it discards the 'name' and 'description' fields to avoid
 * data duplication with the default translation. The preDeploy adds these fields for the deployment
 * to work properly. The Deploy ignores the 'translations' fields in the deployment. The onDeploy
 * discards the 'name' and 'description' fields from the section again.
 */
const filterCreator: FilterCreator = ({ client, config }) => ({
  onFetch: async (elements: Element[]): Promise<void> => {
    elements
      .filter(isInstanceElement)
      .filter(obj => obj.elemID.typeName === SECTION_TYPE_NAME)
      .forEach(removeNameAndDescription)
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
    addRemovalChangesId(sectionChanges)
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
      .forEach(change => removeNameAndDescription(getChangeData(change)))
  },
})

export default filterCreator
