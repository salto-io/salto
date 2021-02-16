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
import axios from 'axios'
import MockAdapter from 'axios-mock-adapter'
import { Element, ElemID, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import * as adapterUtils from '@salto-io/adapter-utils'
import WorkatoAdapter from '../src/adapter'
import { UsernameTokenCredentials } from '../src/auth'
import { WORKATO } from '../src/constants'
import WorkatoClient from '../src/client/client'
import { DEFAULT_ENDPOINTS, FIELDS_TO_OMIT, DEFAULT_NAME_FIELD, DEFAULT_PATH_FIELD } from '../src/config'

jest.mock('@salto-io/adapter-utils', () => {
  const actual = jest.requireActual('@salto-io/adapter-utils')
  return {
    ...actual,
    elements: {
      ...actual.elements,
      ducktype: {
        ...actual.elements.ducktype,
        getAllElements: jest.fn().mockImplementation(actual.elements.ducktype.getAllElements),
      },
    },
  }
})

describe('adapter', () => {
  let adapter: WorkatoAdapter
  let client: WorkatoClient
  let mockAxiosAdapter: MockAdapter

  beforeEach(() => {
    client = new WorkatoClient({
      credentials: new UsernameTokenCredentials({ username: 'user', token: 'token' }),
      config: {},
    })
    adapter = new WorkatoAdapter({
      client,
      config: {
        apiDefinitions: {
          endpoints: DEFAULT_ENDPOINTS,
        },
        fetch: { includeEndpoints: Object.keys(DEFAULT_ENDPOINTS) },
      },
    })

    mockAxiosAdapter = new MockAdapter(axios, { delayResponse: 1, onNoMatch: 'throwException' })
  })

  afterEach(() => {
    mockAxiosAdapter.restore()
  })

  describe('fetch', () => {
    let elements: Element[]
    beforeEach(() => {
      jest.spyOn(adapterUtils.elements.ducktype, 'getAllElements').mockImplementation(async () => {
        const type = new ObjectType({ elemID: new ElemID(WORKATO, 'myType') })
        elements = [
          type,
          new InstanceElement('ins1', type, { a: 'b' }),
        ]
        return elements
      })
    })

    it('should return the elements fetched by getAllElements', async () => {
      expect(await adapter.fetch()).toEqual({ elements })
      expect(adapterUtils.elements.ducktype.getAllElements).toHaveBeenCalledTimes(1)
      expect(adapterUtils.elements.ducktype.getAllElements).toHaveBeenCalledWith({
        adapterName: WORKATO,
        endpoints: DEFAULT_ENDPOINTS,
        includeEndpoints: Object.keys(DEFAULT_ENDPOINTS),
        client,
        nestedFieldFinder: adapterUtils.elements.ducktype.returnFullEntry,
        computeGetArgs: adapterUtils.elements.ducktype.simpleGetArgs,
        defaultExtractionFields: {
          fieldsToOmit: FIELDS_TO_OMIT,
          nameField: DEFAULT_NAME_FIELD,
          pathField: DEFAULT_PATH_FIELD,
        },
      })
    })
  })

  describe('deploy', () => {
    it('should throw not implemented', async () => {
      await expect(adapter.deploy()).rejects.toThrow(new Error('Not implemented.'))
    })
  })
})
