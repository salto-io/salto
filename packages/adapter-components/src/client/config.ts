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
import { ElemID, ObjectType, BuiltinTypes, FieldDefinition, createRestriction, CORE_ANNOTATIONS } from '@salto-io/adapter-api'

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

export type ClientBaseConfig<RateLimitConfig extends ClientRateLimitConfig> = Partial<{
  retry: ClientRetryConfig
  rateLimit: RateLimitConfig
  maxRequestsPerMinute: number
  pageSize: ClientPageSizeConfig
}>

export const createClientConfigType = <RateLimitConfig extends ClientRateLimitConfig>(
  adapter: string,
  bucketNames?: (keyof RateLimitConfig)[],
): ObjectType => {
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

  const clientConfigType = new ObjectType({
    elemID: new ElemID(adapter, 'clientConfig'),
    fields: {
      retry: { refType: clientRetryConfigType },
      rateLimit: { refType: clientRateLimitConfigType },
      maxRequestsPerMinute: createFieldDefWithMin(-1),
      pageSize: { refType: clientPageSizeConfigType },
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
    const invalidValues = (Object.entries(clientConfig.rateLimit)
      .filter(([_name, value]) => value === 0))
    if (invalidValues.length > 0) {
      throw Error(`${clientConfigPath}.rateLimit values cannot be set to 0. Invalid keys: ${invalidValues.map(([name]) => name).join(', ')}`)
    }
  }
  if (clientConfig?.maxRequestsPerMinute === 0) {
    throw Error(`${clientConfigPath}.maxRequestsPerMinute value cannot be set to 0`)
  }
}
