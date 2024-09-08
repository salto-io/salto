/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { Values } from '@salto-io/adapter-api'
import { Response, ResponseValue } from '../../../client'

export type HTTPMethod = 'get' | 'post' | 'put' | 'patch' | 'delete' | 'head' | 'options'

export type EndpointPath = `/${string}`

export type HTTPEndpointIdentifier<ClientOptions extends string> = {
  // specify the client to use to call the endpoint - defaults to the default client as specified in client.default
  client?: ClientOptions
  path: EndpointPath
  // when not specified, the method is assumed to be 'get'
  method?: HTTPMethod
}

export type RequestArgs = {
  headers?: Record<string, string>
  queryArgs?: Record<string, string | string[]>
  params?: Record<string, Values>
  queryParamsSerializer?: {
    // when multiple query args are provided:
    // false (default): &arg[]=val1&arg[]=val2
    // true: &arg[0]=val1&arg[1]=val2
    // null: &arg=val1&arg=val2
    indexes?: boolean | null
    // when true, empty values will be omitted from the query params
    omitEmpty?: boolean
  }
  // TODO support x-www-form-urlencoded + URLSearchParams
  body?: unknown
}

export type PollingArgs = {
  interval: number
  retries: number
  checkStatus: (response: Response<ResponseValue | ResponseValue[]>) => boolean
  // This param allows to retry on error status codes, this is only needed when you know your polling will throw in the process
  retryOnStatus?: number[]
}

export type HTTPEndpointDetails<PaginationOptions extends string | 'none'> = RequestArgs & {
  omitBody?: boolean

  additionalValidStatuses?: number[]

  // the strategy to use to get all response pages
  pagination?: PaginationOptions

  // set this to mark as endpoint as safe for fetch. other endpoints can only be called during deploy.
  readonly?: boolean

  polling?: PollingArgs
}

export type DeployHTTPEndpointDetails = Omit<HTTPEndpointDetails<'none'>, 'pagination' | 'readonly'>
