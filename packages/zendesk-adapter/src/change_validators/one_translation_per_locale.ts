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
  ChangeValidator, CORE_ANNOTATIONS,
  getChangeData, InstanceElement,
  isAdditionOrModificationChange, isInstanceElement, ReferenceExpression,
} from '@salto-io/adapter-api'
import Joi from 'joi'
import { createSchemeGuard } from '@salto-io/adapter-utils'
import { createSchemeGuardForInstance } from './required_app_owned_parameters'


const ARTICLE_TRANSLATION_TYPE_NAME = 'article_translation'
const CATEGORY_TRANSLATION_TYPE_NAME = 'category_translation'
const SECTION_TRANSLATION_TYPE_NAME = 'section_translation'

type Translation = InstanceElement & {
    value: {
        local: string
    }
    annotations: {
        _parent: ReferenceExpression[]
    }
}

type TranslationParent = InstanceElement & {
    value: {
        translations: ReferenceExpression[]
    }
}

const TRANSLATION_SCHEMA = Joi.object({
  annotations: Joi.object({
    _parent: Joi.array().required(),
  }).unknown(true).required(),
  value: Joi.object({
    locale: Joi.string().required(),
  }).unknown(true).required(),
}).unknown(true).required()

const TRANSLATION_PARENT_SCHEMA = Joi.object({
  translations: Joi.array().required(),
}).unknown(true).required()

const isTranslationParent = createSchemeGuardForInstance<TranslationParent>(
  TRANSLATION_PARENT_SCHEMA, 'Received an invalid value for translation parent'
)
const isTranslation = createSchemeGuard<Translation>(
  TRANSLATION_SCHEMA, 'Received an invalid value for translation'
)

const isNotUnique = (translation: InstanceElement, localeSet:Set<string>): boolean => {
  if (!isTranslation(translation)) {
    return false
  }
  const { locale } = translation.value
  if (localeSet.has(locale)) {
    return true
  }
  localeSet.add(locale)
  return false
}

/**
 * returns true if there are translations with the same locale -> meaning that they are not unique
 */
const invalidParent = (parent: InstanceElement): boolean => {
  if (!isTranslationParent(parent)) {
    return false
  }
  const localeSet = new Set<string>()
  return !_.isEmpty(parent.value.translations
    .map(referenceExpression => referenceExpression.value)
    .filter(translation => isNotUnique(translation, localeSet)))
}

export const oneTranslationPerLocalValidator: ChangeValidator = async changes => {
  const relevantInstances = changes
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(isInstanceElement)
    .filter(instance =>
      instance.elemID.typeName === ARTICLE_TRANSLATION_TYPE_NAME
    || instance.elemID.typeName === CATEGORY_TRANSLATION_TYPE_NAME
    || instance.elemID.typeName === SECTION_TRANSLATION_TYPE_NAME)

  // it is a set to avoid duplicate of parents from translations which have the same parent
  const parentInstances = new Set(relevantInstances
    .filter(instance => isTranslation(instance))
    .flatMap(translationInstance => translationInstance.annotations[CORE_ANNOTATIONS.PARENT])
    .map(translationParentInstance => translationParentInstance.value))

  return Array.from(parentInstances)
    .filter(parentInstance => invalidParent(parentInstance))
    .flatMap(instance => [{
      elemID:instance.elemID,
      severity: 'Error',
      message: `${instance.elemID.getFullName()} cannot have multiple translations with the same locale`,
      detailedMessage: `${instance.elemID.getFullName()} cannot have multiple translations with the same locale`,
    }])
}
