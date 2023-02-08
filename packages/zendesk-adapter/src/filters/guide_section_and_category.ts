/*
*                      Copyright 2023 Salto Labs Ltd.
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
  getChangeData,
  InstanceElement, isReferenceExpression,
  isRemovalChange, ReferenceExpression,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import Joi from 'joi'
import { createSchemeGuard, createSchemeGuardForInstance } from '@salto-io/adapter-utils'
import { FilterCreator } from '../filter'
import { deployChange, deployChanges } from '../deployment'
import { BRAND_FIELD, SECTIONS_FIELD, TRANSLATIONS_FIELD } from '../constants'

export const TRANSLATION_PARENT_TYPE_NAMES = ['section', 'category']
const CATEGORY_TYPE_NAME = 'category'

// saves the id, should work between brands as id is unique.
export const removedTranslationParentId: number[] = []

// not an instanceElement as it does not have a value
export type TranslationType = {
  title: string
  body?: string
  locale: ReferenceExpression | string
}

type ParentType = InstanceElement & {
  value: {
    // eslint-disable-next-line camelcase
    source_locale: string
    name?: string
    description?: string
  }
}

const TRANSLATION_SCHEMA = Joi.object({
  locale: Joi.required(),
  body: [Joi.string(), Joi.object()],
  title: Joi.string().required(),
}).unknown(true).required()

const PARENT_SCHEMA = Joi.object({
  source_locale: Joi.string().required(),
  name: Joi.string(),
  description: Joi.string().allow(''),
}).unknown(true).required()

export const isTranslation = createSchemeGuard<TranslationType>(
  TRANSLATION_SCHEMA, 'Received an invalid value for translation'
)

export const isParent = createSchemeGuardForInstance<ParentType>(
  PARENT_SCHEMA, 'Received an invalid value for section/category'
)

/**
 * This function is used to add the 'name' and 'description' fields to the section/category from its
 * default translation. It is needed as we omit these fields during the fetch to avoid data
 * duplication. For the deployment to work these fields need to be added back to the section
 * instance.
 */
const addTranslationValues = (change: Change<InstanceElement>): void => {
  const currentLocale = getChangeData(change).value.source_locale
  const translation = getChangeData(change).value.translations
    .filter(isTranslation) // the translation is not a reference it is already the value
    .find((tran: TranslationType) => (isReferenceExpression(tran.locale)
      ? tran.locale.value.value.locale === currentLocale
      : tran.locale === currentLocale))
  if (translation !== undefined) {
    getChangeData(change).value.name = translation.title
    getChangeData(change).value.description = translation.body ?? ''
  }
}

export const removeNameAndDescription = (elem: InstanceElement): void => {
  delete elem.value.name
  delete elem.value.description
}

export const addRemovalChangesId = (changes: Change<InstanceElement>[]): void => {
  changes
    .filter(isRemovalChange)
    .forEach(change => removedTranslationParentId.push(getChangeData(change).value.id))
}

/**
 * This filter works as follows:  The preDeploy adds the 'name' and 'description' fields that where
 * removed during fetch in the guide_fetch_section_and_category filter for the deployment to
 * work properly.
 * The Deploy ignores the 'translations' fields in the deployment. The onDeploy
 * discards the 'name' and 'description' fields from the section again.
 */
const filterCreator: FilterCreator = ({ client, config }) => ({
  name: 'guideSectionCategoryFilter',
  preDeploy: async (changes: Change<InstanceElement>[]): Promise<void> => {
    changes
      .filter(change => TRANSLATION_PARENT_TYPE_NAMES.includes(
        getChangeData(change).elemID.typeName
      ))
      .forEach(addTranslationValues)
  },
  // deploy only category, section is deployed in guide_parent_to_section filter since
  // parent_section_id needs to be deployed separately
  deploy: async (changes: Change<InstanceElement>[]) => {
    const [parentChanges, leftoverChanges] = _.partition(
      changes,
      change => CATEGORY_TYPE_NAME === getChangeData(change).elemID.typeName,
    )
    addRemovalChangesId(parentChanges)
    const deployResult = await deployChanges(
      parentChanges,
      async change => {
        await deployChange(change, client, config.apiDefinitions, [TRANSLATIONS_FIELD, SECTIONS_FIELD, BRAND_FIELD])
      }
    )
    return { deployResult, leftoverChanges }
  },
  onDeploy: async (changes: Change<InstanceElement>[]): Promise<void> => {
    changes
      .filter(change => TRANSLATION_PARENT_TYPE_NAMES.includes(
        getChangeData(change).elemID.typeName
      ))
      .forEach(change => removeNameAndDescription(getChangeData(change)))
  },
})

export default filterCreator
