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
import { WALK_NEXT_STEP, createSchemeGuard, walkOnElement } from '@salto-io/adapter-utils'
import _ from 'lodash'
import Joi from 'joi'
import { RECIPE_CODE_TYPE } from '../../constants'
import { FilterCreator } from '../../filter'
import { isInstanceFromType } from '../../utils'
import { createMatcher } from '../cross_service/reference_finders'
import { BlockBase } from '../cross_service/recipe_block_types'
import { getTransformToMinimalExtendedSchemaFunc, transformRecipeBlock } from './utils'

type BlockFormula = { block: string; path: string }
const isBlockFormula = (val: Values): val is BlockFormula => _.isString(val.block) && _.isString(val.path)

const formulaMatcher = createMatcher(
  [new RegExp("\\{_\\('data\\.[^\\.]*?\\.(?<block>\\w+)\\.(?<path>[^\\)]*?)'\\)\\}", 'g')],
  isBlockFormula,
)

type RecipeExtendedOutputSchemaBlock = BlockBase & {
  as: string
  provider: string
  // eslint-disable-next-line camelcase
  extended_output_schema: Values
}

const RECIPE_EXTENDED_OUTPUT_SCHEMA_BLOCK_SCHEMA = Joi.object({
  keyword: Joi.string().required(),
  as: Joi.string().required(),
  provider: Joi.string().required(),
  extended_output_schema: Joi.array().min(1).required(),
})
  .unknown(true)
  .required()

const isExtendedOutputSchemaBlock = createSchemeGuard<RecipeExtendedOutputSchemaBlock>(
  RECIPE_EXTENDED_OUTPUT_SCHEMA_BLOCK_SCHEMA,
)

const addFormulaPath = (formulasObject: Values, pathParts: Array<string>): Values => {
  if (pathParts.length === 1) {
    formulasObject[pathParts[0]] = {} as Record<string, Values>
  } else {
    formulasObject[pathParts[0]] = addFormulaPath(formulasObject[pathParts[0]] ?? {}, pathParts.slice(1))
  }
  return formulasObject
}

const filterCreator: FilterCreator = ({ config }) => ({
  name: 'recipeBlockExtendedOutputSchemaFormatFilter',
  onFetch: async (elements: Element[]) => {
    if (config.fetch.enableExperimentalSupportingDeploy) {
      await Promise.all(
        elements
          .filter(isInstanceElement)
          .filter(isInstanceFromType([RECIPE_CODE_TYPE]))
          .map(instance => {
            const formulasByBlock: Record<string, Values> = {}
            walkOnElement({
              element: instance,
              func: ({ value }) => {
                if (_.isString(value)) {
                  const formulas = formulaMatcher(value)
                  formulas.forEach(({ block, path }) => {
                    formulasByBlock[block] = addFormulaPath(formulasByBlock[block] ?? {}, path.split('.'))
                  })
                  return WALK_NEXT_STEP.SKIP
                }
                return WALK_NEXT_STEP.RECURSE
              },
            })

            const initiatePath = (value: Values): Values | undefined => {
              if (isExtendedOutputSchemaBlock(value) && formulasByBlock[value.as] !== undefined) {
                return formulasByBlock[value.as]
              }
              return undefined
            }

            return transformRecipeBlock(
              instance,
              getTransformToMinimalExtendedSchemaFunc(initiatePath, 'extended_output_schema'),
            )
          }),
      )
    }
  },
})

export default filterCreator
