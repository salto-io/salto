/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { MockInterface } from '@salto-io/test-utils'
import Connection from '../src/client/jsforce'
import createMockClient from './client'
import { retrieveMetadataInstances } from '../src/fetch'
import { mockTypes } from './mock_elements'
import { DEFAULT_MAX_ITEMS_IN_RETRIEVE_REQUEST } from '../src/constants'
import { SalesforceClient } from '../index'
import { buildMetadataQuery } from '../src/fetch_profile/metadata_query'
import { mockRetrieveResult } from './connection'

describe('Fetch via retrieve API', () => {
  let connection: MockInterface<Connection>
  let client: SalesforceClient

  beforeEach(async () => {
    ({ connection, client } = createMockClient())
    connection.metadata.retrieve.mockResolvedValue(await mockRetrieveResult({}))
  })

  afterEach(() => {
    jest.resetAllMocks()
    jest.restoreAllMocks()
  })

  it('should fetch a single instance', async () => {
    const { elements } = (await retrieveMetadataInstances(
      {
        client,
        types: [mockTypes.ApexClass],
        maxItemsInRetrieveRequest: DEFAULT_MAX_ITEMS_IN_RETRIEVE_REQUEST,
        metadataQuery: buildMetadataQuery({}),
        addNamespacePrefixToFullName: false,
        typesToSkip: new Set(),
      }
    ))
    expect(elements).toHaveLength(1)
  })
})
