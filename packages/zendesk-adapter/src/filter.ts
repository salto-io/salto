/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { filterUtils, elements as elementUtils, client as clientUtils } from '@salto-io/adapter-components'
import ZendeskClient from './client/client'
import { Options } from './definitions/types'
import { ZendeskApiConfig, ZendeskUserConfig } from './user_config'

export const { filterRunner } = filterUtils

export type Filter = filterUtils.Filter<filterUtils.FilterResult>
export type BrandIdToClient = Record<string, ZendeskClient>
export type FilterResult = filterUtils.FilterResult

export type FilterAdditionalParams = {
  brandIdToClient?: BrandIdToClient
  fetchQuery: elementUtils.query.ElementQuery
  client: ZendeskClient
  paginator: clientUtils.Paginator
  oldApiDefinitions: ZendeskApiConfig
}

export type FilterCreator = filterUtils.AdapterFilterCreator<
  ZendeskUserConfig,
  filterUtils.FilterResult,
  FilterAdditionalParams,
  Options
>
