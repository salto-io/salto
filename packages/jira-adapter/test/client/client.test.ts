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
import * as clientUtils from '@salto-io/adapter-components'
import JiraClient from '../../src/client/client'
import { DEFAULT_CLOUD_ID } from '../utils'

describe('client', () => {
  let client: JiraClient
  let mockAxios: MockAdapter
  let result: clientUtils.client.ResponseValue
  let extractHeadersFunc: jest.SpyInstance
  beforeEach(() => {
    mockAxios = new MockAdapter(axios)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    extractHeadersFunc = jest.spyOn(JiraClient.prototype as any, 'extractHeaders')
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

  describe('sendRequest error handing', () => {
    beforeEach(async () => {
      mockAxios.onGet().reply(400, { response: 'asd', errorMessages: ['error message'] })
    })
    it('should call send request decorator', async () => {
      await expect(async () => client.get({ url: '/myPath' })).rejects.toThrow(
        new Error('Failed to get /myPath with error: Error: Request failed with status code 400. error message'),
      )
    })
  })

  describe('get', () => {
    const validHeaders = { 'X-RateLimit-Reset': '2024-05-05T18:02Z', 'X-RateLimit-NearLimit': true, 'Retry-After': '5' }
    const filteredHeaders = { 'Do-Not-Extract': 'true' }
    beforeEach(async () => {
      extractHeadersFunc.mockClear()
      mockAxios.onGet('/myPath').reply(200, { response: 'asd' }, { ...validHeaders, ...filteredHeaders })
      result = await client.get({ url: '/myPath' })
    })
    it('should request the correct path with auth headers', () => {
      const request = mockAxios.history.get.find(r => r.url === '/myPath')
      expect(request).toBeDefined()
      expect(request?.auth).toEqual({ username: 'me', password: 'tok' })
      expect(request?.baseURL).toEqual('http://myjira.net')
      expect(request?.url).toEqual('/myPath')
    })
    it('should return the response', () => {
      expect(result).toEqual({ status: 200, data: { response: 'asd' }, headers: validHeaders })
    })
    it('should call extractHeaders', () => {
      expect(extractHeadersFunc).toHaveBeenCalled()
    })
    it('should extract the correct headers', () => {
      expect(extractHeadersFunc).toHaveNthReturnedWith(1, validHeaders)
    })
  })
  it('should preserve headers', async () => {
    mockAxios.onPatch().reply(200, { response: 'asd' })
    mockAxios.onPost().reply(200, { response: 'asd' })
    mockAxios.onGet('/myPath').reply(200, { response: 'asd' })
    mockAxios.onPut().reply(200, { response: 'asd' })
    mockAxios.onDelete().reply(200, { response: 'asd' })
    await client.patchPrivate({ url: '/myPath', headers: { 'x-atlassian-force-account-id': '1234' }, data: { a: 'b' } })
    await client.jspPost({ url: '/myPath', data: { a: 'b' }, headers: { 'x-atlassian-force-account-id': '1234' } })
    await client.jspGet({ url: '/myPath', data: { a: 'b' }, headers: { 'x-atlassian-force-account-id': '1234' } })
    await client.putPrivate({ url: '/myPath', data: { a: 'b' }, headers: { 'x-atlassian-force-account-id': '1234' } })
    await client.postPrivate({ url: '/myPath', data: { a: 'b' }, headers: { 'x-atlassian-force-account-id': '1234' } })
    await client.getPrivate({ url: '/myPath', headers: { 'x-atlassian-force-account-id': '1234' } })
    await client.deletePrivate({ url: '/myPath', headers: { 'x-atlassian-force-account-id': '1234' } })
    expect(mockAxios.history.patch[0].headers?.['x-atlassian-force-account-id']).toEqual('1234')
    expect(mockAxios.history.get[3].headers?.['x-atlassian-force-account-id']).toEqual('1234')
    expect(mockAxios.history.get[4].headers?.['x-atlassian-force-account-id']).toEqual('1234')
    expect(mockAxios.history.post[0].headers?.['x-atlassian-force-account-id']).toEqual('1234')
    expect(mockAxios.history.post[1].headers?.['x-atlassian-force-account-id']).toEqual('1234')
    expect(mockAxios.history.delete[0].headers?.['x-atlassian-force-account-id']).toEqual('1234')
    expect(mockAxios.history.put[0].headers?.['x-atlassian-force-account-id']).toEqual('1234')
    await client.patchPrivate({ url: '/myPath', data: { a: 'b' } })
  })
  it('check if gqlpost returns a response if it is as expected', async () => {
    const innerData = {
      layoutConfiguration: {
        issueLayoutResult: {
          id: '2',
          name: 'Default Issue Layout',
          usageInfo: {
            edges: [
              {
                node: {
                  layoutOwners: [
                    {
                      avatarId: '3',
                      description: 'ownerTest',
                      iconUrl: 'www.icon.com',
                      id: '100',
                      name: 'ownerTest',
                    },
                  ],
                },
              },
            ],
          },
          containers: [
            {
              containerType: 'PRIMARY',
              items: {
                nodes: [],
              },
            },
            {
              containerType: 'Secondery',
              items: {
                nodes: [],
              },
            },
          ],
        },
      },
    }
    mockAxios.onPost().replyOnce(200, { data: innerData })
    result = await client.gqlPost({ url: 'www.test.com', query: 'query' })
    expect(result).toEqual({ data: innerData })
  })
  it('check if gqlpost throws an error if the response is not as expected', async () => {
    mockAxios.onPost().replyOnce(200, { response: 'not as expected' })
    await expect(client.gqlPost({ url: 'www.test.com', query: 'query' })).rejects.toThrow()
  })
  it('check if gqlpost returns the data when data as expected and there are errors.', async () => {
    const error = {
      message: 'Requested issue layout configuration is not found',
      locations: [{ line: 65, column: 3 }],
      path: ['issueLayoutConfiguration'],
      extensions: { statusCode: 404, errorType: 'DataFetchingException', classification: 'DataFetchingException' },
    }
    mockAxios.onPost().reply(200, { data: { layoutConfiguration: null }, errors: [error] })
    result = await client.gqlPost({ url: 'www.test.com', query: 'query' })
    expect(result).toEqual({ data: { layoutConfiguration: null }, errors: [error] })
  })
  it('should check if getCloudId throws an error if the response is not as expected', async () => {
    mockAxios.onGet().replyOnce(200, { data: { some_field: '' } })
    await expect(client.getCloudId()).rejects.toThrow()
  })
  it('should check if getCloudId returns the CloudID if the response is of the proper format', async () => {
    mockAxios.onGet().replyOnce(200, { cloudId: DEFAULT_CLOUD_ID })
    expect(await client.getCloudId()).toEqual(DEFAULT_CLOUD_ID)
  })
})
