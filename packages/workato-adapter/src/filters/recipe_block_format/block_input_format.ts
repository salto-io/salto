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
import { Element, Value, Values, getChangeData, isInstanceChange, isInstanceElement } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { TransformFunc, createSchemeGuard } from '@salto-io/adapter-utils'
import Joi from 'joi'
import _ from 'lodash'
import { RECIPE_CODE_TYPE, RECIPE_TYPE } from '../../constants'
import { FilterCreator } from '../../filter'
import { isInstanceFromType } from '../../utils'
import { BlockBase } from '../cross_service/recipe_block_types'
import { CONTENT_SCHEMA, Content, isKeyValueArray, transformRecipeBlock } from './utils'

const log = logger(module)

type RecipeInputBlock = BlockBase & {
  as: string
  provider: string
  content: Content
  input: Values
}

const RECIPE_INPUT_BLOCK_SCHEMA = Joi.object({
  keyword: Joi.string().invalid('if').required(),
  as: Joi.string().required(),
  provider: Joi.string().required(),
  input: Joi.object().min(1).unknown(true).required(),
})
  .unknown(true)
  .required()

const RECIPE_NEW_INPUT_BLOCK_SCHEMA = Joi.object({
  keyword: Joi.string().invalid('if').required(),
  as: Joi.string().required(),
  provider: Joi.string().required(),
  content: CONTENT_SCHEMA,
})
  .unknown(true)
  .required()

const isValues = (value: Value): value is Values => _.isObject(value) && !_.isArray(value)

const inputToContent = (input: Values): Content =>
  Object.keys(input).map(key => ({
    key,
    value: isValues(input[key]) ? inputToContent(input[key]) : input[key],
  }))

const transformServerToNacl: TransformFunc = async ({ value }) => {
  if (createSchemeGuard<RecipeInputBlock>(RECIPE_INPUT_BLOCK_SCHEMA)(value)) {
    value.content = inputToContent(value.input)
    if (Object.keys(value.input).length !== Object.keys(value.content).length) {
      log.warn(
        `Unknown input keys found in recipe block ${value.as}:\nAll input keys - ${Object.keys(value.input)}\nAll content keys - ${Object.keys(value.content.map(item => item.key))}`,
      )
    }
    return _.omit(value, 'input')
  }
  return value
}

const contentToInput = (content: Content): Values => {
  const input: Values = {}
  content.forEach(item => {
    input[item.key] = isKeyValueArray(item.value) ? contentToInput(item.value) : item.value
  })
  return input
}

const transformNaclToServer: TransformFunc = async ({ value }) => {
  if (createSchemeGuard<RecipeInputBlock>(RECIPE_NEW_INPUT_BLOCK_SCHEMA)(value)) {
    value.input = contentToInput(value.content)
    if (Object.keys(value.input).length !== Object.keys(value.content).length) {
      log.warn(
        `Unknown content keys found in recipe block ${value.as}:\nAll input keys - ${Object.keys(value.input)}\nAll content keys - ${Object.keys(value.content.map(item => item.key))}`,
      )
    }
    return _.omit(value, 'content')
  }
  return value
}

/**
 * Change the input format of recipe blocks to support cross-service references addition.
 * From each input key-value we will create a new item with key and value.
 * For example:
 * input: {
 *  <key_name1> : <value_name1>,
 *  ...
 * }
 * will be changed to:
 * input: [
 *  {
 *    key: <key_name1>
 *    value: <value_name1>
 *  },
 *  ...
 * ]
 */
const filterCreator: FilterCreator = ({ config }) => ({
  name: 'recipeBlockInputFormatFilter',
  onFetch: async (elements: Element[]) => {
    if (config.fetch.enableExperimentalSupportingDeploy) {
      await Promise.all(
        elements
          .filter(isInstanceElement)
          .filter(isInstanceFromType([RECIPE_CODE_TYPE]))
          .map(instance => transformRecipeBlock(instance, transformServerToNacl)),
      )
    }
  },
  preDeploy: async changes => {
    await Promise.all(
      changes
        .filter(isInstanceChange)
        .map(getChangeData)
        .filter(isInstanceFromType([RECIPE_TYPE]))
        // Although there are changes in the "recipe__code", we only check the "recipe" type.
        // This is because the resolving hook only returns the "recipe" type.
        .map(instance => transformRecipeBlock(instance, transformNaclToServer)),
    )
  },
})

export default filterCreator
