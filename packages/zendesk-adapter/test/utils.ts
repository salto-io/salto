/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { client as clientUtils, elements as elementUtils } from '@salto-io/adapter-components'
import { ReadOnlyElementsSource } from '@salto-io/adapter-api'
import { DEFAULT_CONFIG, ZendeskConfig } from '../src/config'
import ZendeskClient from '../src/client/client'
import { paginate } from '../src/client/pagination'
import { BrandIdToClient } from '../src/filter'

type FilterCreatorParams = {
  client: ZendeskClient
  paginator: clientUtils.Paginator
  config: ZendeskConfig
  fetchQuery: elementUtils.query.ElementQuery
  elementsSource: ReadOnlyElementsSource
  brandIdToClient: BrandIdToClient
}

export const createFilterCreatorParams = ({
  client = new ZendeskClient({
    credentials: { username: 'a', password: 'b', subdomain: 'ignore' },
  }),
  paginator = clientUtils.createPaginator({
    client,
    paginationFuncCreator: paginate,
  }),
  config = DEFAULT_CONFIG,
  fetchQuery = elementUtils.query.createMockQuery(),
  elementsSource = buildElementsSourceFromElements([]),
  brandIdToClient = {},
}: Partial<FilterCreatorParams>): FilterCreatorParams => ({
  client,
  paginator,
  config,
  fetchQuery,
  elementsSource,
  brandIdToClient,
})
