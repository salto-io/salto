/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  ElemID,
  ObjectType,
  BuiltinTypes,
  FieldDefinition,
  createRestriction,
  CORE_ANNOTATIONS,
  ListType,
} from '@salto-io/adapter-api'
import { createMatchingObjectType } from '@salto-io/adapter-utils'

/* Client config */

export type ClientRateLimitConfig = Partial<{
  total: number
  get: number
  deploy: number
}>

export type ClientPageSizeConfig = Partial<{
  get: number
}>

export type ClientRetryConfig = Partial<{
  maxAttempts: number
  retryDelay: number
  // This is not included in clientRetryConfigType because currently we don't want to allow the user to change it
  additionalStatusCodesToRetry: number[]
}>

export type ClientTimeoutConfig = Partial<{
  maxDuration: number
  retryOnTimeout: boolean
  lastRetryNoTimeout: boolean
}>

export type ResponseLogStrategy = 'truncate' | 'omit' | 'full'
// configuration for controlling logging of full http responses.
// if an endpoint matching the pattern (or any endpoint if pattern is not provided) matches (all of) the following:
// - logged more than "numItems" times (default: 0)
// - the current response size is over "size" (default: 0)
// then the strategy is used - if `omit`, the "Full http response" log is omitted completely, and if `truncate` the response is truncated.
// note: strategies are calculated in order and the first match wins.
type ClientLoggingStrategyByEndpointConfig = {
  // when pattern is omitted, all endpoints match
  pattern?: string
  // note: there is an OR between numItems and size
  numItems?: number
  size?: number
  strategy: ResponseLogStrategy
}

export type ClientLoggingConfig = Partial<{
  responseStrategies: ClientLoggingStrategyByEndpointConfig[]
}>

export type ClientBaseConfig<RateLimitConfig extends ClientRateLimitConfig> = Partial<{
  retry: ClientRetryConfig
  rateLimit: RateLimitConfig
  maxRequestsPerMinute: number
  delayPerRequestMS: number
  useBottleneck: boolean
  pageSize: ClientPageSizeConfig
  timeout: ClientTimeoutConfig
  logging: ClientLoggingConfig
}>

export const createClientConfigType = <RateLimitConfig extends ClientRateLimitConfig>({
  adapter,
  bucketNames,
  additionRateLimitFields,
  additionalClientFields,
}: {
  adapter: string
  bucketNames?: (keyof RateLimitConfig)[]
  additionRateLimitFields?: Record<string, FieldDefinition>
  additionalClientFields?: Record<string, FieldDefinition>
}): ObjectType => {
  const createFieldDefWithMin = (min: number): FieldDefinition => ({
    refType: BuiltinTypes.NUMBER,
    // note: not enforced yet
    [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
      min,
    }),
  })

  const clientRateLimitConfigType = new ObjectType({
    elemID: new ElemID(adapter, 'clientRateLimitConfig'),
    fields: {
      total: createFieldDefWithMin(-1),
      get: createFieldDefWithMin(-1),
      ...Object.fromEntries((bucketNames ?? []).map(name => [name, createFieldDefWithMin(-1)])),
      ...additionRateLimitFields,
    },
    annotations: {
      [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
    },
  })

  const clientPageSizeFields: Record<keyof Required<ClientPageSizeConfig>, FieldDefinition> = {
    // can extend to additional operations when needed
    get: createFieldDefWithMin(1),
  }
  const clientPageSizeConfigType = new ObjectType({
    elemID: new ElemID(adapter, 'clientPageSizeConfig'),
    fields: clientPageSizeFields,
    annotations: {
      [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
    },
  })

  const clientRetryConfigType = new ObjectType({
    elemID: new ElemID(adapter, 'clientRetryConfig'),
    fields: {
      maxAttempts: createFieldDefWithMin(1),
      retryDelay: { refType: BuiltinTypes.NUMBER },
    },
    annotations: {
      [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
    },
  })

  const clientTimeoutConfigType = createMatchingObjectType<ClientTimeoutConfig>({
    elemID: new ElemID(adapter, 'clientTimeoutConfig'),
    fields: {
      maxDuration: { refType: BuiltinTypes.NUMBER },
      retryOnTimeout: { refType: BuiltinTypes.BOOLEAN },
      lastRetryNoTimeout: { refType: BuiltinTypes.BOOLEAN },
    },
    annotations: {
      [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
    },
  })

  const clientLoggingStrategyByEndpointConfigType = createMatchingObjectType<ClientLoggingStrategyByEndpointConfig>({
    elemID: new ElemID(adapter, 'clientLoggingResponseConfig'),
    fields: {
      pattern: {
        refType: BuiltinTypes.STRING,
      },
      numItems: {
        refType: BuiltinTypes.NUMBER,
      },
      size: {
        refType: BuiltinTypes.NUMBER,
      },
      strategy: {
        refType: BuiltinTypes.STRING,
        annotations: {
          _required: true,
        },
      },
    },
    annotations: {
      [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
    },
  })

  const clientLoggingConfigType = createMatchingObjectType<ClientLoggingConfig>({
    elemID: new ElemID(adapter, 'clientLoggingConfig'),
    fields: {
      responseStrategies: { refType: new ListType(clientLoggingStrategyByEndpointConfigType) },
    },
    annotations: {
      [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
    },
  })

  const clientConfigType = new ObjectType({
    elemID: new ElemID(adapter, 'clientConfig'),
    fields: {
      retry: { refType: clientRetryConfigType },
      rateLimit: { refType: clientRateLimitConfigType },
      maxRequestsPerMinute: createFieldDefWithMin(-1),
      delayPerRequestMS: createFieldDefWithMin(0),
      useBottleneck: { refType: BuiltinTypes.BOOLEAN },
      pageSize: { refType: clientPageSizeConfigType },
      timeout: { refType: clientTimeoutConfigType },
      logging: { refType: clientLoggingConfigType },
      ...additionalClientFields,
    },
    annotations: {
      [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
    },
  })
  return clientConfigType
}

export const validateClientConfig = <RateLimitConfig extends ClientRateLimitConfig>(
  clientConfigPath: string,
  clientConfig?: ClientBaseConfig<RateLimitConfig>,
): void => {
  if (clientConfig?.rateLimit !== undefined) {
    const invalidValues = Object.entries(clientConfig.rateLimit).filter(([_name, value]) => value === 0)
    if (invalidValues.length > 0) {
      throw Error(
        `${clientConfigPath}.rateLimit values cannot be set to 0. Invalid keys: ${invalidValues.map(([name]) => name).join(', ')}`,
      )
    }
  }
  if (clientConfig?.maxRequestsPerMinute === 0) {
    throw Error(`${clientConfigPath}.maxRequestsPerMinute value cannot be set to 0`)
  }
}
