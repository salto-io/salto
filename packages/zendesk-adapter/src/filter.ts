/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ReadOnlyElementsSource } from '@salto-io/adapter-api'
import { filterUtils, elements as elementUtils } from '@salto-io/adapter-components'
import ZendeskClient from './client/client'
import { FilterContext } from './config'

export const { filtersRunner } = filterUtils

export type Filter = filterUtils.Filter<filterUtils.FilterResult>
export type BrandIdToClient = Record<string, ZendeskClient>
export type FilterResult = filterUtils.FilterResult

export type FilterAdditionalParams = {
  elementsSource: ReadOnlyElementsSource
  brandIdToClient?: BrandIdToClient
  fetchQuery: elementUtils.query.ElementQuery
}

export type FilterCreator = filterUtils.FilterCreator<
  ZendeskClient,
  FilterContext,
  filterUtils.FilterResult,
  FilterAdditionalParams
>
