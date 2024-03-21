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
import { transformRecipeBlock } from './block_extended_output_format'

const log = logger(module)

type KeyValue = {
  key: string
  value: Value
}

type ObjectLike = {
  [key: string]: Values
}

const OBJECT_KEY_VALUE_SCHEMA = Joi.object().min(1).unknown(true).required()

const KEY_VALUE_SCHEMA = Joi.object({
  key: Joi.string().required(),
  value: Joi.any().required(),
})
  .unknown(true)
  .required()

const NEW_INPUT_SCHEMA = Joi.array().items(KEY_VALUE_SCHEMA).min(1).required()

const isObjectLike = createSchemeGuard<ObjectLike>(OBJECT_KEY_VALUE_SCHEMA)
const isKeyValue = createSchemeGuard<KeyValue>(KEY_VALUE_SCHEMA)
const isNewInputFormat = createSchemeGuard<Array<KeyValue>>(NEW_INPUT_SCHEMA)

const transformServerToNacl: TransformFunc = async ({ value, path }) => {
  if (path !== undefined && path.getFullNameParts().includes('input') && isObjectLike(value) && !isKeyValue(value)) {
    return Object.keys(value)
      .filter(key => value[key] !== undefined)
      .map(obj => ({
        key: obj,
        value: value[obj.toString()],
      }))
  }
  return value
}

const transformNaclToServer: TransformFunc = async ({ value, path }) => {
  if (path !== undefined && path.getFullNameParts().includes('input') && isNewInputFormat(value)) {
    return _.mapValues(_.keyBy(value, 'key'), 'value')
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
    if (config.enableDeployWithReferencesSupport !== true) {
      log.debug('Parsing recipe block input format was disabled')
      return
    }
    await Promise.all(
      elements
        .filter(isInstanceElement)
        .filter(elem => elem.elemID.typeName === RECIPE_CODE_TYPE)
        .map(elem => transformRecipeBlock(elem, transformServerToNacl)),
    )
  },
  preDeploy: async changes => {
    // TODO: check and add tests
    if (config.enableDeployWithReferencesSupport !== true) {
      log.debug('Parsing recipe block input format was disabled')
      return
    }
    await Promise.all(
      changes
        .filter(isInstanceChange)
        .map(getChangeData)
        .filter(instance => instance.elemID.typeName === RECIPE_TYPE)
        // Although there are changes in the "recipe__code", we only check the "recipe" type.
        // This is because the resolving hook only returns the "recipe" type.
        .map(instance => transformRecipeBlock(instance, transformNaclToServer)),
    )
  },
  onDeploy: async changes => {
    // TODO: Add tests
    if (config.enableDeployWithReferencesSupport !== true) {
      log.debug('Parsing recipe block input format was disabled')
      return
    }
    await Promise.all(
      changes
        .filter(isInstanceChange)
        .map(getChangeData)
        .filter(instance => instance.elemID.typeName === RECIPE_TYPE)
        // Although there are changes in the "recipe__code", we only check the "recipe" type.
        // This is because the resolving hook only returns the "recipe" type.
        .map(instance => transformRecipeBlock(instance, transformServerToNacl)),
    )
  },
})

export default filterCreator
