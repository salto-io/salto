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
import JiraClient from '../src/client/client'
import ScriptRunnerCredentials from '../src/script_runner_auth'

const JWT_ACCESS_URL = '/plugins/servlet/ac/com.onresolve.jira.groovy.groovyrunner/scriptrunner-home?classifier=json&s=com.onresolve.jira.groovy.groovyrunner__scriptrunner-home'

describe('scriptRunnerCredentials', () => {
  let jiraClient: JiraClient
  let scriptRunnerCredentials: ScriptRunnerCredentials
  let mockAxios: MockAdapter
  let result: string
  beforeEach(() => {
    mockAxios = new MockAdapter(axios)
    jiraClient = new JiraClient({ credentials: { baseUrl: 'http://myjira.net', user: 'me', token: 'tok' }, isDataCenter: false })
    scriptRunnerCredentials = new ScriptRunnerCredentials(jiraClient)
  })
  afterEach(() => {
    mockAxios.restore()
  })

  describe('sendRequest error handing', () => {
    it('should throw correct error when cannot get JWT address', async () => {
      mockAxios.onGet(JWT_ACCESS_URL).reply(400, { response: 'asd', errorMessages: ['error message'] })
      await expect(async () => scriptRunnerCredentials.getUrl()).rejects.toThrow(new Error(`Failed to get ${JWT_ACCESS_URL} with error: Error: Request failed with status code 400. error message`))
    })
    it('should fail when JWT address object is not in the right format', async () => {
      mockAxios.onGet(JWT_ACCESS_URL).reply(200, { xurl: 'https://my.scriptRunner.net/myUrlPath' })
      expect(await scriptRunnerCredentials.getUrl()).toEqual('')
    })
    it('should fail when JWT address object is not a valid url', async () => {
      mockAxios.onGet(JWT_ACCESS_URL).reply(200, { url: 'http' })
      expect(await scriptRunnerCredentials.getUrl()).toEqual('')
    })
  })

  describe('getSinglePage', () => {
    beforeEach(async () => {
      mockAxios.onGet(JWT_ACCESS_URL).reply(200, { url: 'https://my.scriptrunner.net/myUrlPath' })
      result = await scriptRunnerCredentials.getUrl()
    })
    it('should not try to call a login endpoint', () => {
      expect(mockAxios.history.get).toHaveLength(1)
    })
    it('should request the correct path with auth headers', () => {
      const jiraRequest = mockAxios.history.get[0]
      expect(jiraRequest.auth).toEqual({ username: 'me', password: 'tok' })
      expect(jiraRequest.baseURL).toEqual('http://myjira.net')
      expect(jiraRequest.url).toEqual(JWT_ACCESS_URL)
    })
    it('should return the response', () => {
      expect(result).toEqual('https://my.scriptrunner.net/myUrlPath')
    })
    it('should not call the login endpoint again', async () => {
      result = await scriptRunnerCredentials.getUrl()
      expect(mockAxios.history.get).toHaveLength(1)
    })
    it('should not call the login endpoint if baseUrl is called', async () => {
      result = await scriptRunnerCredentials.getBaseUrl()
      expect(mockAxios.history.get).toHaveLength(1)
      expect(result).toEqual('https://my.scriptrunner.net')
    })
  })
})
