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
import {
  ElemID,
  Element,
  InstanceElement,
  Value,
  Values,
  getChangeData,
  isInstanceChange,
  isInstanceElement,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { createSchemeGuard, transformValuesSync } from '@salto-io/adapter-utils'
import Joi from 'joi'
import { RECIPE_CODE_TYPE, RECIPE_TYPE } from '../../constants'
import { FilterCreator } from '../../filter'
import { BlockBase } from '../cross_service/recipe_block_types'

const log = logger(module)

type RecipeCodeBlock = BlockBase & {
  as: string
  provider: string
  input: Array<Values>
  toggleCfg?: {
    [key: string]: boolean
  }
}

type TransformBlockFunc = (block: RecipeCodeBlock, path: ElemID | undefined) => RecipeCodeBlock

type KeyValue = {
  key: string
  value: Value
  toggleCfg?: boolean
}

// type RecipeToggleCfgBlock = BlockBase & {
//   as: string
//   provider: string
//   input: Array<KeyValue>
//   toggleCfg: {
//     [key: string]: boolean
//   }
// }

const KEY_VALUE_SCHEMA = Joi.object({
  key: Joi.string().required(),
  value: Joi.any().required(),
})
  .unknown(true)
  .required()

const RECIPE_CODE_BLOCK_SCHEMA = Joi.object({
  keyword: Joi.string().invalid('if').required(),
  as: Joi.string().required(),
  provider: Joi.string().required(),
  input: Joi.any().required(),
})
  .unknown(true)
  .required()

// const RECIPE_WITHOUT_TOGGLE_CFG_BLOCK_SCHEMA = Joi.object({
//   keyword: Joi.string().invalid('if').required(),
//   as: Joi.string().required(),
//   provider: Joi.string().required(),
//   input: Joi.array().items(KEY_VALUE_SCHEMA).min(1).required(),
// })
//   .unknown(true)
//   .required()

const isRecipeBlock = createSchemeGuard<RecipeCodeBlock>(RECIPE_CODE_BLOCK_SCHEMA)
const isKeyValueArray = createSchemeGuard<Array<KeyValue>>(Joi.array().items(KEY_VALUE_SCHEMA).min(1).required())

// const transformNaclToServer = async (value: RecipeCodeBlock): Promise<RecipeCodeBlock> => {
//   // TODO check
//   if (createSchemeGuard<RecipeToggleCfgBlock>(RECIPE_WITHOUT_TOGGLE_CFG_BLOCK_SCHEMA)(value)) {
//     value.toggleCfg = {}
//     value.input.forEach(item => {
//       if (item.toggleCfg !== undefined) {
//         value.toggleCfg[item.key] = item.toggleCfg
//         delete item.toggleCfg
//       }
//     })
//   }
//   return value
// }

// const getToggleCFGasTree = (toggleCfg: { [key: string]: boolean }): Values => {
//   const newToggleCfg: Values = {}
//   Object.keys(toggleCfg).forEach(key => {
//     const keyParts = key.split('.')
//     let currentObj = newToggleCfg
//     keyParts.forEach((part, index) => {
//       if (index === keyParts.length - 1) {
//         currentObj[part] = {
//           ...currentObj[part],
//           current: toggleCfg[key]
//         }
//       } else {
//         if (currentObj[part] === undefined) {
//           currentObj[part] = {
//             ...currentObj[part]
//           }
//         }
//         currentObj = currentObj[part]
//       }
//     })
//   })
//   return newToggleCfg
// }

// const setToggleCFG = (input: Array<KeyValue>, toggleCfg: { [key: string]: boolean }): void => {
//   input.forEach(item => {
//     if (toggleCfg[item.key] !== undefined) {
//       item.toggleCfg = toggleCfg[item.key]
//       delete toggleCfg[item.key]
//     }
//   })
//   if (Object.keys(toggleCfg).length !== 0) {
//     log.warn(`Found unknown toggleCfg keys: ${Object.keys(toggleCfg)}`)
//   }
// }

// const getToggleCfgStyle = (block: RecipeCodeBlock, key: string, path: ElemID): string => {
//   const nameParts = path.getFullNameParts()
//   const positions = nameParts.slice(nameParts.indexOf('input') + 1).filter(part => _.isNumber(part))
//   const a = positions.reduce((acc, part) => {
//     const item = acc.arr[_.toNumber(part)]
//     return ({ arr: item.value, ret: `${acc.ret}.${item.key}` })
//   }, { arr: block.input, ret: '' })
//   return a.ret + key
// }

const transformListServerToNacl = (value: Array<KeyValue>, currentPath: string, block: RecipeCodeBlock): void => {
  value.forEach((item: KeyValue) => {
    const toggleCfgName = currentPath ? `${currentPath}.${item.key}` : item.key
    if (block.toggleCfg !== undefined && block.toggleCfg[toggleCfgName] !== undefined) {
      item.toggleCfg = block.toggleCfg[toggleCfgName]
      delete block.toggleCfg[toggleCfgName]
    }
    if (isKeyValueArray(item.value)) {
      transformListServerToNacl(item.value, toggleCfgName, block)
    }
  })
}

const transformBlockServerToNacl: TransformBlockFunc = block => {
  // TODO there is something which get into infinite loop. check if here or in exten
  if (block.toggleCfg !== undefined) {
    if (isKeyValueArray(block.input)) {
      transformListServerToNacl(block.input, '', block)
      if (Object.keys(block.toggleCfg).length !== 0) {
        log.warn(`Found unknown toggleCfg keys: ${Object.keys(block.toggleCfg)}`)
      } else {
        delete block.toggleCfg
      }
    } else {
      log.debug('Block input is not an array')
    }
  }
  return block
}

const transformRecipeBlocks = async (
  instance: InstanceElement,
  transformBlockFunc: TransformBlockFunc,
): Promise<InstanceElement> => {
  instance.value =
    transformValuesSync({
      values: instance.value,
      type: await instance.getType(),
      pathID: instance.elemID,
      strict: false,
      allowEmpty: true, // TODO check if strict and allowEmpty
      transformFunc: ({ value, path }) => {
        if (isRecipeBlock(value)) {
          return transformBlockFunc(value, path)
        }
        return value
      },
      // arrayKeysFilter: extendedSchemaArrayKeys,
    }) ?? instance.value

  return instance
}

/**
 * Change the toggleCfg format of recipe blocks to support cross-service references addition.
 * Each toggleCFG key will be added to input item.
 *
 * For example:
 * input: [
 *  {
 *    key: <key_name1>
 *    value: <value_name1>
 *  },
 *  ...
 * ]
 * toggleCfg: {
 *  <key_name1>: true
 * }
 *
 * will be changed to:
 * input: [
 *  {
 *    key: <key_name1>
 *    value: <value_name1>
 *    toggleCfg: true
 *  },
 *  ...
 * ]
 */
const filterCreator: FilterCreator = ({ config }) => ({
  name: 'recipeBlockToggleCfgFormatFilter',
  onFetch: async (elements: Element[]) => {
    if (config.enableDeployWithReferencesSupport !== true) {
      log.debug('Parsing recipe block toggleCfg format is disabled')
      return
    }
    elements
      .filter(isInstanceElement)
      .filter(elem => elem.elemID.typeName === RECIPE_CODE_TYPE)
      .map(elem => transformRecipeBlocks(elem, transformBlockServerToNacl))
  },
  preDeploy: async changes => {
    if (config.enableDeployWithReferencesSupport !== true) {
      log.debug('Parsing recipe block toggleCfg format is disabled')
      return
    }
    await Promise.all(
      // TODO: write it correctly
      changes
        .filter(isInstanceChange)
        .map(getChangeData)
        .filter(change => change.elemID.typeName === RECIPE_TYPE)
        // Although there are changes in the "recipe__code", we only check the "recipe" type.
        // This is because the resolving hook only returns the "recipe" type.
        .map(instance => transformRecipeBlocks(instance, transformBlockServerToNacl)), // TODO: change to Nacl to Server
    )
  },
  onDeploy: async changes => {
    if (config.enableDeployWithReferencesSupport !== true) {
      // TODO: check
      log.debug('Parsing recipe block toggleCfg format is disabled')
      return
    }
    await Promise.all(
      changes
        .filter(isInstanceChange)
        .map(getChangeData)
        .filter(change => change.elemID.typeName === RECIPE_TYPE)
        // Although there are changes in the "recipe__code", we only check the "recipe" type.
        // This is because the resolving hook only returns the "recipe" type.
        .map(instance => transformRecipeBlocks(instance, transformBlockServerToNacl)),
    )
  },
})

export default filterCreator
