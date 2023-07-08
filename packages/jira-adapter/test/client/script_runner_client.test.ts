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
import ScriptRunnerClient from '../../src/client/script_runner_client'
import ScriptRunnerCredentials from '../../src/script_runner_auth'

const VALID_HTML = '<!DOCTYPE html><html><head><meta name="sr-token" content="validSR"></head></html>'
const NO_CONTENT_HTML = '<!DOCTYPE html><html><head><meta name="sr-token"></head></html>'
const NO_SR_HTML = '<!DOCTYPE html><html><head></head></html>'

jest.mock('../../src/script_runner_auth', () => jest.fn().mockImplementation(() => ({
  getUrl: jest.fn().mockResolvedValue('https://my.scriptrunner.net/myUrlPath'),
  getBaseUrl: jest.fn().mockResolvedValue('https://my.scriptrunner.net'),
})))

describe('scriptRunnerClient', () => {
  let jiraClient: JiraClient
  let scriptRunnerClient: ScriptRunnerClient
  let mockAxios: MockAdapter
  let result: clientUtils.client.ResponseValue
  beforeEach(() => {
    mockAxios = new MockAdapter(axios)
    jiraClient = new JiraClient({ credentials: { baseUrl: 'http://myjira.net', user: 'me', token: 'tok' }, isDataCenter: false })
    scriptRunnerClient = new ScriptRunnerClient(
      { credentials: new ScriptRunnerCredentials(jiraClient),
        isDataCenter: false }
    )
  })
  afterEach(() => {
    mockAxios.restore()
  })

  describe('sendRequest error handing', () => {
    it('should throw correct error when cannot access JWT address', async () => {
      mockAxios.onGet('https://my.scriptrunner.net/myUrlPath').reply(400, { response: 'asd', errorMessages: ['error message'] })
      await expect(async () => scriptRunnerClient.getSinglePage({ url: '/myPath' })).rejects.toThrow(new Error('Failed to get /myUrlPath with error: Error: Request failed with status code 400. error message'))
    })
    it('should fail without throwing when received license error', async () => {
      mockAxios.onGet('https://my.scriptrunner.net/myUrlPath').reply(402, { response: 'asd', errorMessages: ['error message'] })
      expect(await scriptRunnerClient.getSinglePage({ url: '/myPath' })).toEqual({ status: 402, data: [] })
    })
    it('should fail when sr not in correct format', async () => {
      mockAxios.onGet('https://my.scriptrunner.net/myUrlPath').replyOnce(200, { response: 'asd' })
      expect(await scriptRunnerClient.getSinglePage({ url: '/myPath' })).toEqual({ status: 404, data: [] })
    })
    it('should fail when not html response', async () => {
      mockAxios.onGet('https://my.scriptrunner.net/myUrlPath').replyOnce(200, 'not another html answer')
      expect(await scriptRunnerClient.getSinglePage({ url: '/myPath' })).toEqual({ status: 404, data: [] })
    })
    it('should fail when no sr element', async () => {
      mockAxios.onGet('https://my.scriptrunner.net/myUrlPath').replyOnce(200, NO_SR_HTML)
      expect(await scriptRunnerClient.getSinglePage({ url: '/myPath' })).toEqual({ status: 404, data: [] })
    })
    it('should fail when sr element does not have context', async () => {
      mockAxios.onGet('https://my.scriptrunner.net/myUrlPath').replyOnce(200, NO_CONTENT_HTML)
      expect(await scriptRunnerClient.getSinglePage({ url: '/myPath' })).toEqual({ status: 404, data: [] })
    })
    it('should call send request decorator for page', async () => {
      mockAxios.onGet('https://my.scriptrunner.net/myUrlPath').replyOnce(200, VALID_HTML)
      mockAxios.onGet('https://my.scriptrunner.net/myPath').replyOnce(400, { response: 'asd', errorMessages: ['error message'] })
      await expect(async () => scriptRunnerClient.getSinglePage({ url: '/myPath' })).rejects.toThrow(new Error('Failed to get /myPath with error: Error: Request failed with status code 400. error message'))
    })
    it('should fail without throwing when received page not found error', async () => {
      mockAxios.onGet('https://my.scriptrunner.net/myUrlPath').replyOnce(200, VALID_HTML)
      mockAxios.onGet('https://my.scriptrunner.net/myPath').reply(404, { response: 'asd', errorMessages: ['error message'] })
      expect(await scriptRunnerClient.getSinglePage({ url: '/myPath' })).toEqual({ status: 404, data: [] })
    }, 100000)
  })

  describe('getSinglePage', () => {
    beforeEach(async () => {
      mockAxios.onGet('https://my.scriptrunner.net/myUrlPath').replyOnce(200, VALID_HTML)
      mockAxios.onGet().reply(200, { response: 'asd' })
      result = await scriptRunnerClient.getSinglePage({ url: '/myPath' })
    })
    it('should not try to call a login endpoint', () => {
      expect(mockAxios.history.get).toHaveLength(2)
    })
    it('should request the correct path with auth headers', () => {
      const srRequest = mockAxios.history.get[0]
      expect(srRequest.auth).toBeUndefined()
      expect(srRequest.baseURL).toEqual('https://my.scriptrunner.net')
      expect(srRequest.url).toEqual('/myUrlPath')
      const request = mockAxios.history.get[1]
      expect(request.auth).toBeUndefined()
      expect(request.baseURL).toEqual('https://my.scriptrunner.net')
      expect(request.url).toEqual('/myPath')
      expect(request.headers.Authorization).toEqual('JWT validSR')
    })
    it('should return the response', () => {
      expect(result).toEqual({ status: 200, data: { response: 'asd' } })
    })
    it('should not call the login endpoint again', async () => {
      await scriptRunnerClient.getSinglePage({ url: '/myPath2' })
      expect(mockAxios.history.get).toHaveLength(3)
    })
    it('should pass on headers', async () => {
      await scriptRunnerClient.getSinglePage({ url: '/myPath2', headers: { 'X-Atlassian-Token': 'no-check' } })
      expect(mockAxios.history.get).toHaveLength(3)
      const request = mockAxios.history.get[2]
      expect(request.headers['X-Atlassian-Token']).toEqual('no-check')
    })
  })
  describe('delete', () => {
    beforeEach(async () => {
      mockAxios.onGet('https://my.scriptrunner.net/myUrlPath').replyOnce(200, VALID_HTML)
      mockAxios.onDelete().reply(200, { response: 'asd' })
      result = await scriptRunnerClient.delete({ url: '/myPath' })
    })
    it('should not try to call a login endpoint', () => {
      expect(mockAxios.history.delete).toHaveLength(1)
      expect(mockAxios.history.get).toHaveLength(1)
    })
    it('should request the correct path with auth headers', () => {
      const srRequest = mockAxios.history.get[0]
      expect(srRequest.auth).toBeUndefined()
      expect(srRequest.baseURL).toEqual('https://my.scriptrunner.net')
      expect(srRequest.url).toEqual('/myUrlPath')
      const request = mockAxios.history.delete[0]
      expect(request.auth).toBeUndefined()
      expect(request.baseURL).toEqual('https://my.scriptrunner.net')
      expect(request.url).toEqual('/myPath')
      expect(request.headers.Authorization).toEqual('JWT validSR')
    })
    it('should return the response', () => {
      expect(result).toEqual({ status: 200, data: { response: 'asd' } })
    })
    it('should pass on headers', async () => {
      await scriptRunnerClient.delete({ url: '/myPath2', headers: { 'X-Atlassian-Token': 'no-check' } })
      expect(mockAxios.history.delete).toHaveLength(2)
      const request = mockAxios.history.delete[1]
      expect(request.headers['X-Atlassian-Token']).toEqual('no-check')
    })
  })
  describe('put', () => {
    beforeEach(async () => {
      mockAxios.onGet('https://my.scriptrunner.net/myUrlPath').replyOnce(200, VALID_HTML)
      mockAxios.onPut().reply(200, { response: 'asd' })
      result = await scriptRunnerClient.put({ url: '/myPath', data: { my: 'data' } })
    })
    it('should not try to call a login endpoint', () => {
      expect(mockAxios.history.put).toHaveLength(1)
      expect(mockAxios.history.get).toHaveLength(1)
    })
    it('should request the correct path with auth headers', () => {
      const srRequest = mockAxios.history.get[0]
      expect(srRequest.auth).toBeUndefined()
      expect(srRequest.baseURL).toEqual('https://my.scriptrunner.net')
      expect(srRequest.url).toEqual('/myUrlPath')
      const request = mockAxios.history.put[0]
      expect(request.auth).toBeUndefined()
      expect(request.baseURL).toEqual('https://my.scriptrunner.net')
      expect(request.url).toEqual('/myPath')
      expect(request.headers.Authorization).toEqual('JWT validSR')
      expect(request.data).toEqual('{"my":"data"}')
    })
    it('should return the response', () => {
      expect(result).toEqual({ status: 200, data: { response: 'asd' } })
    })
    it('should pass on headers', async () => {
      result = await scriptRunnerClient.put({ url: '/myPath', data: { my: 'data' }, headers: { 'X-Atlassian-Token': 'no-check' } })
      expect(mockAxios.history.put).toHaveLength(2)
      const request = mockAxios.history.put[1]
      expect(request.headers['X-Atlassian-Token']).toEqual('no-check')
    })
  })
  describe('post', () => {
    beforeEach(async () => {
      mockAxios.onGet('https://my.scriptrunner.net/myUrlPath').replyOnce(200, VALID_HTML)
      mockAxios.onPost().reply(200, { response: 'asd' })
      result = await scriptRunnerClient.post({ url: '/myPath', data: { my: 'data' } })
    })
    it('should not try to call a login endpoint', () => {
      expect(mockAxios.history.post).toHaveLength(1)
      expect(mockAxios.history.get).toHaveLength(1)
    })
    it('should request the correct path with auth headers', () => {
      const srRequest = mockAxios.history.get[0]
      expect(srRequest.auth).toBeUndefined()
      expect(srRequest.baseURL).toEqual('https://my.scriptrunner.net')
      expect(srRequest.url).toEqual('/myUrlPath')
      const request = mockAxios.history.post[0]
      expect(request.auth).toBeUndefined()
      expect(request.baseURL).toEqual('https://my.scriptrunner.net')
      expect(request.url).toEqual('/myPath')
      expect(request.headers.Authorization).toEqual('JWT validSR')
      expect(request.data).toEqual('{"my":"data"}')
    })
    it('should return the response', () => {
      expect(result).toEqual({ status: 200, data: { response: 'asd' } })
    })
    it('should pass on headers', async () => {
      result = await scriptRunnerClient.post({ url: '/myPath', data: { my: 'data' }, headers: { 'X-Atlassian-Token': 'no-check' } })
      expect(mockAxios.history.post).toHaveLength(2)
      const request = mockAxios.history.post[1]
      expect(request.headers['X-Atlassian-Token']).toEqual('no-check')
    })
  })
})
