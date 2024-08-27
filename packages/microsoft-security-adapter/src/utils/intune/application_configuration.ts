/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { XMLBuilder, XMLParser } from 'fast-xml-parser'
import { inspect } from 'util'
import { safeJsonStringify, validatePlainObject } from '@salto-io/adapter-utils'
import { definitions } from '@salto-io/adapter-components'
import { logger } from '@salto-io/logging'
import { intuneConstants } from '../../constants'
import { AdjustFunctionSingle as AdjustFunctionSingleFetch } from '../../definitions/fetch/shared/types'
import { AdjustFunctionSingle as AdjustFunctionSingleDeploy } from '../../definitions/deploy/shared/types'

const { APPLICATION_CONFIGURATION_MANAGED_DEVICE_TYPE_NAME, PAYLOAD_JSON_FIELD_NAME, ENCODED_SETTING_XML_FIELD_NAME } =
  intuneConstants

const log = logger(module)

const xmlParser = new XMLParser()
const xmlBuilder = new XMLBuilder()

const transformFieldWithFunction: <TContext = definitions.ContextParams>(
  fieldName: string,
  transformFunction: (value: unknown) => unknown,
) => definitions.AdjustFunctionSingle<TContext> =
  (fieldName, transformFunction) =>
  async ({ value, typeName }) => {
    validatePlainObject(value, typeName)
    try {
      return { value: { ...value, [fieldName]: transformFunction(value[fieldName]) } }
    } catch (e) {
      log.error('Failed to parse field: %s for type: %s', fieldName, typeName)
      return { value }
    }
  }

const decodeSingleBase64Field = (fieldValue: unknown, wrapper: (value: string) => object): unknown => {
  if (typeof fieldValue === 'string') {
    return wrapper(Buffer.from(fieldValue, 'base64').toString('utf8'))
  }
  throw new Error(`Field value is not a string, cannot decode base64 field. Received: ${inspect(fieldValue)}`)
}

const encodeSingleBase64Field = (fieldValue: unknown, wrapper: (value: object | null) => string): unknown => {
  validatePlainObject(fieldValue, APPLICATION_CONFIGURATION_MANAGED_DEVICE_TYPE_NAME)
  return Buffer.from(wrapper(fieldValue)).toString('base64')
}

export const decodePayloadJsonField: AdjustFunctionSingleFetch = transformFieldWithFunction(
  PAYLOAD_JSON_FIELD_NAME,
  requestValue => decodeSingleBase64Field(requestValue, JSON.parse),
)

export const encodePayloadJsonField: AdjustFunctionSingleDeploy = transformFieldWithFunction(
  PAYLOAD_JSON_FIELD_NAME,
  requestValue => encodeSingleBase64Field(requestValue, safeJsonStringify),
)

export const parseSettingXmlField: AdjustFunctionSingleFetch = transformFieldWithFunction(
  ENCODED_SETTING_XML_FIELD_NAME,
  requestValue => decodeSingleBase64Field(requestValue, xmlParser.parse.bind(xmlParser)),
)

export const buildSettingXmlField: AdjustFunctionSingleDeploy = transformFieldWithFunction(
  ENCODED_SETTING_XML_FIELD_NAME,
  requestValue => encodeSingleBase64Field(requestValue, xmlBuilder.build.bind(xmlBuilder)),
)
