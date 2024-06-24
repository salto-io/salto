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
import { ElemIdGetter, ObjectType, Values } from '@salto-io/adapter-api'
import { DefQuery } from '../utils'
// eslint-disable-next-line import/no-cycle
import { FetchApiDefinitionsOptions, InstanceFetchApiDefinitions } from './fetch'
import { NameMappingFunctionMap } from '../shared'
import { ResolveCustomNameMappingOptionsType } from '../api'

export type ElementAndResourceDefFinder<Options extends FetchApiDefinitionsOptions = {}> = DefQuery<
  Pick<InstanceFetchApiDefinitions<Options>, 'element' | 'resource'>
>

export type GenerateTypeArgs<Options extends FetchApiDefinitionsOptions = {}> = {
  adapterName: string
  typeName: string
  parentName?: string
  entries: Values[]
  defQuery: ElementAndResourceDefFinder<Options>
  customNameMappingFunctions?: NameMappingFunctionMap<ResolveCustomNameMappingOptionsType<Options>>
  typeNameOverrides?: Record<string, string>
  isUnknownEntry?: (value: unknown) => boolean
  definedTypes: Record<string, ObjectType>
  isSubType?: boolean
  isMapWithDynamicType?: boolean
  getElemIdFunc?: ElemIdGetter
}
