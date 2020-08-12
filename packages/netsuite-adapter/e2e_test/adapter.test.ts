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
import { InstanceElement } from '../../adapter-api/src/elements'
import {
  FETCH_ALL_TYPES_AT_ONCE, FILE_PATHS_REGEX_SKIP_LIST, TYPES_TO_SKIP,
} from '../src/constants'

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

  const validateConfigSuggestions = (updatedConfig?: InstanceElement): void => {
    if (updatedConfig === undefined) {
      // As expected
      return
    }
    // Due to a known SDF bug, sometimes we fail to fetch all types at once but succeed when trying
    // to fetch type by type. In this case we wouldn't like to fail the test
    expect(updatedConfig.value?.[FILE_PATHS_REGEX_SKIP_LIST]).toHaveLength(0)
    expect(updatedConfig.value?.[TYPES_TO_SKIP]).toHaveLength(0)
    expect(updatedConfig.value?.[FETCH_ALL_TYPES_AT_ONCE]).toBe(false)
  }

  describe('Initial fetch', () => {
    it('should fetch account successfully', async () => {
      fetchResult = await adapter.fetch()
      expect(fetchResult.elements.length).toBeGreaterThan(getAllTypes().length)
      validateConfigSuggestions(fetchResult.updatedConfig?.config)
    })
  })
})
