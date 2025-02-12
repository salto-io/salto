/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ElemID, InstanceElement, isInstanceElement } from '@salto-io/adapter-api'
import { createSchemeGuard, transformValuesSync } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { regex as lowerdashRegex } from '@salto-io/lowerdash'
import Joi from 'joi'
import _ from 'lodash'
import { MaskingConfig } from '../config/config'
import { FilterCreator } from '../filter'

const log = logger(module)

export const MASK_VALUE = '<SECRET_TOKEN>'

type Header = {
  name: string
  value: string
}

const HEADERS_SCHEME = Joi.array().items(
  Joi.object({
    name: Joi.string().allow('').required(),
    value: Joi.string().allow('').required(),
  }).unknown(true),
)

const isHeaders = createSchemeGuard<Header[]>(HEADERS_SCHEME, 'Found an invalid headers in automation')

const maskHeaders = (headers: Header[], headersToMask: string[], id: ElemID): void => {
  const headerRegexes = headersToMask.map(header => new RegExp(`^${header}$`))
  headers
    .filter(({ name }) => headerRegexes.some(regex => regex.test(name)))
    .forEach(header => {
      log.trace(`Masked header ${header.name} in ${id.getFullName()}`)
      header.value = MASK_VALUE
    })
}

const maskValues = (instance: InstanceElement, masking: MaskingConfig): void => {
  instance.value =
    transformValuesSync({
      values: instance.value,
      type: instance.getTypeSync(),
      pathID: instance.elemID,
      strict: false,
      allowEmptyArrays: true,
      allowEmptyObjects: true,
      transformFunc: ({ value, path }) => {
        if (path?.name === 'headers' && isHeaders(value)) {
          maskHeaders(value, masking.automationHeaders, instance.elemID)
        }

        if (
          _.isString(value) &&
          masking.secretRegexps.some(matcher => lowerdashRegex.isFullRegexMatch(value, matcher))
        ) {
          log.trace(`Masked value ${path?.getFullName()}`)
          return MASK_VALUE
        }
        return value
      },
    }) ?? {}
}

/**
 * Replace sensitive data in the NaCls with some placeholder
 */
const filter: FilterCreator = ({ config }) => ({
  name: 'maskingFilter',
  onFetch: async elements => {
    if (config.masking.automationHeaders.length === 0 && config.masking.secretRegexps.length === 0) {
      return
    }

    elements.filter(isInstanceElement).forEach(instance => {
      maskValues(instance, config.masking)
    })
  },
})

export default filter
