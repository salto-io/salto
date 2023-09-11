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
  Element, InstanceElement, Value, getChangeData, isInstanceChange, isInstanceElement,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { TransformFunc, createSchemeGuard, transformValues } from '@salto-io/adapter-utils'
import Joi from 'joi'
import _ from 'lodash'
import { RECIPE_CODE_TYPE, RECIPE_TYPE } from '../../constants'
import { FilterCreator } from '../../filter'
import { isInstanceFromType } from '../../utils'
import { BlockBase } from '../cross_service/recipe_block_types'

const log = logger(module)

type keyValue = {
  key: string
  value: Value
}

type recipeInputBlock = BlockBase & {
  as: string
  provider: string
  newInput: Array<keyValue>
  input: {
    [key: string]: Value
   }
}

const RECIPE_INPUT_BLOCK_SCHEMA = Joi.object({
  keyword: Joi.string().invalid('if').required(),
  as: Joi.string().required(),
  provider: Joi.string().required(),
  input: Joi.object().min(1).unknown(true).required(),
}).unknown(true).required()

const KEY_VALUE_SCHEMA = Joi.object({
  key: Joi.string().required(),
  value: Joi.any().required(),
}).unknown(true).required()

const RECIPE_NEW_INPUT_BLOCK_SCHEMA = Joi.object({
  keyword: Joi.string().invalid('if').required(),
  as: Joi.string().required(),
  provider: Joi.string().required(),
  newInput: Joi.array().items(KEY_VALUE_SCHEMA).min(1).required(),
}).unknown(true).required()


const transformServerToNacl: TransformFunc = async ({ value }) => {
  if (createSchemeGuard<recipeInputBlock>(RECIPE_INPUT_BLOCK_SCHEMA)(value)) {
    value.newInput = [] // TODO if we change to second version change it to the 'content' item
    Object.keys(value.input).forEach(key => {
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
  if (createSchemeGuard<recipeInputBlock>(RECIPE_NEW_INPUT_BLOCK_SCHEMA)(value)) {
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
const filterCreator: FilterCreator = () => ({
  name: 'recipeBlockInputFormatFilter',
  onFetch: async (elements: Element[]) => {
    await Promise.all(elements
      .filter(isInstanceElement)
      .filter(isInstanceFromType([RECIPE_CODE_TYPE]))
      .map(instance => transformRecipeBlock(instance, transformServerToNacl)))
  },
  preDeploy: async changes => {
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
