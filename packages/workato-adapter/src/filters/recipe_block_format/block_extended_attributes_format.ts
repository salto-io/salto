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
import { PostFetchOptions, ReferenceExpression, isInstanceElement, isReferenceExpression } from '@salto-io/adapter-api'
import { TransformFunc, createSchemeGuard } from '@salto-io/adapter-utils'
import _ from 'lodash'
import Joi from 'joi'
import { logger } from '@salto-io/logging'
import { RECIPE_CODE_TYPE } from '../../constants'
import { FilterCreator } from '../../filter'
import { ExtendedSchemaItem, EXTENDED_SCHEMA_ITEM_SCHEMA, transformRecipeBlock } from './block_extended_output_format'

const log = logger(module)

type ExtendedSchemaReferencedItem = ExtendedSchemaItem & {
  reference: ReferenceExpression
  attributes: string[]
}
const EXTENDED_SCHEMA_WORKATO_ATTRIBUTES = [
  'control_type',
  'optional',
  'custom',
  'properties',
  'toggle_hint',
  'toggle_field',
  'of',
  'type',
]
const EXTENDED_SCHEMA_REFERNECED_ITEM_SCHEMA = EXTENDED_SCHEMA_ITEM_SCHEMA.keys({
  reference: Joi.object().required(),
})
  .unknown(true)
  .required()

export const isExtendedSchemaRefernecedItem = createSchemeGuard<ExtendedSchemaReferencedItem>(
  EXTENDED_SCHEMA_REFERNECED_ITEM_SCHEMA,
)

const transformToAttributesList: TransformFunc = async ({ value }) => {
  if (!isExtendedSchemaRefernecedItem(value) || !isReferenceExpression(value.reference)) {
    return value
  }

  const adapterAttributes = _.difference(
    _.intersection(Object.keys(value.reference.value), Object.keys(value)),
    EXTENDED_SCHEMA_WORKATO_ATTRIBUTES,
  )
  value.attributes = adapterAttributes
  if (adapterAttributes.length !== 0) {
    log.debug(`Reference cross attributes found: ${adapterAttributes}`)
  }
  return _.omit(value, adapterAttributes)
}

/**
 * This filter is responsible for extracting the attributes that are not part of the workato schema
 * from the extended schema of a recipe block
 */
const filterCreator: FilterCreator = ({ config }) => ({
  name: 'recipeBlockExtendedSchemaAttributesFilter',
  onPostFetch: async ({
    // TODO: check after references support
    currentAdapterElements,
  }: PostFetchOptions): Promise<void> => {
    if (config.enableDeployWithReferencesSupport !== true) {
      log.debug('Parsing attributes of recipe block extended schema was disabled')
      return
    }
    await Promise.all(
      currentAdapterElements
        .filter(isInstanceElement)
        .filter(elem => elem.elemID.typeName === RECIPE_CODE_TYPE)
        .map(instance => {
          const a = transformRecipeBlock(instance, transformToAttributesList)
          return a // TODO: change
        }),
    )
  },
})

export default filterCreator
