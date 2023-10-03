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
import { Element, isInstanceElement } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { TransformFunc, createSchemeGuard } from '@salto-io/adapter-utils'
import Joi from 'joi'
import _ from 'lodash'
import { RECIPE_CODE_TYPE } from '../../constants'
import { FilterCreator } from '../../filter'
import { isInstanceFromType } from '../../utils'
import { BlockBase } from '../cross_service/recipe_block_types'
import { CONTENT_SCHEMA, Content, isKeyValueArray, transformRecipeBlock } from './utils'

const log = logger(module)

type RecipeToggleCfgBlock = BlockBase & {
  as: string
  provider: string
  content: Content
  toggleCfg: {
    [key: string]: boolean
  }
}

const RECIPE_TOGGLE_CFG_BLOCK_SCHEMA = Joi.object({
  keyword: Joi.string().invalid('if').required(),
  as: Joi.string().required(),
  provider: Joi.string().required(),
  content: CONTENT_SCHEMA,
  toggleCfg: Joi.object().min(1).required(),
})
  .unknown(true)
  .required()

// const RECIPE_NEW_INPUT_BLOCK_SCHEMA = Joi.object({
//   keyword: Joi.string().invalid('if').required(),
//   as: Joi.string().required(),
//   provider: Joi.string().required(),
//   content: Joi.array().items(KEY_VALUE_SCHEMA).min(1).required(),
// }).unknown(true).required()

const transformServerToNacl: TransformFunc = async ({ value }) => {
  const toggleCfgToContent = (prefix: string, content: Content): Content =>
    content.map(item => {
      const key = `${prefix}${item.key}`
      if (value.toggleCfg[key] !== undefined) {
        item.toggleCfg = value.toggleCfg[key]
        delete value.toggleCfg[key]
      }
      if (isKeyValueArray(item.value)) {
        item.value = toggleCfgToContent(`${key}.`, item.value)
      }
      return item
    })

  if (createSchemeGuard<RecipeToggleCfgBlock>(RECIPE_TOGGLE_CFG_BLOCK_SCHEMA)(value)) {
    toggleCfgToContent('', value.content)

    if (Object.keys(value.toggleCfg).length !== 0) {
      log.warn(`Found unknown toggleCfg keys: ${Object.keys(value.toggleCfg)}`)
    }
    return _.omit(value, 'toggleCfg')
  }
  return value
}

/**
 * Change the toggleCfg format of recipe blocks to support cross-service references addition.
 * Each toggleCFG key will be addws to content item.
 */
const filterCreator: FilterCreator = ({ config }) => ({
  name: 'recipeBlockToggleCfgFormatFilter',
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
})

export default filterCreator
