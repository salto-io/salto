/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { XMLBuilder, XMLParser } from 'fast-xml-parser'
import { safeJsonStringify, validatePlainObject } from '@salto-io/adapter-utils'
import { definitions } from '@salto-io/adapter-components'
import { logger } from '@salto-io/logging'

const log = logger(module)

const xmlParser = new XMLParser()
const xmlBuilder = new XMLBuilder()

const transformFieldsWithFunction: <TContext = definitions.ContextParams>(
  transformFunction: (value: unknown) => unknown,
  ...fieldNames: string[]
) => definitions.AdjustFunctionSingle<TContext> =
  (transformFunction, ...fieldNames) =>
  async ({ value, typeName }) => {
    validatePlainObject(value, typeName)
    const newValue = { ...value }
    fieldNames.forEach(fieldName => {
      const requestValue = value[fieldName]
      try {
        if (requestValue !== undefined) {
          newValue[fieldName] = transformFunction(requestValue)
        }
      } catch (e) {
        log.error('Failed to parse field: %s for type: %s', fieldName, typeName)
      }
    })
    return { value: newValue }
  }

const decodeSingleBase64Field = (fieldValue: unknown, wrapper: (value: string) => object): unknown =>
  typeof fieldValue === 'string' ? wrapper(Buffer.from(fieldValue, 'base64').toString('utf8')) : fieldValue

const encodeSingleBase64Field = (fieldValue: unknown, wrapper: (value: object | null) => string): unknown =>
  typeof fieldValue === 'object' ? Buffer.from(wrapper(fieldValue)).toString('base64') : fieldValue

export const decodeBase64JsonFields: <TContext = definitions.ContextParams>(
  ...fieldNames: string[]
) => definitions.AdjustFunctionSingle<TContext> = (...fieldNames) =>
  transformFieldsWithFunction(requestValue => decodeSingleBase64Field(requestValue, JSON.parse), ...fieldNames)

export const encodeBase64JsonFields: <TContext = definitions.ContextParams>(
  ...fieldNames: string[]
) => definitions.AdjustFunctionSingle<TContext> = (...fieldNames) =>
  transformFieldsWithFunction(requestValue => encodeSingleBase64Field(requestValue, safeJsonStringify), ...fieldNames)

export const parseBase64XmlFields: <TContext = definitions.ContextParams>(
  ...fieldNames: string[]
) => definitions.AdjustFunctionSingle<TContext> = (...fieldNames) =>
  transformFieldsWithFunction(
    requestValue => decodeSingleBase64Field(requestValue, xmlParser.parse.bind(xmlParser)),
    ...fieldNames,
  )

export const buildBase64XmlFields: <TContext = definitions.ContextParams>(
  ...fieldNames: string[]
) => definitions.AdjustFunctionSingle<TContext> = (...fieldNames) =>
  transformFieldsWithFunction(
    requestValue => encodeSingleBase64Field(requestValue, xmlBuilder.build.bind(xmlBuilder)),
    ...fieldNames,
  )
