/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { Element, SaltoError, ObjectType, TypeElement, Values } from '@salto-io/adapter-api'
import { ConfigChangeSuggestion } from '../definitions'
import { ContextParams, GeneratedItem } from '../definitions/system/shared'

export type FetchElements<T = Element[]> = {
  elements: T
  errors?: SaltoError[]
  configChanges?: ConfigChangeSuggestion[]
}

export type ResourceIdentifier = {
  typeName: string
  identifier?: Record<string, string>
}

export type ValueGeneratedItem = GeneratedItem<ContextParams, Values>

type ResourceFetchResult =
  | {
      success: true
    }
  | {
      success: false
      error: Error
    }

export type TypeResourceFetcher = {
  fetch: (args: {
    contextResources: Record<string, ValueGeneratedItem[] | undefined>
    // eslint-disable-next-line no-use-before-define
    typeFetcherCreator: TypeFetcherCreator
  }) => Promise<ResourceFetchResult>
  done: () => boolean
  getItems: () => ValueGeneratedItem[] | undefined
}

export type TypeFetcherCreator = ({
  typeName,
  context,
}: {
  typeName: string
  context?: Record<string, unknown>
}) => TypeResourceFetcher | undefined

export type NestedTypeWithNestedTypes = {
  type: TypeElement
  nestedTypes: ObjectType[]
}

export type ObjectTypeWithNestedTypes = {
  type: ObjectType
  nestedTypes: ObjectType[]
}
