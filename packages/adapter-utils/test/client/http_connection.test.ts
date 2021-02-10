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
import moxios from 'moxios'
import { validateCredentials } from '../../src/client'
import { createConnection } from './common'

describe('client_http_connection', () => {
  beforeEach(() => {
    moxios.install()
  })

  afterEach(() => {
    moxios.uninstall()
  })

  describe('validateCredentials with axiosConnection', async () => {
    it('should login', async () => {
      const validateRes = validateCredentials({ username: 'user123', password: 'pass' }, { createConnection })
      moxios.withMock(() => {
        moxios.wait(async () => {
          const req = moxios.requests.mostRecent()
          await req.respondWith({
            status: 200,
            response: {
              accountId: 'ACCOUNT_ID',
            },
          })
        })
      })
      expect(await validateRes).toEqual('ACCOUNT_ID:user123')
      const req = moxios.requests.mostRecent()
      expect(req.url).toEqual('/users/me')
      expect(req.headers.Authorization).toContain('Basic ')
      expect(req.headers.customheader1).toEqual('user123')
    })
  })
})
