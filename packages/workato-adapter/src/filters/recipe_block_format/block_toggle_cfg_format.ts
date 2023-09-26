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

type KeyValue = {
  key: string
  value: Value
  toggleCfg?: boolean
}

type RecipeToggleCfgBlock = BlockBase & {
  as: string
  provider: string
  content: Array<KeyValue>
  toggleCfg: {
    [key: string]: boolean
   }
}

const KEY_VALUE_SCHEMA = Joi.object({
  key: Joi.string().required(),
  value: Joi.any().required(),
}).unknown(true).required()

const RECIPE_TOGGLE_CFG_BLOCK_SCHEMA = Joi.object({
  keyword: Joi.string().invalid('if').required(),
  as: Joi.string().required(),
  provider: Joi.string().required(),
  content: Joi.array().items(KEY_VALUE_SCHEMA).min(1).required(),
  toggleCfg: Joi.object().min(1).required(),
}).unknown(true).required()

// const RECIPE_NEW_INPUT_BLOCK_SCHEMA = Joi.object({
//   keyword: Joi.string().invalid('if').required(),
//   as: Joi.string().required(),
//   provider: Joi.string().required(),
//   content: Joi.array().items(KEY_VALUE_SCHEMA).min(1).required(),
// }).unknown(true).required()


const transformServerToNacl: TransformFunc = async ({ value }) => {
  if (createSchemeGuard<RecipeToggleCfgBlock>(RECIPE_TOGGLE_CFG_BLOCK_SCHEMA)(value)) {
    value.content.forEach(item => {
      if (value.toggleCfg[item.key] !== undefined) {
        item.toggleCfg = value.toggleCfg[item.key]
        delete value.toggleCfg[item.key]
      }
    })
    if (Object.keys(value.toggleCfg).length !== 0) {
      log.warn(`Found unknown toggleCfg keys: ${Object.keys(value.toggleCfg)}`)
    }
    return _.omit(value, 'toggleCfg')
  }
  return value
}

const transformNaclToServer: TransformFunc = async ({ value }) => value
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
 * Change the toggleCfg format of recipe blocks to support cross-service references addition.
 * Each toggleCFG key will be addws to content item.
 */
const filterCreator: FilterCreator = () => ({
  name: 'recipeBlockToggleCfgFormatFilter',
  onFetch: async (elements: Element[]) => {
    await Promise.all(elements
      .filter(isInstanceElement)
      .filter(isInstanceFromType([RECIPE_CODE_TYPE]))
      .map(instance => transformRecipeBlock(instance, transformServerToNacl)))
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
