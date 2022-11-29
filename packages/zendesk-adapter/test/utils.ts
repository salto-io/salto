/*
*                      Copyright 2022 Salto Labs Ltd.
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
} : Partial<FilterCreatorParams>) : FilterCreatorParams => ({
  client, paginator, config, fetchQuery, elementsSource, brandIdToClient,
})
