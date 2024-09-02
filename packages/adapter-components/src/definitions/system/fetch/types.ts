/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ElemIdGetter, ObjectType, Values } from '@salto-io/adapter-api'
import { DefQuery } from '../utils'
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
