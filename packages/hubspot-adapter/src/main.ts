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
import {
  RequestPromise,
} from 'requestretry'

import HubspotClient from './client/client'

export const firstFunc = (): RequestPromise => {
// eslint-disable-next-line no-console
  console.log('Welcome to hubspot adapter')

  const testClient = new HubspotClient({
    credentials: {
      apiKey: 'd0b5e073-694e-4335-a9d6-9f8fdf4eb9d5',
    },
  })

  return testClient.getAllContacts()
}
