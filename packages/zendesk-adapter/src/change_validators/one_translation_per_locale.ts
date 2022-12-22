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
import {
  ChangeValidator, getChangeData, InstanceElement, ReadOnlyElementsSource, ChangeError,
  isAdditionOrModificationChange, isInstanceElement, ReferenceExpression, isReferenceExpression,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import Joi from 'joi'
import { createSchemeGuardForInstance, getParents } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'

const log = logger(module)
const { findDuplicates } = collections.array
const { awu } = collections.asynciterable


const ARTICLE_TRANSLATION_TYPE_NAME = 'article_translation'
const CATEGORY_TRANSLATION_TYPE_NAME = 'category_translation'
const SECTION_TRANSLATION_TYPE_NAME = 'section_translation'

type Translation = InstanceElement & {
  value: {
    locale: string | ReferenceExpression
  }
}
type TranslationParent = InstanceElement & {
  value: {
    translations: ReferenceExpression[]
  }
}

const TRANSLATION_SCHEMA = Joi.object({
  locale: Joi.required(),
}).unknown(true).required()

const TRANSLATION_PARENT_SCHEMA = Joi.object({
  translations: Joi.array().required(),
}).unknown(true).required()

const isTranslationParent = createSchemeGuardForInstance<TranslationParent>(
  TRANSLATION_PARENT_SCHEMA, 'Received an invalid value for translation parent'
)
const isTranslation = createSchemeGuardForInstance<Translation>(
  TRANSLATION_SCHEMA, 'Received an invalid value for translation'
)

/**
 * returns true if there are translations with the same locale -> meaning that they are not unique
 */
const findDuplicateTranslations = async (
  parent: InstanceElement,
  elementSource: ReadOnlyElementsSource,
): Promise<string[]> => {
  if (!isTranslationParent(parent)) {
    return []
  }
  const locales = await awu(parent.value.translations)
    .map(referenceExpression => referenceExpression.value)
    .filter(isTranslation)
    .map(translation => translation.value.locale)
    .map(async locale => (isReferenceExpression(locale) && locale.elemID.idType === 'instance'
      ? (await elementSource.get(locale.elemID)).value.locale ?? ''
      : locale))
    .toArray()
  return findDuplicates(locales)
}

export const oneTranslationPerLocaleValidator: ChangeValidator = async (changes, elementSource) => {
  const relevantInstances = changes
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(isInstanceElement)
    .filter(instance =>
      [ARTICLE_TRANSLATION_TYPE_NAME,
        CATEGORY_TRANSLATION_TYPE_NAME,
        SECTION_TRANSLATION_TYPE_NAME].includes(instance.elemID.typeName))

  // it is a set to avoid duplicate of parents from translations which have the same parent
  const parentInstances = relevantInstances
    .filter(instance => isTranslation(instance))
    .flatMap(getParents)
    .map(translationParentInstance => translationParentInstance.value)

  const parentInstancesObj = _.keyBy(parentInstances, instance => instance.elemID.getFullName())

  if (elementSource === undefined) {
    log.error('Failed to run findDuplicateTranslations because no element source was provided')
    return []
  }

  return awu(Object.values(parentInstancesObj))
    .map(async parentInstance => ({
      elemID: parentInstance.elemID,
      duplicatedLocales: await findDuplicateTranslations(parentInstance, elementSource),
    }))
    .filter(instance => !_.isEmpty(instance.duplicatedLocales))
    .map(({ elemID, duplicatedLocales }): ChangeError => ({
      elemID,
      severity: 'Error',
      message: `Multiple translations with the same locale found in ${elemID.typeName} instance. Only one translation per locale is supported.`,
      detailedMessage: `Instance ${elemID.getFullName()} has multiple translations for locales: ${duplicatedLocales}. Only one translation per locale is supported.`,
    }))
    .toArray()
}
