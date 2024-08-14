/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ClientBaseParams, HTTPReadClientInterface, HTTPWriteClientInterface, ResponseValue } from '../../../client'
import { ContextParams } from '../shared'
import { HTTPEndpointIdentifier, RequestArgs } from './types'

export type ClientRequestArgsNoPath = Omit<ClientBaseParams, 'url'>

export type PaginationFunction = <ClientOptions extends string>({
  responseData,
  currentParams,
  responseHeaders,
  endpointIdentifier,
}: {
  responseData: ResponseValue | ResponseValue[]
  currentParams: ClientRequestArgsNoPath
  responseHeaders?: Record<string, unknown>
  endpointIdentifier: HTTPEndpointIdentifier<ClientOptions>
}) => ClientRequestArgsNoPath[]

// creates a pagination function that receives a single-page response and returns the next page requests
export type PaginationFuncCreator<ClientOptions extends string> = (args: {
  client: HTTPReadClientInterface & HTTPWriteClientInterface
  endpointIdentifier: HTTPEndpointIdentifier<ClientOptions>
  params: ContextParams
}) => PaginationFunction

export type PaginationDefinitions<ClientOptions extends string> = {
  funcCreator: PaginationFuncCreator<ClientOptions>
  clientArgs?: RequestArgs
}
