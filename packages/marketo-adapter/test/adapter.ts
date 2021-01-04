/*
*                      Copyright 2021 Salto Labs Ltd.
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

import mockClient from './client'
import MarketoClient from '../src/client/client'
import MarketoAdapter, { MarketoAdapterParams } from '../src/adapter'

export type Mocks = {
  client: MarketoClient
  adapter: MarketoAdapter
}

export type Opts = {
  adapterParams?: Partial<MarketoAdapterParams>
}

const mockAdapter = ({ adapterParams }: Opts = {}): Mocks => {
  const client = mockClient()
  const adapter = new MarketoAdapter({ client, ...adapterParams || {} })
  return {
    client, adapter,
  }
}

export default mockAdapter
