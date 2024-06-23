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
import { definitions } from '@salto-io/adapter-components'

export type AdditionalAction = never
export type ClientOptions = 'main'
export type PaginationOptions = 'basic_cursor' | 'basic_cursor_with_args' | 'links' | 'settings'
export type ReferenceContextStrategies = 'string'
export type CustomReferenceSerializationStrategyName = 'string'
export type CustomIndexField = CustomReferenceSerializationStrategyName
export type ZendeskFetchOptions = {
  clientOptions: ClientOptions
  paginationOptions: PaginationOptions
  customNameMappingOptions: string
}

export type Options = definitions.APIDefinitionsOptions & {
  clientOptions: ClientOptions
  paginationOptions: PaginationOptions
  additionalAction: AdditionalAction
  referenceContextStrategies: ReferenceContextStrategies
  referenceSerializationStrategies: CustomReferenceSerializationStrategyName
  referenceIndexNames: CustomIndexField
}
