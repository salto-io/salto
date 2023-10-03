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

import { ElemID, InstanceElement, Value, Values } from '@salto-io/adapter-api'
import { TransformFunc, createSchemeGuard, transformValues } from '@salto-io/adapter-utils'
import Joi from 'joi'
import _ from 'lodash'

export type ExtendedSchemaItem = {
  label: string
  type: string
  name: string
}

export type ExtendedSchemaObject = ExtendedSchemaItem & {
  type: 'object'
  properties: Array<ExtendedSchemaItem>
}

export type ExtendedSchemaObjectArray = ExtendedSchemaItem & {
  type: 'array'
  of: 'object'
  properties: Array<ExtendedSchemaItem>
}

export type Content = Array<{
  key: string
  value: Value
  toggleCfg?: boolean
}>

const EXTENDED_SCHEMA_ITEM_SCHEMA = Joi.object({
  label: Joi.string().required(),
  name: Joi.string().required(),
  type: Joi.string().required(),
})
  .unknown(true)
  .required()

const EXTENDED_SCHEMA_OBJECT_SCHEMA = EXTENDED_SCHEMA_ITEM_SCHEMA.keys({
  type: Joi.string().valid('object').required(),
  properties: Joi.array().items(EXTENDED_SCHEMA_ITEM_SCHEMA).required(),
})
  .unknown(true)
  .required()

const EXTENDED_SCHEMA_OBJECT_ARRAY_SCHEMA = EXTENDED_SCHEMA_ITEM_SCHEMA.keys({
  type: Joi.string().valid('array').required(),
  of: Joi.string().valid('object').required(),
  properties: Joi.array().items(EXTENDED_SCHEMA_ITEM_SCHEMA).required(),
})
  .unknown(true)
  .required()

export const CONTENT_SCHEMA = Joi.array()
  .items(
    Joi.object({
      key: Joi.string().required(),
      value: Joi.any().required(),
    })
      .unknown(true)
      .required(),
  )
  .min(1)
  .required()

export const isExtendedSchemaItem = createSchemeGuard<ExtendedSchemaItem>(EXTENDED_SCHEMA_ITEM_SCHEMA)

export const isExtendedSchemaObject = createSchemeGuard<ExtendedSchemaObject>(EXTENDED_SCHEMA_OBJECT_SCHEMA)

export const isExtendedSchemaObjectArray = createSchemeGuard<ExtendedSchemaObjectArray>(
  EXTENDED_SCHEMA_OBJECT_ARRAY_SCHEMA,
)

export const isKeyValueArray = createSchemeGuard<Content>(CONTENT_SCHEMA)

const removeUnnecessaryFromExtendedList = (
  extendedObjectList: Array<Values>,
  formulas: Values,
  path: ElemID,
  pathToFormulas: Record<string, Values>,
): Array<ExtendedSchemaItem> => {
  const newValue: Array<ExtendedSchemaItem> = []
  if (formulas !== undefined && !_.isEmpty(formulas)) {
    let index = 0
    extendedObjectList.filter(isExtendedSchemaItem).forEach(obj => {
      if (Object.keys(formulas).includes(obj.name)) {
        pathToFormulas[path.createNestedID(String(index)).getFullName()] = formulas[obj.name]
        newValue.push(obj)
        index += 1
      }
    })
  }
  return newValue
}

export const transformRecipeBlock = async (instance: InstanceElement, transformFunc: TransformFunc): Promise<void> => {
  instance.value =
    (await transformValues({
      values: instance.value,
      type: await instance.getType(),
      pathID: instance.elemID,
      transformFunc,
    })) ?? instance.value
}

export const getTransformToMinimalExtendedSchemaFunc = (
  initiatePath: (value: Value) => Values | undefined,
  extnededDirection: string,
): TransformFunc => {
  const pathToFormulas: Record<string, Values> = {}
  return async ({ value, path }) => {
    if (path !== undefined) {
      const pathParts = path.getFullNameParts()
      const endPathPart = pathParts[pathParts.length - 1]
      if (!pathParts.includes(extnededDirection)) {
        // before or not in extended_output_schema
        const newFormula = initiatePath(value)
        if (newFormula !== undefined) {
          pathToFormulas[path.getFullName()] = newFormula
        }
      } // in extended_input_schema
      else if (endPathPart === extnededDirection && _.isArray(value)) {
        return removeUnnecessaryFromExtendedList(
          value,
          pathToFormulas[path.createParentID().getFullName()],
          path,
          pathToFormulas,
        )
      } else if (isExtendedSchemaItem(value)) {
        if (isExtendedSchemaObject(value)) {
          value.properties = removeUnnecessaryFromExtendedList(
            value.properties,
            pathToFormulas[path.getFullName()],
            path.createNestedID('properties'),
            pathToFormulas,
          )
          return value
        }
        if (isExtendedSchemaObjectArray(value)) {
          value.properties = removeUnnecessaryFromExtendedList(
            value.properties,
            pathToFormulas[path.getFullName()].first,
            path.createNestedID('properties'),
            pathToFormulas,
          )
          return value
        }
      }
    }
    return value
  }
}
