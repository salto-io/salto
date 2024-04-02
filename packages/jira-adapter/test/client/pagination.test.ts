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
import axios from 'axios'
import MockAdapter from 'axios-mock-adapter'
import { client as clientUtils, elements as elementUtils } from '@salto-io/adapter-components'
import { collections } from '@salto-io/lowerdash'
import JiraClient from '../../src/client/client'
import { filterResponseEntries } from '../../src/client/pagination'

const { toArrayAsync } = collections.asynciterable
const { createPaginator, getAllPagesWithOffsetAndTotal } = clientUtils
const { extractPageEntriesByNestedField } = elementUtils.swagger

describe('pageByOffset', () => {
  let client: JiraClient
  let mockAxios: MockAdapter
  beforeEach(() => {
    mockAxios = new MockAdapter(axios)
    client = new JiraClient({
      credentials: { baseUrl: 'http://myjira.net', user: 'me', token: 'tok' },
      isDataCenter: false,
    })
    mockAxios
      // first three requests are for login assertion
      .onGet('/rest/api/3/configuration')
      .replyOnce(200)
      .onGet('/rest/api/3/serverInfo')
      .replyOnce(200, { baseUrl: 'a' })
      .onGet('/rest/api/3/instance/license')
      .replyOnce(200, { applications: [{ plan: 'FREE' }] })
  })
  afterEach(() => {
    mockAxios.restore()
  })

  describe('when there are scoped entities in the response', () => {
    let responses: clientUtils.ResponseValue[][]
    beforeEach(async () => {
      mockAxios
        .onGet()
        .reply(200, [
          { name: 'thing' },
          { name: 'scoped', scope: {} },
          { name: 'nested scope', nested: [{ name: 'valid' }, { name: 'bad', scope: {} }] },
          { name: 'globalScoped', scope: { type: 'GLOBAL' } },
          { name: 'typed', type: 'classic' },
          { name: 'typedSimple', type: 'simple' },
          { name: 'typedSelfSimple', type: 'simple', self: 'https://myJira.atlassian.net/rest/agile/1.0/board/1' },
          { name: 'badSelf', type: 'simple', self: 'https://myJira.atlassian.net/rest/agile/2.0/board/1' },
        ])
      const args = { url: 'http://myjira.net/thing' }
      const paginator = createPaginator({
        client,
        paginationFuncCreator: getAllPagesWithOffsetAndTotal,
        customEntryExtractor: filterResponseEntries,
      })
      responses = await toArrayAsync(paginator(args, extractPageEntriesByNestedField()))
    })
    it('should omit the scoped entities from the response', () => {
      expect(responses).toHaveLength(1)
      const [page] = responses
      expect(page).not.toContainEqual(
        expect.objectContaining({ scope: expect.not.objectContaining({ type: 'GLOBAL' }) }),
      )
    })
    it('should keep non-scoped entities', () => {
      const [page] = responses
      expect(page).toContainEqual({ name: 'thing' })
    })
    it('should omit nested scoped entities from the response', () => {
      const [page] = responses
      expect(page).toContainEqual({ name: 'nested scope', nested: [{ name: 'valid' }] })
    })
    it('should keep global scoped entities', () => {
      const [page] = responses
      expect(page).toContainEqual({ name: 'globalScoped', scope: { type: 'GLOBAL' } })
    })
    it('should keep non-simple type scopes', () => {
      const [page] = responses
      expect(page).toContainEqual({ name: 'typed', type: 'classic' })
    })
    it('should keep simple type scopes with non board self', () => {
      const [page] = responses
      expect(page).toContainEqual(
        expect.objectContaining({ type: 'simple', self: 'https://myJira.atlassian.net/rest/agile/2.0/board/1' }),
      )
    })
    it('should omit team boards from the response', () => {
      expect(responses).toHaveLength(1)
      const [page] = responses
      expect(page).not.toContainEqual(
        expect.objectContaining({ type: 'simple', self: 'https://myJira.atlassian.net/rest/agile/1.0/board/1' }),
      )
    })
  })
  describe('when there are unrelated calendars in the response', () => {
    let responses: clientUtils.ResponseValue[][]
    beforeEach(async () => {
      mockAxios
        .onGet()
        .reply(200, [
          { name: 'thing' },
          { canCreate: false, calendars: [] },
          { canCreate: false, anotherField: 'value' },
          { canCreate: true, calendars: [] },
        ])
      const args = { url: 'http://myjira.net/thing' }
      const paginator = createPaginator({
        client,
        paginationFuncCreator: getAllPagesWithOffsetAndTotal,
        customEntryExtractor: filterResponseEntries,
      })
      responses = await toArrayAsync(paginator(args, extractPageEntriesByNestedField()))
    })
    it('should omit the global calendars response where canCreate is false', () => {
      expect(responses).toHaveLength(1)
      const [page] = responses
      expect(page).not.toContainEqual(expect.objectContaining({ canCreate: false, calendars: [] }))
    })
    it('should keep specific calendars response where canCreate is true', () => {
      const [page] = responses
      expect(page).toContainEqual({ canCreate: true, calendars: [] })
    })
    it("should keep objects with canCreate = false if they don't have calendars", () => {
      const [page] = responses
      expect(page).toContainEqual({ canCreate: false, anotherField: 'value' })
    })
  })

  describe('when there is a 404 response', () => {
    let responses: clientUtils.ResponseValue[][]
    beforeEach(async () => {
      mockAxios.onGet().reply(404)
      const args = { url: 'http://myjira.net/thing/1', paginationField: 'startAt' }
      const paginator = createPaginator({
        client,
        paginationFuncCreator: getAllPagesWithOffsetAndTotal,
        customEntryExtractor: filterResponseEntries,
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
        paginationFuncCreator: getAllPagesWithOffsetAndTotal,
        customEntryExtractor: filterResponseEntries,
      })
      responseIter = paginator(args, extractPageEntriesByNestedField())
    })
    it('should throw the error', async () => {
      await expect(toArrayAsync(responseIter)).rejects.toThrow()
    })
  })
})
