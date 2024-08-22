/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { Value } from '@salto-io/adapter-api'
import { ClientLoggingConfig, ResponseLogStrategy } from '../definitions/user/client_config'

export type FullResponseLogFilter = (args: { responseText: string; url: string }) => ResponseLogStrategy

const DEFAULT_LOGGING_CONFIG: ClientLoggingConfig = {
  responseStrategies: [
    // by default, truncate logs larger than ~80K
    {
      size: 80 * 1000,
      strategy: 'truncate',
    },
  ],
}

export const createResponseLogFilter = (
  clientLoggingConfig: ClientLoggingConfig = DEFAULT_LOGGING_CONFIG,
): FullResponseLogFilter => {
  if (clientLoggingConfig === undefined) {
    return () => 'full'
  }
  let allRequests = 0
  const counters = Object.fromEntries(
    (clientLoggingConfig.responseStrategies ?? []).map(def => def.pattern ?? '').map(p => [p, 0]),
  )
  return ({ responseText, url }) => {
    allRequests += 1
    clientLoggingConfig.responseStrategies?.forEach(({ pattern }) => {
      if (pattern !== undefined && new RegExp(pattern).test(url)) {
        counters[pattern] += 1
      }
    })

    const strategy = clientLoggingConfig.responseStrategies
      ?.filter(({ pattern }) => pattern === undefined || new RegExp(pattern).test(url))
      ?.filter(({ pattern, numItems }) => (pattern === undefined ? allRequests : counters[pattern]) > (numItems ?? 0))
      ?.find(({ size }) => responseText.length >= (size ?? 0))?.strategy

    return strategy ?? 'full'
  }
}

export const truncateReplacer = (_key: string, value: Value): Value => {
  if (Array.isArray(value)) {
    return value.slice(0, 50)
  }
  if (_.isString(value) && value.length > 500) {
    return value.slice(0, 500)
  }
  return value
}
