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
import { logger } from '@salto-io/logging'
import * as clientUtils from '@salto-io/adapter-components'
import { config } from '@salto-io/adapter-components'
import JiraClient from '../../src/client/client'

import ScriptRunnerClient from '../../src/client/script_runner_client'

const { AdapterFetchError } = config

const SCRIPT_RUNNER_VALID_URL = 'https://my.scriptrunner.net/myUrlPath'

const VALID_HTML = '<!DOCTYPE html><html><head><meta name="sr-token" content="validSR"></head></html>'
const NO_CONTENT_HTML = '<!DOCTYPE html><html><head><meta name="sr-token"></head></html>'
const NO_SR_HTML = '<!DOCTYPE html><html><head></head></html>'
const SURVEY_HTML = '<!DOCTYPE html><html><head><title>Post Install Complete</title></head></html>'

const JWT_ACCESS_URL =
  '/plugins/servlet/ac/com.onresolve.jira.groovy.groovyrunner/scriptrunner-home?classifier=json&s=com.onresolve.jira.groovy.groovyrunner__scriptrunner-home'

const logging = logger('jira-adapter/src/client/script_runner_connection')
const logErrorSpy = jest.spyOn(logging, 'error')

const getLoginError = (): Error =>
  new AdapterFetchError(
    'Failed to get ScriptRunner token, the response from the jira service was not as expected. Please try again later. Our support team was notified about this, and we will investigate it as well.',
    'Error',
  )

describe('scriptRunnerClient', () => {
  let jiraClient: JiraClient
  let scriptRunnerClient: ScriptRunnerClient
  let mockAxios: MockAdapter
  beforeEach(() => {
    mockAxios = new MockAdapter(axios)
    jiraClient = new JiraClient({
      credentials: { baseUrl: 'http://myjira.net/', user: 'me', token: 'tok' },
      isDataCenter: false,
    })
    scriptRunnerClient = new ScriptRunnerClient({ credentials: {}, jiraClient, isDataCenter: false })
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
    logErrorSpy.mockClear()
  })

  describe('creating connection', () => {
    describe('get token address', () => {
      it('should throw correct error when cannot get JWT address', async () => {
        mockAxios.onGet(JWT_ACCESS_URL).reply(400, { response: 'asd', errorMessages: ['error message'] })
        await expect(async () => scriptRunnerClient.get({ url: '/myPath' })).rejects.toThrow(
          new Error(
            `Failed to get ${JWT_ACCESS_URL} with error: Error: Request failed with status code 400. error message`,
          ),
        )
      })
      it('should fail when JWT address object is not in the right format', async () => {
        mockAxios.onGet(JWT_ACCESS_URL).reply(200, { xurl: SCRIPT_RUNNER_VALID_URL })
        await expect(async () => scriptRunnerClient.get({ url: '/myPath' })).rejects.toThrow(getLoginError())
        expect(logErrorSpy).toHaveBeenCalledWith(
          'Failed to get scriptRunner token, the response from the jira service was not as expected',
        )
      })
      it('should fail when JWT address object is not a valid url', async () => {
        mockAxios.onGet(JWT_ACCESS_URL).reply(200, { url: 'http' })
        await expect(async () => scriptRunnerClient.get({ url: '/myPath' })).rejects.toThrow(getLoginError())
        expect(logErrorSpy).toHaveBeenCalledWith(
          'Failed to parse scriptRunner token, the response from the jira service was not a valid url',
          'http',
        )
      })
      it('should not call the address endpoint again', async () => {
        mockAxios.onGet(JWT_ACCESS_URL).reply(200, { url: SCRIPT_RUNNER_VALID_URL })
        mockAxios.onGet(SCRIPT_RUNNER_VALID_URL).replyOnce(200, VALID_HTML)
        mockAxios.onGet('https://my.scriptrunner.net/myPath').reply(200, { response: 'asd' })
        await scriptRunnerClient.get({ url: '/myPath' })
        await scriptRunnerClient.get({ url: '/myPath' })
        expect(mockAxios.history.get.filter(history => history.url === JWT_ACCESS_URL)).toHaveLength(1)
        expect(mockAxios.history.get.filter(history => history.url === '/myUrlPath')).toHaveLength(1)
      })
    })
    describe('get token', () => {
      beforeEach(async () => {
        mockAxios.onGet(JWT_ACCESS_URL).reply(200, { url: SCRIPT_RUNNER_VALID_URL })
      })
      it('should fail when cannot access JWT address', async () => {
        mockAxios.onGet(SCRIPT_RUNNER_VALID_URL).reply(400, { response: 'asd', errorMessages: ['error message'] })
        await expect(async () => scriptRunnerClient.get({ url: '/myPath' })).rejects.toThrow(getLoginError())
        expect(logErrorSpy).toHaveBeenCalledWith(
          'Failed to get scriptRunner token from scriptRunner service',
          new Error('Request failed with status code 400'),
        )
      })
      it('should fail when sr not in correct format', async () => {
        mockAxios.onGet(SCRIPT_RUNNER_VALID_URL).replyOnce(200, { response: 'asd' })
        await expect(async () => scriptRunnerClient.get({ url: '/myPath' })).rejects.toThrow(getLoginError())
      })
      it('should fail when not html response', async () => {
        mockAxios.onGet(SCRIPT_RUNNER_VALID_URL).replyOnce(200, 'not another html answer')
        await expect(async () => scriptRunnerClient.get({ url: '/myPath' })).rejects.toThrow(getLoginError())
        expect(logErrorSpy).toHaveBeenCalledWith(
          'Failed to get scriptRunner token from scriptRunner service, could not find meta tag with name="sr-token"',
          'not another html answer',
        )
      })
      it('should fail when not SR token', async () => {
        mockAxios.onGet(SCRIPT_RUNNER_VALID_URL).replyOnce(200, NO_SR_HTML)
        await expect(async () => scriptRunnerClient.get({ url: '/myPath' })).rejects.toThrow(getLoginError())
        expect(logErrorSpy).toHaveBeenCalledWith(
          'Failed to get scriptRunner token from scriptRunner service, could not find meta tag with name="sr-token"',
          '<!DOCTYPE html><html><head></head></html>',
        )
      })
      it('should fail with correct info when a survey screen is active', async () => {
        mockAxios.onGet(SCRIPT_RUNNER_VALID_URL).replyOnce(200, SURVEY_HTML)
        await expect(async () => scriptRunnerClient.get({ url: '/myPath' })).rejects.toThrow(
          new AdapterFetchError(
            'Fetch failed as ScriptRunner was not fully installed in the Jira Instance. To continue, please open the ScriptRunner app at ' +
              'http://myjira.net/plugins/servlet/ac/com.onresolve.jira.groovy.groovyrunner/post-install-nav-link, fill and send the survey, and try again.',
            'Error',
          ),
        )
        expect(logErrorSpy).toHaveBeenCalledWith(
          'Failed to get scriptRunner token from scriptRunner service, could not find meta tag with name="sr-token"',
          SURVEY_HTML,
        )
      })
      it('should fail when sr element does not have context', async () => {
        mockAxios.onGet(SCRIPT_RUNNER_VALID_URL).replyOnce(200, NO_CONTENT_HTML)
        await expect(async () => scriptRunnerClient.get({ url: '/myPath' })).rejects.toThrow(getLoginError())
        expect(logErrorSpy).toHaveBeenCalledWith(
          'Failed to get scriptRunner token from scriptRunner service, could not find content attribute"',
          '<!DOCTYPE html><html><head><meta name="sr-token"></head></html>',
        )
      })
      it('should call send request decorator for page', async () => {
        mockAxios.onGet(SCRIPT_RUNNER_VALID_URL).replyOnce(200, VALID_HTML)
        mockAxios
          .onGet('https://my.scriptrunner.net/myPath')
          .replyOnce(400, { response: 'asd', errorMessages: ['error message'] })
        await expect(async () => scriptRunnerClient.get({ url: '/myPath' })).rejects.toThrow(
          new Error('Failed to get /myPath with error: Error: Request failed with status code 400. error message'),
        )
      })
      it('should fail without throwing when received page not found error', async () => {
        mockAxios.onGet(SCRIPT_RUNNER_VALID_URL).replyOnce(200, VALID_HTML)
        mockAxios
          .onGet('https://my.scriptrunner.net/myPath')
          .reply(404, { response: 'asd', errorMessages: ['error message'] })
        expect(await scriptRunnerClient.get({ url: '/myPath' })).toEqual({ status: 404, data: [] })
      })
    })
    it('should not call endpoints for dc', async () => {
      scriptRunnerClient = new ScriptRunnerClient({ credentials: {}, jiraClient, isDataCenter: true })
      expect(mockAxios.history.get).toHaveLength(0)
    })
  })

  describe('get', () => {
    let result: clientUtils.client.ResponseValue
    beforeEach(async () => {
      mockAxios.onGet(JWT_ACCESS_URL).reply(200, { url: SCRIPT_RUNNER_VALID_URL })
      mockAxios.onGet(SCRIPT_RUNNER_VALID_URL).replyOnce(200, VALID_HTML)
      mockAxios.onGet().reply(200, { response: 'asd' })
      result = await scriptRunnerClient.get({ url: '/myPath' })
    })
    it('should request the correct path with auth headers', () => {
      expect(mockAxios.history.get).toHaveLength(6)
      const jiraAddress = mockAxios.history.get.find(r => r.url === JWT_ACCESS_URL)
      expect(jiraAddress?.baseURL).toEqual('http://myjira.net/')
      expect(jiraAddress?.url).toEqual(JWT_ACCESS_URL)
      const srRequest = mockAxios.history.get.find(r => r.url === '/myUrlPath')
      expect(srRequest?.auth).toBeUndefined()
      expect(srRequest?.baseURL).toEqual('https://my.scriptrunner.net')
      expect(srRequest?.url).toEqual('/myUrlPath')
      const request = mockAxios.history.get.find(r => r.url === '/myPath')
      expect(request?.auth).toBeUndefined()
      expect(request?.baseURL).toEqual('https://my.scriptrunner.net')
      expect(request?.url).toEqual('/myPath')
      expect(request?.headers?.Authorization).toEqual('JWT validSR')
    })
    it('should return the response', () => {
      expect(result).toEqual({ status: 200, data: { response: 'asd' } })
    })
    it('should not call the login endpoint again', async () => {
      await scriptRunnerClient.get({ url: '/myPath2' })
      expect(mockAxios.history.get).toHaveLength(7)
    })
    it('should pass on headers', async () => {
      await scriptRunnerClient.get({ url: '/myPath2', headers: { 'X-Atlassian-Token': 'no-check' } })
      expect(mockAxios.history.get).toHaveLength(7)
      const request = mockAxios.history.get.find(r => r.url === '/myPath2')
      expect(request?.headers?.['X-Atlassian-Token']).toEqual('no-check')
    })
  })
  it('should not throw on license error', async () => {
    mockAxios.onGet(JWT_ACCESS_URL).reply(200, { url: SCRIPT_RUNNER_VALID_URL })
    mockAxios.onGet(SCRIPT_RUNNER_VALID_URL).replyOnce(200, VALID_HTML)
    mockAxios.onGet().reply(402, { response: 'asd' })
    const result = await scriptRunnerClient.get({ url: '/myPath' })
    expect(result).toEqual({ status: 402, data: [] })
  })
})
