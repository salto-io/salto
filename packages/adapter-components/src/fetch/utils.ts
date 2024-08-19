/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { Values } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { collections, values as lowerdashValues } from '@salto-io/lowerdash'
import { TransformDefinition, TransformFunction, SingleValueTransformationFunction } from '../definitions/system/shared'
import { DATA_FIELD_ENTIRE_OBJECT } from '../definitions'

const { awu } = collections.asynciterable
const log = logger(module)

export const createValueTransformer = <TContext extends Record<string, unknown>, TSource extends Values>(
  def?: TransformDefinition<TContext, unknown>,
): TransformFunction<TContext, TSource, unknown> | SingleValueTransformationFunction<TContext, TSource, unknown> => {
  if (def === undefined) {
    return async item => [item]
  }

  const root = (value: unknown): unknown =>
    def.root !== undefined && def.root !== DATA_FIELD_ENTIRE_OBJECT && lowerdashValues.isPlainObject(value)
      ? _.get(value, def.root)
      : value

  const pick = (value: unknown): unknown =>
    def.pick !== undefined && lowerdashValues.isPlainObject(value) ? _.pick(value, def.pick) : value

  const omit = (value: unknown): unknown =>
    def.omit !== undefined && lowerdashValues.isPlainObject(value) ? _.omit(value, def.omit) : value

  const nestUnderField = (value: unknown): unknown =>
    def.nestUnderField !== undefined && def.nestUnderField !== DATA_FIELD_ENTIRE_OBJECT
      ? _.set({}, def.nestUnderField, value)
      : value

  const transformItem: TransformFunction<TContext, TSource, unknown> = async item => {
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
    return awu(transformedItems)
      .flatMap(async transformedItem =>
        collections.array.makeArray(await adjust(transformedItem)).map(res => ({ ...transformedItem, ...res })),
      )
      .toArray()
  }
  if (!def.single) {
    return transformItem
  }
  return async item => {
    const res = await transformItem(item)
    if (res.length !== 1) {
      log.warn('expected single item of type %s but transformation resulted in %d items', res.length)
    }
    // will be undefined if list is empty
    return res[0]
  }
}
