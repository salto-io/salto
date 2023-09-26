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
  ElemID,
  Element, InstanceElement, Values, getChangeData, isInstanceChange, isInstanceElement,
} from '@salto-io/adapter-api'
import { TransformFunc, WALK_NEXT_STEP, createSchemeGuard, transformValues, walkOnElement } from '@salto-io/adapter-utils'
import _ from 'lodash'
import Joi from 'joi'
import { RECIPE_CODE_TYPE, RECIPE_TYPE } from '../../constants'
import { FilterCreator } from '../../filter'
import { isInstanceFromType } from '../../utils'
import { createMatcher } from '../cross_service/reference_finders'
import { BlockBase } from '../cross_service/recipe_block_types'


type BlockFormula = { block: string; path: string }
const isBlockFormula = (val: Values): val is BlockFormula => (
  _.isString(val.block)
  && _.isString(val.path)
)

const formulaMatcher = createMatcher(
  [new RegExp('\\{_\\(\'data\\.[^\\.]*?\\.(?<block>\\w+)\\.(?<path>[^\\)]*?)\'\\)\\}', 'g')],
  isBlockFormula,
)
type ExtendedSchemaItem = {
  label: string
  type: string
  name: string
}

type ExtendedSchemaObject = ExtendedSchemaItem & {
  type: 'object'
  properties: Array<ExtendedSchemaItem>
}

type ExtendedSchemaObjectArray = ExtendedSchemaItem & {
  type: 'array'
  of: 'object'
  properties: Array<ExtendedSchemaItem>
}
type RecipeExtendedOutputSchemaBlock = BlockBase & {
  as: string
  provider: string
  // eslint-disable-next-line camelcase
  extended_output_schema: Values
}

const EXTENDED_SCHEMA_ITEM_SCHEMA = Joi.object({
  label: Joi.string().required(),
  name: Joi.string().required(),
  type: Joi.string().required(),
}).unknown(true).required()

const EXTENDED_SCHEMA_OBJECT_SCHEMA = EXTENDED_SCHEMA_ITEM_SCHEMA.keys({
  type: Joi.string().valid('object').required(),
  properties: Joi.array().items(EXTENDED_SCHEMA_ITEM_SCHEMA).required(),
}).unknown(true).required()

const EXTENDED_SCHEMA_OBJECT_ARRAY_SCHEMA = EXTENDED_SCHEMA_ITEM_SCHEMA.keys({
  type: Joi.string().valid('array').required(),
  of: Joi.string().valid('object').required(),
  properties: Joi.array().items(EXTENDED_SCHEMA_ITEM_SCHEMA).required(),
}).unknown(true).required()


const RECIPE_EXTENDED_OUTPUT_SCHEMA_BLOCK_SCHEMA = Joi.object({
  keyword: Joi.string().required(),
  as: Joi.string().required(),
  provider: Joi.string().required(),
  extended_output_schema: Joi.array().min(1).required(),
}).unknown(true).required()

const isExtendedOutputSchemaBlock = createSchemeGuard<
  RecipeExtendedOutputSchemaBlock
>(RECIPE_EXTENDED_OUTPUT_SCHEMA_BLOCK_SCHEMA)

const isExtendedSchemaItem = createSchemeGuard<
  ExtendedSchemaItem
>(EXTENDED_SCHEMA_ITEM_SCHEMA)

const isExtendedSchemaObject = createSchemeGuard<
  ExtendedSchemaObject
>(EXTENDED_SCHEMA_OBJECT_SCHEMA)

const isExtendedSchemaObjectArray = createSchemeGuard<
  ExtendedSchemaObjectArray
>(EXTENDED_SCHEMA_OBJECT_ARRAY_SCHEMA)

const removeUnnecessaryFromExtendedList = (
  extendedObjectList: Array<Values>,
  formulas: Values,
  path: ElemID,
  pathToFormulas: Record<string, Values>,
) : Array<ExtendedSchemaItem> => {
  const newValue: Array<ExtendedSchemaItem> = []
  if (!_.isEmpty(formulas)) { // TODO check if I want to raise exception when formulas === undefined
    let index = 0
    extendedObjectList.filter(isExtendedSchemaItem)
      .forEach(obj => { // TODO what to do with the not isExtendeSchemaObjects
        if (Object.keys(formulas).includes(obj.name)) {
          pathToFormulas[path.createNestedID(String(index)).getFullName()] = formulas[obj.name]
          newValue.push(obj)
          index += 1
        }
      })
  }
  return newValue
}

const getTransformToMinimalExtendedOutputSchemaFunc = (
  formulasByBlock: Record<string, Values>
): TransformFunc => {
  const pathToFormulas: Record<string, Values> = {}
  return async ({ value, path }) => {
    if (path !== undefined) {
      const pathParts = path.getFullNameParts()
      const endPathPart = pathParts[pathParts.length - 1]
      const extendedIndex = pathParts.findIndex(part => part === 'extended_output_schema') // TODO change to includes
      if (extendedIndex === -1) { // before or not in extended_output_schema
        if (
          isExtendedOutputSchemaBlock(value)
          && formulasByBlock[value.as] !== undefined
        ) {
          pathToFormulas[path.getFullName()] = formulasByBlock[value.as]
        }
      } else // in extended_output_schema
      if (endPathPart === 'extended_output_schema' && _.isArray(value)) {
        return removeUnnecessaryFromExtendedList(
          value,
          pathToFormulas[path.createParentID().getFullName()],
          path,
          pathToFormulas
        )
      } else if (isExtendedSchemaItem(value)) {
        if (isExtendedSchemaObject(value)) {
          value.properties = removeUnnecessaryFromExtendedList(
            value.properties,
            pathToFormulas[path.getFullName()],
            path.createNestedID('properties'),
            pathToFormulas
          )
          return value
        }
        if (isExtendedSchemaObjectArray(value)) { // TODO check ___size, ___index option
          value.properties = removeUnnecessaryFromExtendedList(
            value.properties,
            pathToFormulas[path.getFullName()].first,
            path.createNestedID('properties'),
            pathToFormulas
          )
          return value
        }
      }
    }
    return value
  }
}

const transformNaclToServer: TransformFunc = async ({ value }) => value //{
const transformRecipeBlock = async (instance: InstanceElement, transformFunc: TransformFunc): Promise<void> => {
  const a = await transformValues({
    values: instance.value,
    type: await instance.getType(),
    pathID: instance.elemID,
    strict: false,
    allowEmpty: true, // TODO check if strict and allowEmpty
    transformFunc,
    // arrayKeysFilter: extendedSchemaArrayKeys,
  }) ?? instance.value
  instance.value = a
}
const addFormulaPath = (
  formulasObject: Values,
  pathParts: Array<string>
): Values => {
  if (pathParts.length === 1) {
    formulasObject[pathParts[0]] = {} as Record<string, Values>
  } else {
    formulasObject[pathParts[0]] = addFormulaPath(
      formulasObject[pathParts[0]] ?? {}, pathParts.slice(1)
    )
  }
  return formulasObject
}

const filterCreator: FilterCreator = () => ({
  name: 'recipeBlockExtendedOutputSchemaFormatFilter',
  onFetch: async (elements: Element[]) => {
    await Promise.all(elements
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
        const a = transformRecipeBlock( // TODO change back to normal
          instance,
          getTransformToMinimalExtendedOutputSchemaFunc(formulasByBlock)
        )
        return a
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
