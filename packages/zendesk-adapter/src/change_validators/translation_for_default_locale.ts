/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import {
  ChangeValidator,
  getChangeData,
  InstanceElement,
  isAdditionOrModificationChange,
  isInstanceElement,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import Joi from 'joi'
import { createSchemeGuardForInstance, isResolvedReferenceExpression } from '@salto-io/adapter-utils'
import { resolveValues } from '@salto-io/adapter-components'
import { collections } from '@salto-io/lowerdash'
import { isTranslation, TranslationType } from '../filters/guide_section_and_category'
import { lookupFunc } from '../filters/field_references'
import { ARTICLE_TYPE_NAME } from '../constants'

const log = logger(module)

const { awu } = collections.asynciterable
const PARENTS_TYPE_NAMES = ['section', 'category', ARTICLE_TYPE_NAME]

type ParentType = InstanceElement & {
  value: {
    source_locale: string
    translations: TranslationType[]
  }
}

const PARENT_SCHEMA = Joi.object({
  source_locale: Joi.string().required(),
  translations: Joi.array().required(),
})
  .unknown(true)
  .required()

const isParent = createSchemeGuardForInstance<ParentType>(
  PARENT_SCHEMA,
  'Received an invalid value for section/category',
)

const noTranslationForDefaultLocale = (instance: InstanceElement): boolean => {
  if (!isParent(instance)) {
    return false
  }
  const sourceLocale = instance.value.source_locale
  const translation = instance.value.translations.filter(isTranslation).find(tran => {
    if (isResolvedReferenceExpression(tran.locale)) {
      if (!isInstanceElement(tran.locale.value)) {
        log.warn('Translation locale is not an instance element')
        return false
      }
      return tran.locale.value.value.locale === sourceLocale
    }
    return tran.locale === sourceLocale // locale is a string
  })
  return translation === undefined // no translation for the source_locale
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

  return relevantInstances.flatMap(instance => [
    {
      elemID: instance.elemID,
      severity: 'Error',
      message: `${instance.elemID.typeName} instance does not have a translation for the source locale`,
      detailedMessage: `${instance.elemID.typeName} instance "${instance.elemID.name}" must have a translation for the source locale ${instance.value.source_locale}`,
    },
  ])
}
