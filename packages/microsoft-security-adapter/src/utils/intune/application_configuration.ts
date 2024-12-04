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

const { APPLICATION_CONFIGURATION_MANAGED_DEVICE_TYPE_NAME, PAYLOAD_JSON_FIELD_NAME, ENCODED_SETTING_XML_FIELD_NAME } =
  intuneConstants

const log = logger(module)

const xmlParser = new XMLParser()
const xmlBuilder = new XMLBuilder()

const decodeSingleBase64Field = (fieldValue: unknown, fieldType: 'xml' | 'json'): unknown => {
  const wrapper = fieldType === 'xml' ? xmlParser.parse.bind(xmlParser) : JSON.parse
  if (fieldValue === undefined) {
    return undefined
  }
  if (typeof fieldValue === 'string') {
    return wrapper(Buffer.from(fieldValue, 'base64').toString('utf8'))
  }
  throw new Error(`Field value is not a string, cannot decode base64 field. Received: ${inspect(fieldValue)}`)
}

const encodeSingleBase64Field = (fieldValue: unknown, fieldType: 'xml' | 'json'): string | undefined => {
  if (fieldValue === undefined) {
    return undefined
  }
  validatePlainObject(fieldValue, APPLICATION_CONFIGURATION_MANAGED_DEVICE_TYPE_NAME)
  const wrapper = fieldType === 'xml' ? xmlBuilder.build.bind(xmlBuilder) : safeJsonStringify
  return Buffer.from(wrapper(fieldValue)).toString('base64')
}

export const parseApplicationConfigurationBinaryFields: <TContext = definitions.ContextParams>(
  operation: 'fetch' | 'deploy',
) => definitions.AdjustFunctionSingle<TContext> =
  operation =>
  async ({ value }) => {
    validatePlainObject(value, APPLICATION_CONFIGURATION_MANAGED_DEVICE_TYPE_NAME)
    const parseField = operation === 'fetch' ? decodeSingleBase64Field : encodeSingleBase64Field
    try {
      return {
        value: {
          ...value,
          [PAYLOAD_JSON_FIELD_NAME]: parseField(value[PAYLOAD_JSON_FIELD_NAME], 'json'),
          [ENCODED_SETTING_XML_FIELD_NAME]: parseField(value[ENCODED_SETTING_XML_FIELD_NAME], 'xml'),
        },
      }
    } catch {
      log.error(
        'Failed to %s binary fields for type: %s',
        operation === 'fetch' ? 'decode' : 'encode',
        APPLICATION_CONFIGURATION_MANAGED_DEVICE_TYPE_NAME,
      )
      return { value }
    }
  }
