/*
*                      Copyright 2024 Salto Labs Ltd.
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

type SourceTypeDefinition = {
  originalTypeName: string
  // when true, the original type name is renamed and all references to it point to the new type.
  // when false, it is (shallow) cloned, and no other types are impacted.
  // NOTE: renames happen BEFORE clones, and the original type name will not be accessible.
  rename: boolean
}

export type OpenAPIDefinition<
  ClientOptions extends string,
> = {
  url: string
  // avoid importing parts of the swagger (in order to avoid conflicts)
  // filter?: RegExp

  // rename or clone types from the OpenAPI spec
  // TODO replaces the old typeNameOverrides + additionalTypes
  typeAdjustments?: Record<string, SourceTypeDefinition>

  // prefix for all types and subtypes
  prefix?: string

  // when true, the sources are only used for defining the endpoints, but types are generated from responses (ducktype)
  endpointsOnly?: boolean

  // the client on which the endpoints will be added
  toClient: ClientOptions
}
