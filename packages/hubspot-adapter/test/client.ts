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
import HubspotClient from '../src/client/client'
import createConnection from './connection'
import Connection from '../src/client/madku'


const mockClient = (): { connection: Connection; client: HubspotClient } => {
  const connection = createConnection()
  const client = new HubspotClient({
    credentials: {
      apiKey: 'mockToken',
    },
    connection,
  })

  return { connection, client }
}

export default mockClient
