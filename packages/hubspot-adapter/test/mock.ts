/*
*                      Copyright 2020 Salto Labs Ltd.
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
import HubspotAdapter, { HubspotAdapterParams } from '../src/adapter'
import createClient from './client'
import HubspotClient from '../src/client/client'

export type Mocks = {
  client: HubspotClient
  adapter: HubspotAdapter
}

export type Opts = {
  adapterParams?: Partial<HubspotAdapterParams>
}

const mockAdapter = ({ adapterParams }: Opts = {}): Mocks => {
  const { client } = createClient()
  const adapter = new HubspotAdapter({ client, ...adapterParams || {} })
  return {
    client, adapter,
  }
}

export default mockAdapter
