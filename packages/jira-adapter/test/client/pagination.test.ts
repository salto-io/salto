/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { client as clientUtils, elements as elementUtils } from '@salto-io/adapter-components'
import { collections } from '@salto-io/lowerdash'
import JiraClient from '../../src/client/client'
import { removeScopedObjects } from '../../src/client/pagination'

const { toArrayAsync } = collections.asynciterable
const { createPaginator, getWithOffsetAndLimit } = clientUtils
const { extractPageEntriesByNestedField } = elementUtils.swagger

describe('pageByOffset', () => {
  let client: JiraClient
  let mockAxios: MockAdapter
  beforeEach(() => {
    mockAxios = new MockAdapter(axios)
    client = new JiraClient({ credentials: { baseUrl: 'http://myjira.net', user: 'me', token: 'tok' } })
  })
  afterEach(() => {
    mockAxios.restore()
  })

  describe('when there are scoped entities in the response', () => {
    let responses: clientUtils.ResponseValue[][]
    beforeEach(async () => {
      mockAxios.onGet().reply(
        200,
        [
          { name: 'thing' },
          { name: 'scoped', scope: {} },
          { name: 'nested scope', nested: [{ name: 'valid' }, { name: 'bad', scope: {} }] },
          { name: 'globalScoped', scope: { type: 'GLOBAL' } },
        ],
      )
      const args = { url: 'http://myjira.net/thing' }
      const paginator = createPaginator({
        client,
        paginationFuncCreator: getWithOffsetAndLimit,
        customEntryExtractor: removeScopedObjects,
      })
      responses = await toArrayAsync(paginator(args, extractPageEntriesByNestedField()))
    })
    it('should omit the scoped entities from the response', () => {
      expect(responses).toHaveLength(1)
      const [page] = responses
      expect(page).not.toContainEqual(expect.objectContaining({ scope: expect.not.objectContaining({ type: 'GLOBAL' }) }))
    })
    it('should keep non-scoped entities', () => {
      const [page] = responses
      expect(page[0]).toEqual({ name: 'thing' })
    })
    it('should omit nested scoped entities from the response', () => {
      const [page] = responses
      expect(page[1]).toEqual({ name: 'nested scope', nested: [{ name: 'valid' }] })
    })
    it('should keep global scoped entities', () => {
      const [page] = responses
      expect(page[2]).toEqual({ name: 'globalScoped', scope: { type: 'GLOBAL' } })
    })
  })

  describe('when there is a 404 response', () => {
    let responses: clientUtils.ResponseValue[][]
    beforeEach(async () => {
      mockAxios.onGet().reply(404)
      const args = { url: 'http://myjira.net/thing/1', paginationField: 'startAt' }
      const paginator = createPaginator({
        client,
        paginationFuncCreator: getWithOffsetAndLimit,
        customEntryExtractor: removeScopedObjects,
      })
      responses = await toArrayAsync(paginator(args, extractPageEntriesByNestedField()))
    })
    it('should return an empty result', () => {
      expect(responses).toHaveLength(0)
    })
  })

  describe('when there is a non-404 error response', () => {
    let responseIter: AsyncIterable<clientUtils.ResponseValue[]>
    beforeEach(() => {
      mockAxios.onGet().reply(400)

      const args = { url: 'http://myjira.net/thing/1', paginationField: 'startAt' }
      const paginator = createPaginator({
        client,
        paginationFuncCreator: getWithOffsetAndLimit,
        customEntryExtractor: removeScopedObjects,
      })
      responseIter = paginator(args, extractPageEntriesByNestedField())
    })
    it('should throw the error', async () => {
      await expect(toArrayAsync(responseIter)).rejects.toThrow()
    })
  })
})
