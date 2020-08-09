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
import { CredsLease } from '@salto-io/e2e-credentials-store'
import { Credentials } from '../src/client/client'
import NetsuiteAdapter from '../src/adapter'
import { credsLease, realAdapter } from './adapter'
import { FetchResult } from '../../adapter-api/src/adapter'
import { getAllTypes } from '../src/types'
import { adapter as adapterCreator } from '../src/adapter_creator'

describe('Netsuite adapter E2E with real account', () => {
  let adapter: NetsuiteAdapter
  let credentialsLease: CredsLease<Credentials>

  beforeAll(async () => {
    await adapterCreator.install?.()
    credentialsLease = await credsLease()
    const adapterAttr = realAdapter({ credentials: credentialsLease.value })
    adapter = adapterAttr.adapter
  })

  afterAll(async () => {
    if (credentialsLease?.return) {
      await credentialsLease.return()
    }
  })

  // Set long timeout as we communicate with Netsuite APIs
  jest.setTimeout(1000000)

  let fetchResult: FetchResult

  describe('Initial fetch', () => {
    it('should fetch account successfully', async () => {
      fetchResult = await adapter.fetch()
      expect(fetchResult.elements.length).toBeGreaterThan(getAllTypes().length)
      expect(fetchResult.updatedConfig).toBeUndefined()
    })
  })
})
