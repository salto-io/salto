/*
*                      Copyright 2023 Salto Labs Ltd.
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
  Element, InstanceElement, Value, Values, getChangeData, isInstanceChange, isInstanceElement,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { TransformFunc, WALK_NEXT_STEP, createSchemeGuard, transformValues, walkOnElement } from '@salto-io/adapter-utils'
import Joi from 'joi'
import _ from 'lodash'
import { RECIPE_CODE_TYPE, RECIPE_TYPE } from '../../constants'
import { FilterCreator } from '../../filter'
import { isInstanceFromType } from '../../utils'
import { BlockBase } from '../cross_service/recipe_block_types'
import { createMatcher } from '../cross_service/reference_finders'

const log = logger(module)


type BlockFormula = { block: string; path: string }
const isBlockFormula = (val: Values): val is BlockFormula => (
  _.isString(val.block)
  && _.isString(val.path)
)

const formulaMatcher = createMatcher(
  [new RegExp('\\{_\\(\'data\\.[^\\.]*?\\.(?<block>\\w+)\\.(?<path>\\w+)\'\\)\\}', 'g')],
  isBlockFormula,
)

type recipeExtendedOutputSchemaBlock = BlockBase & {
  as: string
  provider: string
  // eslint-disable-next-line camelcase
  extended_output_schema: {
    [key: string]: Value
   }
}

const RECIPE_EXTENDED_OUTPUT_SCHEMA_BLOCK_SCHEMA = Joi.object({
  keyword: Joi.string().required(),
  as: Joi.string().required(),
  provider: Joi.string().required(),
  extended_output_schema: Joi.object().min(1).unknown(true).required(),
}).unknown(true).required()

const KEY_VALUE_SCHEMA = Joi.object({
  key: Joi.string().required(),
  value: Joi.any().required(),
}).unknown(true).required()

const getTransformToMinimalExtendedOutputSchemaFunc = ( 
  formulasByBlock: Record<string, Array<Object>> // TODO Im here
): TransformFunc => async ({ value }) => {
  if (createSchemeGuard<recipeExtendedOutputSchemaBlock>(
    RECIPE_EXTENDED_OUTPUT_SCHEMA_BLOCK_SCHEMA
  )(value)) {
    const minimalOutputSchema = {}
    const formulas = formulasByBlock[value.as] ?? []
    Object.keys(value.extended_output_schema).forEach(key => {
      value.newInput.push({
        key,
        value: value.input[key],
      })
    })
    if (Object.keys(value.input).length !== 0) {
      log.warn(`Unknown input keys found in recipe block ${value.as}: ${Object.keys(value.input)}`)
    }
    return _.omit(value, 'input')
  }
  return value
}

const transformNaclToServer: TransformFunc = async ({ value }) => {
  if (createSchemeGuard<recipeExtendedOutputSchemaBlock>(RECIPE_NEW_INPUT_BLOCK_SCHEMA)(value)) {
    value.input = {}
    value.newInput.forEach(item => { // TODO if we change to second version change it to the 'content' item
      value.input[item.key] = item.value
    })
    if (Object.keys(value.newInput).length !== 0) {
      log.warn(`Unknown newInput keys found in recipe block ${value.as}: ${Object.keys(value.input)}`)
    }
    return _.omit(value, 'newInput')
  }
  return value
}

const transformRecipeBlock = async (instance: InstanceElement, transformFunc: TransformFunc): Promise<void> => {
  instance.value = await transformValues({
    values: instance.value,
    type: await instance.getType(),
    strict: false,
    allowEmpty: true, // TODO check if strict and allowEmpty
    transformFunc,
  }) ?? instance.value
}
const addFormulaPath = (formulasByBlock: Record<string, Array<Object>>, block: string, path: string): void => { // TODO Im here 
  
}

const filterCreator: FilterCreator = () => ({
  name: 'recipeBlockExtendedOutputSchemaFormatFilter',
  onFetch: async (elements: Element[]) => {
    await Promise.all(elements
      .filter(isInstanceElement)
      .filter(isInstanceFromType([RECIPE_CODE_TYPE]))
      .map(instance => {
        const formulasByBlock: Record<string, Array<string>> = {}
        walkOnElement({
          element: instance,
          func: ({ value }) => {
            if (_.isString(value)) {
              const formulas = formulaMatcher(value)
              formulas.forEach(({ block, path }) => {
                addFormulaPath(formulasByBlock, block, path)
              })
              return WALK_NEXT_STEP.SKIP
            }
            return WALK_NEXT_STEP.RECURSE
          },
        })
        return transformRecipeBlock(
          instance,
          getTransformToMinimalExtendedOutputSchemaFunc(formulasByBlock)
        )
      }))
  },
  preDeploy: async changes => { // TODO
    await Promise.all(changes
      .filter(isInstanceChange)
      .map(getChangeData)
      .filter(isInstanceFromType([RECIPE_TYPE]))
      // Although there are changes in the "recipe__code", we only check the "recipe" type.
      // This is because the resolving hook only returns the "recipe" type.
      .map(instance => transformRecipeBlock(instance, transformNaclToServer)))
  },
})

export default filterCreator
