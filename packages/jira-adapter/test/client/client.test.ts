/*
*                      Copyright 2023 Salto Labs Ltd.
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

describe('client', () => {
  let client: JiraClient
  let mockAxios: MockAdapter
  let result: clientUtils.client.ResponseValue
  beforeEach(() => {
    mockAxios = new MockAdapter(axios)
    client = new JiraClient({ credentials: { baseUrl: 'http://myjira.net', user: 'me', token: 'tok' }, isDataCenter: false })
  })
  afterEach(() => {
    mockAxios.restore()
  })

  describe('sendRequest error handing', () => {
    beforeEach(async () => {
      mockAxios.onGet().reply(400, { response: 'asd', errorMessages: ['error message'] })
    })
    it('should call send request decorator', async () => {
      await expect(async () => client.getSinglePage({ url: '/myPath' })).rejects.toThrow(new Error('Failed to get /myPath with error: Error: Request failed with status code 400. error message'))
    })
  })

  describe('getSinglePage', () => {
    beforeEach(async () => {
      mockAxios.onGet().reply(200, { response: 'asd' })
      result = await client.getSinglePage({ url: '/myPath' })
    })
    it('should not try to call a login endpoint', () => {
      expect(mockAxios.history.get).toHaveLength(1)
    })
    it('should request the correct path with auth headers', () => {
      const request = mockAxios.history.get[0]
      expect(request.auth).toEqual({ username: 'me', password: 'tok' })
      expect(request.baseURL).toEqual('http://myjira.net')
      expect(request.url).toEqual('/myPath')
    })
    it('should return the response', () => {
      expect(result).toEqual({ status: 200, data: { response: 'asd' } })
    })
  })
  it('should preserve headers', async () => {
    mockAxios.onPatch().reply(200, { response: 'asd' })
    mockAxios.onPost().reply(200, { response: 'asd' })
    mockAxios.onGet().reply(200, { response: 'asd' })
    mockAxios.onPut().reply(200, { response: 'asd' })
    mockAxios.onDelete().reply(200, { response: 'asd' })
    await client.patchPrivate({ url: '/myPath', headers: { 'x-atlassian-force-account-id': '1234' }, data: { a: 'b' } })
    await client.jspPost({ url: '/myPath', data: { a: 'b' }, headers: { 'x-atlassian-force-account-id': '1234' } })
    await client.putPrivate({ url: '/myPath', data: { a: 'b' }, headers: { 'x-atlassian-force-account-id': '1234' } })
    await client.postPrivate({ url: '/myPath', data: { a: 'b' }, headers: { 'x-atlassian-force-account-id': '1234' } })
    await client.getPrivate({ url: '/myPath', headers: { 'x-atlassian-force-account-id': '1234' } })
    await client.deletePrivate({ url: '/myPath', headers: { 'x-atlassian-force-account-id': '1234' } })
    expect(mockAxios.history.patch[0].headers?.['x-atlassian-force-account-id']).toEqual('1234')
    expect(mockAxios.history.get[0].headers?.['x-atlassian-force-account-id']).toEqual('1234')
    expect(mockAxios.history.post[0].headers?.['x-atlassian-force-account-id']).toEqual('1234')
    expect(mockAxios.history.post[1].headers?.['x-atlassian-force-account-id']).toEqual('1234')
    expect(mockAxios.history.delete[0].headers?.['x-atlassian-force-account-id']).toEqual('1234')
    expect(mockAxios.history.put[0].headers?.['x-atlassian-force-account-id']).toEqual('1234')
    await client.patchPrivate({ url: '/myPath', data: { a: 'b' } })
  })
  it('check if gqlpost returns a response if it is as expected', async () => {
    const innerData = {
      issueLayoutConfiguration: {
        issueLayoutResult: {
          id: '2',
          name: 'Default Issue Layout',
          usageInfo: {
            edges: [{
              node: {
                layoutOwners: [{
                  avatarId: '3',
                  description: 'ownerTest',
                  iconUrl: 'www.icon.com',
                  id: '100',
                  name: 'ownerTest',
                }],
              },
            }],
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
    mockAxios.onPost().replyOnce(200, { data: { data: innerData } })
    result = await client.gqlPost({ url: 'www.test.com', query: 'query' })
    expect(result).toEqual({ data: { data: innerData } })
  })
  it('check if gqlpost throws an error if the response is not as expected', async () => {
    mockAxios.onPost().replyOnce(200, { response: 'not as expected' })
    await expect(client.gqlPost({ url: 'www.test.com', query: 'query' })).rejects.toThrow()
  })
})
