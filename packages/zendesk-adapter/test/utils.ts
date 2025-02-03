/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import {
  client as clientUtils,
  elements as elementUtils,
  definitions as definitionsUtils,
} from '@salto-io/adapter-components'
import { API_DEFINITIONS_CONFIG, DEFAULT_CONFIG } from '../src/config'
import ZendeskClient from '../src/client/client'
import { paginate } from '../src/client/pagination'
import { FilterCreator } from '../src/filter'
import { createClientDefinitions, createFetchDefinitions } from '../src/definitions'
import { Options } from '../src/definitions/types'
import { PAGINATION } from '../src/definitions/requests/pagination'

const createDefinitions = ({ client }: { client: ZendeskClient }): definitionsUtils.RequiredDefinitions<Options> => ({
  clients: createClientDefinitions({ main: client, guide: client }),
  pagination: PAGINATION,
  fetch: createFetchDefinitions({ baseUrl: client.getUrl().href }),
})

export const createFilterCreatorParams = ({
  client = new ZendeskClient({
    credentials: { username: 'a', password: 'b', subdomain: 'ignore' },
  }),
  paginator = clientUtils.createPaginator({
    client,
    paginationFuncCreator: paginate,
  }),
  config = DEFAULT_CONFIG,
  oldApiDefinitions = DEFAULT_CONFIG[API_DEFINITIONS_CONFIG],
  fetchQuery = elementUtils.query.createMockQuery(),
  elementSource = buildElementsSourceFromElements([]),
  brandIdToClient = {},
  definitions = createDefinitions({ client }),
}: Partial<Parameters<FilterCreator>[0]>): Parameters<FilterCreator>[0] => ({
  client,
  paginator,
  config,
  definitions,
  oldApiDefinitions,
  fetchQuery,
  elementSource,
  brandIdToClient,
  sharedContext: {},
})
