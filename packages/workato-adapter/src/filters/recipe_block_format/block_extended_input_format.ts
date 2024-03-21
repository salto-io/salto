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
import { Element, Values, isInstanceElement } from '@salto-io/adapter-api'
import { createSchemeGuard } from '@salto-io/adapter-utils'
import _ from 'lodash'
import Joi from 'joi'
import { logger } from '@salto-io/logging'
import { RECIPE_CODE_TYPE } from '../../constants'
import { FilterCreator } from '../../filter'
import { BlockBase } from '../cross_service/recipe_block_types'
// import { removeUnnecessaryFromExtendedSchema, transformRecipeBlock } from './block_extended_output_format'

const log = logger(module)

type RecipeExtendedInputSchemaBlock = BlockBase & {
  as: string
  provider: string
  content: Values
  // eslint-disable-next-line camelcase
  extended_input_schema: Values
}

const RECIPE_EXTENDED_INPUT_SCHEMA_BLOCK_SCHEMA = Joi.object({
  keyword: Joi.string().required(),
  as: Joi.string().required(),
  provider: Joi.string().required(),
  content: Joi.array().min(1).required(),
  extended_input_schema: Joi.array().min(1).required(),
})
  .unknown(true)
  .required()

const isExtendedInputSchemaBlock = createSchemeGuard<RecipeExtendedInputSchemaBlock>(
  RECIPE_EXTENDED_INPUT_SCHEMA_BLOCK_SCHEMA,
)

const minimizeExtendedInputSchema = (content: Values, extendedInputSchema: Values): Values => {
  // TODO: check if change to transform func
  if (_.isArray(content)) {
    const names = _.keyBy(extendedInputSchema, obj => obj.name)
    return content
      .map(obj => {
        if (_.has(obj, 'key') && names[obj.key] !== undefined) {
          if (names[obj.key].type === 'object') {
            return minimizeExtendedInputSchema(obj.value, names[obj.key].properties)
          }
          return names[obj.key]
        }
        return undefined
      })
      .filter(obj => obj !== undefined)
  }
  return content
}

// const removeUnnecessaryFromExtendedSchema = (
//   value: Values,
//   path: ElemID,
//   pathResolver: Values,
// ): void => {
//   const keys = Object.keys(value)
//   if (keys.length === 0) {
//     log.debug('Empty object, removing', path, pathResolver)
//     // return value
//   }

// }

// const transformToMinimalExtendedInputSchemaFunc = (pathResolver: Values): TransformFunc =>
//   async ({ value, path }) => {
//     // TODO: check if works
//     if (path !== undefined && path.getFullNameParts().findIndex(part => part === 'extended_input_schema') >= 0) {  // in extended_input_schema
//       removeUnnecessaryFromExtendedSchema(value, path, pathResolver)
//     }
//     return value
//   }

/**
 * This filter is responsible for minimizing the extended_input_schema of recipe blocks.
 * It's Remove unnecessary data from extended input schema.
 * It's Save only the data which is used in the recipe block.
 * The name of the extended_input_schema object would be the key of the input object.
 */
const filterCreator: FilterCreator = ({ config }) => ({
  name: 'recipeBlockExtendedInputSchemaMinimizeFilter',
  onFetch: async (elements: Element[]) => {
    if (config.enableDeployWithReferencesSupport !== true) {
      log.debug('Parsing recipe block extended output schema minimize was disabled')
      return
    }
    await Promise.all(
      elements
        .filter(isInstanceElement)
        .filter(instance => instance.elemID.typeName === RECIPE_CODE_TYPE && isExtendedInputSchemaBlock(instance.value))
        .map(instance => {
          instance.value.extended_input_schema = minimizeExtendedInputSchema(
            instance.value.input,
            instance.value.extended_input_schema,
          ) // TODO: fix to do it on every block
          return instance
        }),
    )
  },
})

export default filterCreator
