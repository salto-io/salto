/*
*                      Copyright 2021 Salto Labs Ltd.
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
import {
  ElemID, ObjectType, BuiltinTypes, FieldDefinition,
} from '@salto-io/adapter-api'

/* Client config */

export type ClientRateLimitConfig = Partial<{
  total: number
  get: number
}> & Record<string, number>

export type ClientPageSizeConfig = Partial<{
  get: number
}> & Record<string, number>

export type ClientRetryConfig = Partial<{
  maxAttempts: number
  retryDelay: number
  // TODO add retryStrategy
}>

export type ClientBaseConfig = Partial<{
  retry: ClientRetryConfig
  rateLimit: ClientRateLimitConfig
  pageSize: ClientPageSizeConfig
}>

export const createClientConfigType = (adapter: string, bucketNames?: string[]): ObjectType => {
  const clientRateLimitConfigType = new ObjectType({
    elemID: new ElemID(adapter, 'clientRateLimitConfig'),
    fields: {
      total: { type: BuiltinTypes.NUMBER },
      get: { type: BuiltinTypes.NUMBER },
      ...Object.fromEntries((bucketNames ?? []).map(name => [name, { type: BuiltinTypes.NUMBER }])),
    } as Record<keyof ClientRateLimitConfig, FieldDefinition>,
  })

  const clientPageSizeConfigType = new ObjectType({
    elemID: new ElemID(adapter, 'clientPageSizeConfig'),
    fields: {
      // can extend to additional operations when needed
      get: { type: BuiltinTypes.NUMBER },
    } as Record<keyof ClientPageSizeConfig, FieldDefinition>,
  })

  const clientRetryConfigType = new ObjectType({
    elemID: new ElemID(adapter, 'clientRetryConfig'),
    fields: {
      maxAttempts: { type: BuiltinTypes.NUMBER },
      retryDelay: { type: BuiltinTypes.NUMBER },
    } as Record<keyof ClientRetryConfig, FieldDefinition>,
  })

  const clientConfigType = new ObjectType({
    elemID: new ElemID(adapter, 'clientConfig'),
    fields: {
      retry: { type: clientRetryConfigType },
      rateLimit: { type: clientRateLimitConfigType },
      pageSize: { type: clientPageSizeConfigType },
    } as Record<keyof ClientBaseConfig, FieldDefinition>,
  })
  return clientConfigType
}

export const validateClientConfig = (
  clientConfigPath: string,
  clientConfig?: ClientBaseConfig,
): void => {
  if (clientConfig?.rateLimit !== undefined) {
    const invalidValues = (Object.entries(clientConfig.rateLimit)
      .filter(([_name, value]) => value === 0))
    if (invalidValues.length > 0) {
      throw Error(`${clientConfigPath}.rateLimit values cannot be set to 0. Invalid keys: ${invalidValues.map(([name]) => name).join(', ')}`)
    }
  }
}
