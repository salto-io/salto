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
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { MockInterface } from '@salto-io/test-utils'
import Connection from '../src/client/jsforce'
import SalesforceClient from '../src/client/client'
import SalesforceAdapter, { SalesforceAdapterParams } from '../src/adapter'
import createClient from './client'

export type Mocks = {
  connection: MockInterface<Connection>
  client: SalesforceClient
  adapter: SalesforceAdapter
}

export type Opts = {
  adapterParams?: Partial<SalesforceAdapterParams>
}

const mockAdapter = ({ adapterParams }: Opts = {}): Mocks => {
  const { connection, client } = createClient(adapterParams?.config?.client)
  const adapter = new SalesforceAdapter({
    client,
    metadataTypesOfInstancesFetchedInFilters: ['Queue'],
    config: {},
    elementsSource: buildElementsSourceFromElements([]),
    ...(adapterParams || {}),
  })
  return {
    connection,
    client,
    adapter,
  }
}

export default mockAdapter
