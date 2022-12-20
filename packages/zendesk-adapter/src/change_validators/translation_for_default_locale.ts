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
  ChangeValidator,
  getChangeData, InstanceElement,
  isAdditionOrModificationChange, isInstanceElement, isReferenceExpression,
} from '@salto-io/adapter-api'
import Joi from 'joi'
import { createSchemeGuardForInstance, resolveValues } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { isTranslation, TranslationType } from '../filters/guide_section_and_category'
import { lookupFunc } from '../filters/field_references'
import { ARTICLE_TYPE_NAME } from '../constants'

const { awu } = collections.asynciterable
const PARENTS_TYPE_NAMES = ['section', 'category', ARTICLE_TYPE_NAME]

type ParentType = InstanceElement & {
  value: {
    // eslint-disable-next-line camelcase
    source_locale: string
    translations: TranslationType[]
  }
}

const PARENT_SCHEMA = Joi.object({
  source_locale: Joi.string().required(),
  translations: Joi.array().required(),
}).unknown(true).required()

const isParent = createSchemeGuardForInstance<ParentType>(
  PARENT_SCHEMA, 'Received an invalid value for section/category'
)


const noTranslationForDefaultLocale = (instance: InstanceElement): boolean => {
  if (!isParent(instance)) {
    return false
  }
  const sourceLocale = instance.value.source_locale
  const translation = instance.value.translations
    .filter(isTranslation)
    .find(tran => (isReferenceExpression(tran.locale)
      ? tran.locale.value.value.locale === sourceLocale
      : tran.locale === sourceLocale)) // locale is a string
  return (translation === undefined) // no translation for the source_locale
}

/**
 * This validator checks if there is no translation for the source_locale
 */
export const translationForDefaultLocaleValidator: ChangeValidator = async changes => {
  const relevantInstances = await awu(changes)
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(isInstanceElement)
    .filter(instance => PARENTS_TYPE_NAMES.includes(instance.elemID.typeName))
    .map(data => resolveValues(data, lookupFunc))
    .filter(noTranslationForDefaultLocale)
    .toArray()

  return relevantInstances
    .flatMap(instance => [{
      elemID: instance.elemID,
      severity: 'Error',
      message: `${instance.elemID.typeName} instance does not have a translation for the source locale`,
      detailedMessage: `${instance.elemID.typeName} instance "${instance.elemID.name}" must have a translation for the source locale ${instance.value.source_locale}`,
    }])
}
