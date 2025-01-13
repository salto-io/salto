/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

type SourceTypeDefinition = {
  originalTypeName: string
  // when true, the original type name is renamed and all references to it point to the new type.
  // when false, it is (shallow) cloned, and no other types are impacted.
  // NOTE: renames happen BEFORE clones, and the original type name will not be accessible.
  rename: boolean
}

export type OpenAPIDefinition<ClientOptions extends string> = {
  url: string

  // rename or clone types from the OpenAPI spec
  typeAdjustments?: Record<string, SourceTypeDefinition>

  // prefix for all types and subtypes
  prefix?: string

  // when true, the sources are only used for defining the endpoints, but types are generated from responses (ducktype)
  endpointsOnly?: boolean

  // the client on which the endpoints will be added
  toClient: ClientOptions
}
