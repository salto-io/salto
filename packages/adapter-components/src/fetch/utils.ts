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
import _ from 'lodash'
import stableStringify from 'json-stable-stringify'
import { Values } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { collections, values as lowerdashValues } from '@salto-io/lowerdash'
import { TransformDefinition, TransformFunction, SingleValueTransformationFunction } from '../definitions/system/shared'
import { DATA_FIELD_ENTIRE_OBJECT } from '../definitions'

const log = logger(module)

export const createValueTransformer = <TContext extends Record<string, unknown>, TSource extends Values>(
  def?: TransformDefinition<TContext, unknown>
): TransformFunction<TContext, TSource, unknown> | SingleValueTransformationFunction<TContext, TSource, unknown> => {
  if (def === undefined) {
    return item => [item]
  }

  const root = (value: unknown): unknown => ((
    def.root !== undefined
    && def.root !== DATA_FIELD_ENTIRE_OBJECT
    && lowerdashValues.isPlainObject(value)
  )
    ? _.get(value, def.root)
    : value)

  const pick = (value: unknown): unknown => ((def.pick !== undefined && lowerdashValues.isPlainObject(value))
    ? _.pick(value, def.pick)
    : value)

  const omit = (value: unknown): unknown => ((def.omit !== undefined && lowerdashValues.isPlainObject(value))
    ? _.omit(value, def.omit)
    : value)

  const nestUnderField = (value: unknown): unknown => ((def.nestUnderField !== undefined)
    ? _.set({}, def.nestUnderField, value)
    : value)

  const transformItem: TransformFunction<TContext, TSource, unknown> = item => {
    const transformedValues = _(collections.array.makeArray(root(item.value)))
      .map(pick)
      .map(omit)
      .map(nestUnderField)
      .value()
    const transformedItems = transformedValues.map(value => ({
      ...item,
      value,
    }))
    const { adjust } = def
    if (adjust === undefined) {
      return transformedItems
    }
    return transformedItems.map(transformedItem => ({ ...transformedItem, ...adjust(transformedItem) }))
  }
  if (!def.single) {
    return transformItem
  }
  return item => {
    const res = transformItem(item)
    if (res.length !== 1) {
      log.warn('expected single item of type %s but transformation resulted in %d items', res.length)
    }
    // will be undefined if list is empty
    return res[0]
  }
}

export const serviceIdCreator = (
  serviceIdFields: string[], typeName: string,
): (
  (entry: Values) => string
) => entry => (
  stableStringify({
    typeName,
    ids: _.pick(entry, serviceIdFields),
  })
)
