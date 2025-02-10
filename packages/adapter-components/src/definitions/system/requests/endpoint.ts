/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { DefaultWithCustomizations } from '../shared'
import { EndpointPath, HTTPEndpointDetails, HTTPMethod } from './types'

type ClientEndpoints<PaginationOptions extends string> = Partial<
  Record<HTTPMethod, HTTPEndpointDetails<PaginationOptions>>
>

export type EndpointByPathAndMethod<PaginationOptions extends string> = DefaultWithCustomizations<
  ClientEndpoints<PaginationOptions>,
  EndpointPath
>
