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
import Joi from 'joi'
import { RECIPE_CODE_TYPE } from '../../constants'
import { getTransformToMinimalExtendedSchemaFunc, transformRecipeBlock } from './utils'
import { FilterCreator } from '../../filter'
import { isInstanceFromType } from '../../utils'
import { BlockBase } from '../cross_service/recipe_block_types'

type RecipeExtendedInputSchemaBlock = BlockBase & {
  as: string
  provider: string
  input: Values
  // eslint-disable-next-line camelcase
  extended_output_schema: Values
}

const RECIPE_EXTENDED_INPUT_SCHEMA_BLOCK_SCHEMA = Joi.object({
  keyword: Joi.string().required(),
  as: Joi.string().required(),
  provider: Joi.string().min(1).required(),
  input: Joi.object().required(),
  extended_input_schema: Joi.array().min(1).required(),
})
  .unknown(true)
  .required()

const isExtendedInputSchemaBlock = createSchemeGuard<RecipeExtendedInputSchemaBlock>(
  RECIPE_EXTENDED_INPUT_SCHEMA_BLOCK_SCHEMA,
)

// const transformNaclToServer: TransformFunc = async ({ value }) => value

const initiatePath = (value: Values): Values | undefined => {
  if (isExtendedInputSchemaBlock(value)) {
    return value.input
  }
  return undefined
}

const filterCreator: FilterCreator = ({ config }) => ({
  name: 'recipeBlockExtendedInputSchemaFormatFilter',
  onFetch: async (elements: Element[]) => {
    if (config.fetch.enableExperimentalSupportingDeploy) {
      await Promise.all(
        elements
          .filter(isInstanceElement)
          .filter(isInstanceFromType([RECIPE_CODE_TYPE]))
          .map(instance =>
            transformRecipeBlock(
              instance,
              getTransformToMinimalExtendedSchemaFunc(initiatePath, 'extended_input_schema'),
            ),
          ),
      )
    }
  },
})

export default filterCreator
