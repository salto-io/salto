/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import Joi from 'joi'
import { ElemID, InstanceElement, ReadOnlyElementsSource, ReferenceExpression, Value } from '@salto-io/adapter-api'
import { createSchemeGuard, createSchemeGuardForInstance } from '@salto-io/adapter-utils'
import { ARTICLES_FIELD, CATEGORIES_FIELD, SECTIONS_FIELD, ZENDESK } from '../constants'
import { ACCOUNT_SETTING_TYPE_NAME } from '../filters/account_settings'

type ArticlesOrderType = InstanceElement & { value: { articles: ReferenceExpression[] } }
type SectionsOrderType = InstanceElement & { value: { sections: ReferenceExpression[] } }
type CategoriesOrderType = InstanceElement & { value: { categories: ReferenceExpression[] } }

const articlesOrderScheme = Joi.object({ [ARTICLES_FIELD]: Joi.required() })
  .required()
  .unknown(true)
const sectionsOrderScheme = Joi.object({ [SECTIONS_FIELD]: Joi.required() })
  .required()
  .unknown(true)
const categoriesOrderScheme = Joi.object({ [CATEGORIES_FIELD]: Joi.required() })
  .required()
  .unknown(true)

const fieldToSchemeGuard: Record<string, (instance: InstanceElement) => boolean> = {
  [ARTICLES_FIELD]: createSchemeGuardForInstance<ArticlesOrderType>(articlesOrderScheme),
  [SECTIONS_FIELD]: createSchemeGuardForInstance<SectionsOrderType>(sectionsOrderScheme),
  [CATEGORIES_FIELD]: createSchemeGuardForInstance<CategoriesOrderType>(categoriesOrderScheme),
}

// Validates that the order field exists in the element's value
export const validateOrderType = (orderInstance: InstanceElement, orderField: string): boolean => {
  const schemeGuard = fieldToSchemeGuard[orderField]
  return schemeGuard(orderInstance)
}

export type ConditionWithReferenceValue = {
  field: string
  value: ReferenceExpression
}

export type ActionsType = {
  field: string | ReferenceExpression
  value: unknown
}

const EXPECTED_ACTION_SCHEMA = Joi.object({
  field: [Joi.string().required(), Joi.object().required()],
  value: Joi.required(),
})
  .unknown(true)
  .required()

export const isAction = createSchemeGuard<ActionsType>(
  EXPECTED_ACTION_SCHEMA,
  'Received an invalid value for macro actions',
)

export type AccountSettingsInstance = {
  value: {
    active_features: {
      automatic_answers?: boolean
    }
    tickets: {
      custom_statuses_enabled?: boolean
    }
  }
}

const isValidAccountSettings = (instance: Value): instance is AccountSettingsInstance =>
  _.isPlainObject(instance?.value) &&
  _.isPlainObject(instance.value.active_features) &&
  _.isPlainObject(instance.value.tickets)

export const getAccountSettings = async (
  elementSource: ReadOnlyElementsSource | undefined,
): Promise<AccountSettingsInstance> => {
  if (elementSource === undefined) {
    throw new Error('element source is undefined')
  }

  const accountSettings = await elementSource.get(
    new ElemID(ZENDESK, ACCOUNT_SETTING_TYPE_NAME, 'instance', ElemID.CONFIG_NAME),
  )

  if (!isValidAccountSettings(accountSettings)) {
    throw new Error('account settings are invalid')
  }

  return accountSettings
}
