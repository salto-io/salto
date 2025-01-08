/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { HTTPReadClientInterface, HTTPWriteClientInterface } from '../../../client'
import { EndpointByPathAndMethod } from './endpoint'

export type RESTApiClientDefinition<PaginationOptions extends string> = {
  httpClient: HTTPReadClientInterface & HTTPWriteClientInterface

  // when specified, the additional args will be expected to appear in the context
  clientArgs?: Record<string, string>

  // the endpoints the client supports
  // Note: other endpoints can be called as well, and will use the default definition.
  endpoints: EndpointByPathAndMethod<PaginationOptions>
}

/**
 * Api client definitions. Initially only REST is supported, but this can be extended.
 */
export type ApiClientDefinition<PaginationOptions extends string> = RESTApiClientDefinition<PaginationOptions>
