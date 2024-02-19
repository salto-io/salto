/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import Joi from 'joi'
import { InstanceElement, ReferenceExpression } from '@salto-io/adapter-api'
import { createSchemeGuard, createSchemeGuardForInstance } from '@salto-io/adapter-utils'
import { ARTICLES_FIELD, CATEGORIES_FIELD, SECTIONS_FIELD } from '../constants'

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
